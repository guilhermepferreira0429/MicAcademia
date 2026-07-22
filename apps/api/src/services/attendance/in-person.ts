import { createHmac, timingSafeEqual } from 'node:crypto';

import { AppError, ErrorCodes } from '@api/utils/errors';
import { env } from '@cio/core/config/env';
import {
  closeAttendanceEntry,
  createAttendanceEntry,
  getOpenAttendanceEntry,
  listAttendanceForCourse
} from '@cio/db/queries/attendance';
import { getLessonById } from '@cio/db/queries/lesson';

import { syncLessonAttendanceVerdict } from '@api/services/livekit/attendance';

/**
 * In-person attendance (PRD 2.2). Trainers show a per-session QR; scanning it
 * checks a student in, scanning again checks them out — so the record holds real
 * attended time, not just "was here". Manual marking covers the cases where a
 * scan isn't possible. Both write to the same `attendance_log` as the online
 * (LiveKit) sessions, which is what makes a mixed course consolidate.
 */

/** How long a session QR stays valid. Short, because it is displayed publicly. */
const CHECKIN_TOKEN_TTL_MINUTES = 15;
/** Credited minutes when a trainer marks someone present without a duration. */
const DEFAULT_MANUAL_MINUTES = 60;

function signingSecret(): string {
  const secret = env.PRIVATE_SERVER_KEY;
  if (!secret) {
    throw new AppError('Server signing key is not configured', ErrorCodes.VALIDATION_ERROR, 500);
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

export interface CheckinCode {
  token: string;
  expiresAt: string;
}

/** Mints a short-lived signed token for a session's QR code. */
export function createCheckinCode(courseId: string, lessonId: string): CheckinCode {
  const expiresAt = Date.now() + CHECKIN_TOKEN_TTL_MINUTES * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ c: courseId, l: lessonId, e: expiresAt }), 'utf8').toString('base64url');

  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(expiresAt).toISOString() };
}

