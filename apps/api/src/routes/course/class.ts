import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { courseTeamMemberMiddleware } from '@api/middlewares/course-team-member';
import { handleError } from '@api/utils/errors';
import { zValidator } from '@hono/zod-validator';
import { ZAddCourseClassMember, ZCreateCourseClass, ZUpdateCourseClass } from '@cio/utils/validation';
import {
  addStudentToClass,
  createClassForCourse,
  deleteClassForCourse,
  listClassStudents,
  listClassesForCourse,
  listOpenClassesForCourse,
  removeStudentFromClass,
  updateClassForCourse
} from '@api/services/course/class';

/**
 * Classes (turmas) of a course: dated, seat-limited editions students enrol in.
 * Management is course-team only; `/open` is the on-sale list any authenticated
 * student needs to pick a class before paying.
 */
export const classRouter = new Hono()
  .get('/open', authMiddleware, async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const classes = await listOpenClassesForCourse(courseId);

      return c.json({ success: true, data: classes }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to list open classes');
    }
  })
  .use('*', authMiddleware, courseTeamMemberMiddleware)
  .get('/', async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const classes = await listClassesForCourse(courseId);

      return c.json({ success: true, data: classes }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to list classes');
    }
  })
  .post('/', zValidator('json', ZCreateCourseClass), async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const created = await createClassForCourse(courseId, c.req.valid('json'));

      return c.json({ success: true, data: created }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to create class');
    }
  })
  .put('/:classId', zValidator('json', ZUpdateCourseClass), async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const updated = await updateClassForCourse(courseId, c.req.param('classId'), c.req.valid('json'));

      return c.json({ success: true, data: updated }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to update class');
    }
  })
  .delete('/:classId', async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const classId = c.req.param('classId');
      await deleteClassForCourse(courseId, classId);

      return c.json({ success: true, data: { id: classId } }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to delete class');
    }
  })
  .get('/:classId/students', async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const students = await listClassStudents(courseId, c.req.param('classId'));

      return c.json({ success: true, data: students }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to list class students');
    }
  })
  .post('/:classId/students', zValidator('json', ZAddCourseClassMember), async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const { profileId, status } = c.req.valid('json');
      const students = await addStudentToClass(courseId, c.req.param('classId'), profileId, status ?? 'confirmed');

      return c.json({ success: true, data: students }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to add student to class');
    }
  })
  .delete('/:classId/students/:profileId', async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const students = await removeStudentFromClass(courseId, c.req.param('classId'), c.req.param('profileId'));

      return c.json({ success: true, data: students }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to remove student from class');
    }
  });
