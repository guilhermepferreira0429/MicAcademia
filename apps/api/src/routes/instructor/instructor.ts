import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { orgAdminMiddleware } from '@api/middlewares/org-admin';
import { handleError } from '@api/utils/errors';
import { zValidator } from '@hono/zod-validator';
import { ZAssignInstructorCourse, ZCreateInstructor, ZUpdateInstructor } from '@cio/utils/validation';
import {
  assignOrgInstructorCourse,
  createOrgInstructor,
  deleteOrgInstructor,
  listOrgInstructors,
  unassignOrgInstructorCourse,
  updateOrgInstructor
} from '@api/services/instructor/instructor';

/** All routes are org-admin only; orgId comes from the `cio-org-id` header (validated by orgAdminMiddleware). */
export const instructorRouter = new Hono()
  .use('*', authMiddleware, orgAdminMiddleware)
  .get('/', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const instructors = await listOrgInstructors(orgId);

      return c.json({ success: true, data: instructors }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to list instructors');
    }
  })
  .post('/', zValidator('json', ZCreateInstructor), async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const data = c.req.valid('json');
      const instructor = await createOrgInstructor(orgId, data);

      return c.json({ success: true, data: instructor }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to create instructor');
    }
  })
  .put('/:instructorId', zValidator('json', ZUpdateInstructor), async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const instructorId = c.req.param('instructorId');
      const data = c.req.valid('json');
      const instructor = await updateOrgInstructor(orgId, instructorId, data);

      return c.json({ success: true, data: instructor }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to update instructor');
    }
  })
  .delete('/:instructorId', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const instructorId = c.req.param('instructorId');
      await deleteOrgInstructor(orgId, instructorId);

      return c.json({ success: true, data: { id: instructorId } }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to delete instructor');
    }
  })
  .post('/:instructorId/courses', zValidator('json', ZAssignInstructorCourse), async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const instructorId = c.req.param('instructorId');
      const { courseId } = c.req.valid('json');
      await assignOrgInstructorCourse(orgId, instructorId, courseId);

      return c.json({ success: true, data: { instructorId, courseId } }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to assign course');
    }
  })
  .delete('/:instructorId/courses/:courseId', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const instructorId = c.req.param('instructorId');
      const courseId = c.req.param('courseId');
      await unassignOrgInstructorCourse(orgId, instructorId, courseId);

      return c.json({ success: true, data: { instructorId, courseId } }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to unassign course');
    }
  });