/** Verifies a scanned token and returns the session it belongs to. */
export function verifyCheckinCode(token: string): { courseId: string; lessonId: string } {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    throw new AppError('Invalid check-in code', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new AppError('Invalid check-in code', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    c: string;
    l: string;
    e: number;
  };

  if (!decoded.e || decoded.e < Date.now()) {
    throw new AppError('This check-in code has expired', ErrorCodes.VALIDATION_ERROR, 400);
  }

  return { courseId: decoded.c, lessonId: decoded.l };
}

export interface CheckinResult {
  action: 'checked_in' | 'checked_out';
  lessonId: string;
  at: string;
  durationSeconds?: number;
}

/**
 * Scanning the QR toggles presence: the first scan opens an interval, the next
 * one closes it. Keeps in-person hours as real as the online ones.
 */
export async function checkInOrOut(token: string, profileId: string): Promise<CheckinResult> {
  const { courseId, lessonId } = verifyCheckinCode(token);

  const lesson = await getLessonById(lessonId);
  if (!lesson || lesson.courseId !== courseId) {
    throw new AppError('Session not found', ErrorCodes.NOT_FOUND, 404);
  }

  const now = new Date().toISOString();
  const open = await getOpenAttendanceEntry(lessonId, profileId);

  if (open) {
    const durationSeconds = Math.max(0, Math.round((Date.parse(now) - Date.parse(open.joinedAt)) / 1000));
    await closeAttendanceEntry(open.id, now, durationSeconds);
    await syncLessonAttendanceVerdict(lessonId);

    return { action: 'checked_out', lessonId, at: now, durationSeconds };
  }

  await createAttendanceEntry({
    courseId,
    lessonId,
    profileId,
    source: 'qr',
    joinedAt: now
  });

  return { action: 'checked_in', lessonId, at: now };
}

/**
 * Trainer asserts a student attended an in-person session. Recorded as a closed
 * interval so it shows up in the same hour totals, tagged `manual` with the
 * trainer's id for audit.
 */
export async function markManualAttendance(
  courseId: string,
  lessonId: string,
  profileId: string,
  minutes: number | undefined,
  recordedBy: string
): Promise<{ minutes: number }> {
  const lesson = await getLessonById(lessonId);
  if (!lesson || lesson.courseId !== courseId) {
    throw new AppError('Session not found', ErrorCodes.NOT_FOUND, 404);
  }

  const creditedMinutes = minutes ?? DEFAULT_MANUAL_MINUTES;
  const startedAt = lesson.lessonAt ? new Date(lesson.lessonAt) : new Date(Date.now() - creditedMinutes * 60 * 1000);
  const endedAt = new Date(startedAt.getTime() + creditedMinutes * 60 * 1000);

  await createAttendanceEntry({
    courseId,
    lessonId,
    profileId,
    source: 'manual',
    recordedBy,
    joinedAt: startedAt.toISOString(),
    leftAt: endedAt.toISOString(),
    durationSeconds: creditedMinutes * 60
  });

  await syncLessonAttendanceVerdict(lessonId);

  return { minutes: creditedMinutes };
}

export interface CourseAttendanceSummary {
  courseId: string;
  sessions: Array<{ lessonId: string; title: string; lessonAt: string | null; sessionSeconds: number }>;
  students: Array<{
    profileId: string;
    fullname: string | null;
    totalSeconds: number;
    perSession: Array<{ lessonId: string; seconds: number; percent: number; sources: string[] }>;
  }>;
}

/**
 * Consolidated attendance for a whole course — every session, online or
 * in-person, in one record per student. This is what backs the certificate's
 * total hours and a SIGO submission.
 */
export async function getCourseAttendanceSummary(courseId: string): Promise<CourseAttendanceSummary> {
  const rows = await listAttendanceForCourse(courseId);
  const now = Date.now();

  const secondsOf = (row: (typeof rows)[number]) =>
    row.durationSeconds ??
    Math.max(0, Math.round(((row.leftAt ? Date.parse(row.leftAt) : now) - Date.parse(row.joinedAt)) / 1000));

  const lessonInfo = new Map<string, { title: string; lessonAt: string | null }>();
  const byStudent = new Map<
    string,
    { fullname: string | null; perSession: Map<string, { seconds: number; sources: Set<string> }> }
  >();

  for (const row of rows) {
    lessonInfo.set(row.lessonId, { title: row.lessonTitle, lessonAt: row.lessonAt });

    const student = byStudent.get(row.profileId) ?? { fullname: row.fullname, perSession: new Map() };
    const session = student.perSession.get(row.lessonId) ?? { seconds: 0, sources: new Set<string>() };

    session.seconds += secondsOf(row);
    session.sources.add(row.source);
    student.perSession.set(row.lessonId, session);
    byStudent.set(row.profileId, student);
  }

  // Session length = the longest single attendance in that session (see the note
  // in the live-session attendance service: a span would mix wall-clock check-ins
  // with manual entries anchored to the scheduled time).
  const sessionSecondsById = new Map<string, number>();
  for (const student of byStudent.values()) {
    for (const [lessonId, entry] of student.perSession) {
      sessionSecondsById.set(lessonId, Math.max(sessionSecondsById.get(lessonId) ?? 0, entry.seconds));
    }
  }

  const sessions = [...lessonInfo.entries()].map(([lessonId, info]) => ({
    lessonId,
    title: info.title,
    lessonAt: info.lessonAt,
    sessionSeconds: sessionSecondsById.get(lessonId) ?? 0
  }));

  const students = [...byStudent.entries()].map(([profileId, student]) => {
    const perSession = [...student.perSession.entries()].map(([lessonId, entry]) => {
      const sessionSeconds = sessionSecondsById.get(lessonId) ?? 0;

      return {
        lessonId,
        seconds: entry.seconds,
        percent: sessionSeconds > 0 ? Math.round((entry.seconds / sessionSeconds) * 100) : 0,
        sources: [...entry.sources]
      };
    });

    return {
      profileId,
      fullname: student.fullname,
      totalSeconds: perSession.reduce((total, entry) => total + entry.seconds, 0),
      perSession
    };
  });

  return { courseId, sessions, students };
}
