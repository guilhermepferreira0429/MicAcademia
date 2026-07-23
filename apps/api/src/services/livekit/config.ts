import { env } from '@cio/core/config/env';

/**
 * The few LiveKit facts both the session and the recording services need.
 * Kept apart from either so they can reference each other's conventions —
 * above all the room naming — without importing one another in a circle.
 */

export function isLiveKitConfigured(): boolean {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

/** Deterministic room name for a live lesson. */
export function getLessonRoomName(lessonId: string): string {
  return `mica-lesson-${lessonId}`;
}

/** The server-API base URL: server clients speak HTTP, browsers use ws://. */
export function toHttpUrl(url: string): string {
  return url.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
}
