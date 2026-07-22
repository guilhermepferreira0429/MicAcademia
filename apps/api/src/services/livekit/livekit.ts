import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

import { AppError, ErrorCodes } from '@api/utils/errors';
import { env } from '@cio/core/config/env';
import { getCourseTeachers } from '@cio/db/queries/course';
import { getLessonById } from '@cio/db/queries/lesson';

/**
 * LiveKit live-class sessions (PRD 1.3). A "live session" is a lesson with a
 * scheduled `lessonAt` on a LIVE_CLASS course, so a session maps 1:1 to a
 * lesson and the room name is derived from the lesson id.
 *
 * The token `identity` is the user's profile id — LiveKit echoes it back on
 * participant webhooks, which is what ties attendance records to a student.
 */

/** Session tokens are valid for a full class plus slack. */
const TOKEN_TTL = '4h';
/** Keep the room alive briefly after the last participant leaves (reconnects). */
const EMPTY_TIMEOUT_SECONDS = 300;

export function isLiveKitConfigured(): boolean {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

/** Deterministic room name for a live lesson. */
export function getLessonRoomName(lessonId: string): string {
  return `mica-lesson-${lessonId}`;
}

/** The server-API base URL: RoomServiceClient speaks HTTP, clients use ws://. */
function toHttpUrl(url: string): string {
  return url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
}

export interface LessonSessionToken {
  /** ws:// URL the browser client connects to. */
  url: string;
  token: string;
  roomName: string;
  /** Teachers/admins get room-admin rights (can moderate). */
  isHost: boolean;
}

/**
 * Issues a join token for a live lesson. The caller must already be verified as
 * a course member (courseMemberMiddleware) — this adds the lesson↔course check
 * and decides host rights.
 */
export async function createLessonSessionToken(
  courseId: string,
  lessonId: string,
  user: { id: string; fullname?: string | null }
): Promise<LessonSessionToken> {
  if (!isLiveKitConfigured()) {
    throw new AppError('LiveKit is not configured', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const lesson = await getLessonById(lessonId);
  if (!lesson || lesson.courseId !== courseId) {
    throw new AppError('Lesson not found', ErrorCodes.NOT_FOUND, 404);
  }

  const teachers = await getCourseTeachers({ courseId });
  const isHost = teachers.some((teacher) => teacher.id === user.id);

  const apiKey = env.LIVEKIT_API_KEY!;
  const apiSecret = env.LIVEKIT_API_SECRET!;
  const roomName = getLessonRoomName(lessonId);

  // Create the room up front so it carries our settings (LiveKit would
  // otherwise auto-create it on first join with defaults). Ignore "already
  // exists" — this is intentionally idempotent.
  try {
    const roomService = new RoomServiceClient(toHttpUrl(env.LIVEKIT_URL!), apiKey, apiSecret);
    await roomService.createRoom({ name: roomName, emptyTimeout: EMPTY_TIMEOUT_SECONDS });
  } catch (error) {
    console.warn('createLessonSessionToken: room ensure skipped:', error instanceof Error ? error.message : error);
  }

  const accessToken = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.fullname ?? undefined,
    ttl: TOKEN_TTL
  });

  // Students publish too — IEFP requires real-time interaction, not broadcast.
  accessToken.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: isHost
  });

  const token = await accessToken.toJwt();

  return { url: env.LIVEKIT_URL!, token, roomName, isHost };
}
