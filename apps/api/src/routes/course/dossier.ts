import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { courseTeamMemberMiddleware } from '@api/middlewares/course-team-member';
import { handleError } from '@api/utils/errors';
import { buildCourseDossier } from '@api/services/course/dossier';

export const dossierRouter = new Hono()
  /**
   * GET /course/:courseId/dossier
   * The DGERT/IEFP audit pack for a training action: identification, trainers
   * and their credentials, programme, attendance sheet, certificates issued,
   * and the gaps still to close. Course team only.
   */
  .get('/', authMiddleware, courseTeamMemberMiddleware, async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const dossier = await buildCourseDossier(courseId);

      return c.json({ success: true, data: dossier }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to build audit dossier');
    }
  });
