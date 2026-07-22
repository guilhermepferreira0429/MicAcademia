import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { courseMemberMiddleware } from '@api/middlewares/course-member';
import { courseTeamMemberMiddleware } from '@api/middlewares/course-team-member';
import { handleError } from '@api/utils/errors';
import { createLessonSessionToken } from '@api/services/livekit/livekit';
import { computeLessonAttendance } from '@api/services/livekit/attendance';

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
  });
