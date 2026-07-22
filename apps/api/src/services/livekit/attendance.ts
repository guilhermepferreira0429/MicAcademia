import { WebhookReceiver, type WebhookEvent } from 'livekit-server-sdk';

import { env } from '@cio/core/config/env';
import {
  closeAttendanceEntry,
  closeOpenAttendanceEntriesForLesson,
  createAttendanceEntry,
  getOpenAttendanceEntry,
  listAttendanceForLesson,
  upsertAttendance
} from '@cio/db/queries/attendance';
import { getCourseWithRelations } from '@cio/db/queries/course';
import { getGroupMemberIdByGroupAndProfile } from '@cio/db/queries/group';
import { getLessonById } from '@cio/db/queries/lesson';

/**
 * Live-session attendance (PRD 1.3). LiveKit webhooks give us join/leave events
 * per participant; each becomes an interval in `attendance_log`. Reconnections
 * simply add more intervals, which are summed. The derived verdict is mirrored
 * into `group_attendance.isPresent`, which is what the existing UI reads.
 */

/** A student counts as present when they attended at least this share of the session. */
export const ATTENDANCE_THRESHOLD_PERCENT = 90;

const ROOM_PREFIX = 'mica-lesson-';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rooms are named `mica-lesson-<lessonId>`. */
export function parseLessonIdFromRoom(roomName: string | undefined | null): string | null {
  if (!roomName || !roomName.startsWith(ROOM_PREFIX)) return null;

  const lessonId = roomName.slice(ROOM_PREFIX.length);

  return UUID_RE.test(lessonId) ? lessonId : null;
}

function toIso(secondsOrMillis: number | bigint | undefined): string {
  const value = Number(secondsOrMillis ?? 0);
  if (!value) return new Date().toISOString();

  // LiveKit sends unix seconds; guard in case a ms timestamp shows up.
  return new Date(value > 1e12 ? value : value * 1000).toISOString();
}

/** Verifies the LiveKit webhook signature and returns the decoded event. */
export async function receiveLiveKitWebhook(rawBody: string, authHeader: string): Promise<WebhookEvent> {
  const receiver = new WebhookReceiver(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);

  return receiver.receive(rawBody, authHeader);
}

export async function handleLiveKitEvent(event: WebhookEvent): Promise<{ handled: boolean }> {
  const lessonId = parseLessonIdFromRoom(event.room?.name);
  if (!lessonId) {
    return { handled: false };
  }

  const eventAt = toIso(event.createdAt);

  if (event.event === 'room_finished') {
    await closeOpenAttendanceEntriesForLesson(lessonId, eventAt);
    await syncLessonAttendanceVerdict(lessonId);

    return { handled: true };
  }

  const identity = event.participant?.identity;
  // The token identity is the student's profile id; anything else isn't a student.
  if (!identity || !UUID_RE.test(identity)) {
    return { handled: false };
  }

  if (event.event === 'participant_joined') {
    const open = await getOpenAttendanceEntry(lessonId, identity);
    if (open) {
      return { handled: true };
    }

    const lesson = await getLessonById(lessonId);
    if (!lesson) {
      return { handled: false };
    }

    try {
      await createAttendanceEntry({
        courseId: lesson.courseId,
        lessonId,
        profileId: identity,
        source: 'livekit',
        roomName: event.room?.name ?? null,
        joinedAt: eventAt
      });
    } catch (error) {
      // Unknown profile (e.g. a synthetic test participant) — don't fail the webhook.
      console.warn('handleLiveKitEvent: could not record join:', error instanceof Error ? error.message : error);

      return { handled: false };
    }

    return { handled: true };
  }

  if (event.event === 'participant_left') {
    const open = await getOpenAttendanceEntry(lessonId, identity);
    if (!open) {
      return { handled: false };
    }

    const durationSeconds = Math.max(0, Math.round((Date.parse(eventAt) - Date.parse(open.joinedAt)) / 1000));
    await closeAttendanceEntry(open.id, eventAt, durationSeconds);
    await syncLessonAttendanceVerdict(lessonId);

    return { handled: true };
  }

  return { handled: false };
}

export interface LessonAttendanceSummary {
  lessonId: string;
  /** Actual session length: first join → last leave across all participants. */
  sessionSeconds: number;
  thresholdPercent: number;
  participants: Array<{
    profileId: string;
    attendedSeconds: number;
    percent: number;
    present: boolean;
  }>;
}

/**
 * Sums each student's intervals for a lesson and applies the threshold.
 * Session length is the real span of the class (first join → last leave), so a
 * class that starts late or runs long is measured against what actually happened.
 */
export async function computeLessonAttendance(
  lessonId: string,
  thresholdPercent: number = ATTENDANCE_THRESHOLD_PERCENT
): Promise<LessonAttendanceSummary> {
  const rows = await listAttendanceForLesson(lessonId);
  if (rows.length === 0) {
    return { lessonId, sessionSeconds: 0, thresholdPercent, participants: [] };
  }

  const now = Date.now();
  const startsAt = Math.min(...rows.map((row) => Date.parse(row.joinedAt)));
  const endsAt = Math.max(...rows.map((row) => (row.leftAt ? Date.parse(row.leftAt) : now)));
  const sessionSeconds = Math.max(0, Math.round((endsAt - startsAt) / 1000));

  const secondsByProfile = new Map<string, number>();
  for (const row of rows) {
    const seconds =
      row.durationSeconds ??
      Math.max(0, Math.round(((row.leftAt ? Date.parse(row.leftAt) : now) - Date.parse(row.joinedAt)) / 1000));
    secondsByProfile.set(row.profileId, (secondsByProfile.get(row.profileId) ?? 0) + seconds);
  }

  const participants = [...secondsByProfile.entries()].map(([profileId, attendedSeconds]) => {
    const percent = sessionSeconds > 0 ? Math.round((attendedSeconds / sessionSeconds) * 100) : 0;

    return { profileId, attendedSeconds, percent, present: percent >= thresholdPercent };
  });

  return { lessonId, sessionSeconds, thresholdPercent, participants };
}

/** Writes the computed present/absent verdict into `group_attendance`. */
export async function syncLessonAttendanceVerdict(lessonId: string): Promise<LessonAttendanceSummary> {
  const summary = await computeLessonAttendance(lessonId);

  const lesson = await getLessonById(lessonId);
  if (!lesson) {
    return summary;
  }

  const course = await getCourseWithRelations(lesson.courseId);
  const groupId = course?.groupId;
  if (!groupId) {
    return summary;
  }

  for (const participant of summary.participants) {
    const groupMemberId = await getGroupMemberIdByGroupAndProfile(groupId, participant.profileId);
    if (!groupMemberId) continue;

    await upsertAttendance({
      courseId: lesson.courseId,
      lessonId,
      studentId: groupMemberId,
      isPresent: participant.present
    });
  }

  return summary;
}
