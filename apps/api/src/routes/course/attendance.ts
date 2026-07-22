import { Hono } from '@api/utils/hono';
import { ZAttendanceCheckin, ZAttendanceManualMark, ZAttendanceUpsert } from '@cio/utils/validation/attendance';
import { authMiddleware } from '@api/middlewares/auth';
import { courseMemberMiddleware } from '@api/middlewares/course-member';
import { courseTeamMemberMiddleware } from '@api/middlewares/course-team-member';
import { handleError } from '@api/utils/errors';
import {
  checkInOrOut,
  createCheckinCode,
  getCourseAttendanceSummary,
  markManualAttendance,
  upsertAttendanceService
} from '@api/services/attendance';
import { zValidator } from '@hono/zod-validator';

export const attendanceRouter = new Hono()
  .post('/', authMiddleware, courseMemberMiddleware, zValidator('json', ZAttendanceUpsert), async (c) => {
    try {
      const data = c.req.valid('json');
      const attendance = await upsertAttendanceService(data);

      return c.json({ success: true, data: attendance }, 201);
    } catch (error) {
      return handleError(c, error, 'Failed to upsert attendance');
    }
  })
  /**
   * POST /course/:courseId/attendance/checkin
   * A student scanning the session QR. The same call checks in and, on a second
   * scan, checks out — so in-person hours are measured, not assumed.
   */
  .post('/checkin', authMiddleware, courseMemberMiddleware, zValidator('json', ZAttendanceCheckin), async (c) => {
    try {
      const user = c.get('user')!;
      const { token } = c.req.valid('json');
      const result = await checkInOrOut(token, user.id);

      return c.json({ success: true, data: result }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to record check-in');
    }
  })
  /**
   * GET /course/:courseId/attendance/summary
   * Consolidated attendance across every session of the course, online and
   * in-person — the record behind certificate hours and SIGO submission.
   */
  .get('/summary', authMiddleware, courseTeamMemberMiddleware, async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const summary = await getCourseAttendanceSummary(courseId);

      return c.json({ success: true, data: summary }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to build attendance summary');
    }
  })
  /**
   * POST /course/:courseId/attendance/:lessonId/checkin-code
   * Mints the short-lived signed token a trainer renders as the session QR.
   */
  .post('/:lessonId/checkin-code', authMiddleware, courseTeamMemberMiddleware, async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const lessonId = c.req.param('lessonId');
      const code = createCheckinCode(courseId, lessonId);

      return c.json({ success: true, data: code }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to create check-in code');
    }
  })
  /**
   * POST /course/:courseId/attendance/:lessonId/manual
   * Trainer marks a student present for an in-person session (no scan possible).
   */
  .post(
    '/:lessonId/manual',
    authMiddleware,
    courseTeamMemberMiddleware,
    zValidator('json', ZAttendanceManualMark),
    async (c) => {
      try {
        const courseId = c.req.param('courseId')!;
        const lessonId = c.req.param('lessonId');
        const user = c.get('user')!;
        const { profileId, minutes } = c.req.valid('json');

        const result = await markManualAttendance(courseId, lessonId, profileId, minutes, user.id);

        return c.json({ success: true, data: result }, 200);
      } catch (error) {
        return handleError(c, error, 'Failed to mark attendance');
      }
    }
  );
