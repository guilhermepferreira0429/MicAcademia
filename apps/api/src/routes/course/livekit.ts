import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { courseMemberMiddleware } from '@api/middlewares/course-member';
import { courseTeamMemberMiddleware } from '@api/middlewares/course-team-member';
import { handleError } from '@api/utils/errors';
import { createLessonSessionToken } from '@api/services/livekit/livekit';
import { computeLessonAttendance } from '@api/services/livekit/attendance';
import {
  isRecordingConfigured,
  listRecordingsForLesson,
  publishRecordingToLesson,
  startLessonRecording,
  stopLessonRecording
} from '@api/services/livekit/recording';

export const livekitRouter = new Hono()
  /**
   * GET /course/:courseId/livekit/:lessonId/token
   * Issues a LiveKit join token for a live lesson. Only course members get one
   * (courseMemberMiddleware); teachers additionally receive room-admin rights.
   */
  .get('/:lessonId/token', authMiddleware, courseMemberMiddleware, async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const lessonId = c.req.param('lessonId');
      const user = c.get('user')!;

      const result = await createLessonSessionToken(courseId, lessonId, { id: user.id, fullname: user.name });

      return c.json({ success: true, data: result }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to create live session token');
    }
  })
  /**
   * GET /course/:courseId/livekit/:lessonId/attendance
   * Attendance summary for a live session: per-student attended time, share of
   * the session, and the present/absent verdict. Course team only.
   */
  .get('/:lessonId/attendance', authMiddleware, courseTeamMemberMiddleware, async (c) => {
    try {
      const lessonId = c.req.param('lessonId');
      const summary = await computeLessonAttendance(lessonId);

      return c.json({ success: true, data: summary }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to compute attendance');
    }
  })
  /**
   * GET /course/:courseId/livekit/:lessonId/recordings
   * Recordings of a live lesson, each with a fresh playback URL. Course team
   * only — students watch the published recording as a lesson video.
   */
  .get('/:lessonId/recordings', authMiddleware, courseTeamMemberMiddleware, async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const recordings = await listRecordingsForLesson(courseId, c.req.param('lessonId'));

      return c.json({ success: true, data: { recordings, isConfigured: isRecordingConfigured() } }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to list recordings');
    }
  })
  /**
   * POST /course/:courseId/livekit/:lessonId/recordings/start
   * Manual start, for a class already running that is not being recorded
   * (recording normally starts on its own with the room).
   */
  .post('/:lessonId/recordings/start', authMiddleware, courseTeamMemberMiddleware, async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const recording = await startLessonRecording(courseId, c.req.param('lessonId'));

      return c.json({ success: true, data: recording }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to start recording');
    }
  })
  /** POST /course/:courseId/livekit/:lessonId/recordings/stop */
  .post('/:lessonId/recordings/stop', authMiddleware, courseTeamMemberMiddleware, async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const recording = await stopLessonRecording(courseId, c.req.param('lessonId'));

      return c.json({ success: true, data: recording }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to stop recording');
    }
  })
  /**
   * POST /course/:courseId/livekit/:lessonId/recordings/:recordingId/publish
   * Publishing happens automatically when the file lands; this re-runs it for a
   * recording that was unpublished or arrived before the lesson existed.
   */
  .post('/:lessonId/recordings/:recordingId/publish', authMiddleware, courseTeamMemberMiddleware, async (c) => {
    try {
      const recording = await publishRecordingToLesson(c.req.param('recordingId'));

      return c.json({ success: true, data: recording }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to publish recording');
    }
  });
