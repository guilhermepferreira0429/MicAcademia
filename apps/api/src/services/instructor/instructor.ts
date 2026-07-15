import { AppError, ErrorCodes } from '@api/utils/errors';
import {
  assignInstructorToCourse,
  createInstructor,
  deleteInstructor,
  getInstructorById,
  listInstructorCourseLinks,
  listInstructors,
  unassignInstructorFromCourse,
  updateInstructor
} from '@cio/db/queries/instructor';
import type { TInstructorProfile, TNewInstructorProfile } from '@cio/db/types';
import type { TCreateInstructor, TUpdateInstructor } from '@cio/utils/validation';

export type InstructorWithCourses = TInstructorProfile & {
  courses: Array<{ courseId: string; title: string }>;
};

/** Normalizes form values: empty strings become null so the DB stores absence, not ''. */
function normalize(data: TCreateInstructor | TUpdateInstructor): Partial<TNewInstructorProfile> {
  const patch: Partial<TNewInstructorProfile> = { ...data };

  if (patch.email === '') patch.email = null;
  if (patch.ccpValidUntil === '') patch.ccpValidUntil = null;

  return patch;
}

export async function createOrgInstructor(orgId: string, data: TCreateInstructor): Promise<TInstructorProfile> {
  return createInstructor({ orgId, fullname: data.fullname, ...normalize(data) });
}

export async function updateOrgInstructor(
  orgId: string,
  id: string,
  data: TUpdateInstructor
): Promise<TInstructorProfile> {
  const updated = await updateInstructor(id, orgId, normalize(data));
  if (!updated) {
    throw new AppError('Instructor not found', ErrorCodes.NOT_FOUND, 404);
  }

  return updated;
}

export async function deleteOrgInstructor(orgId: string, id: string): Promise<void> {
  const deleted = await deleteInstructor(id, orgId);
  if (!deleted) {
    throw new AppError('Instructor not found', ErrorCodes.NOT_FOUND, 404);
  }
}

/** Instructors of an org, each enriched with their assigned courses. */
export async function listOrgInstructors(orgId: string): Promise<InstructorWithCourses[]> {
  const [instructors, links] = await Promise.all([listInstructors(orgId), listInstructorCourseLinks(orgId)]);

  const coursesByInstructor = new Map<string, Array<{ courseId: string; title: string }>>();
  for (const link of links) {
    const list = coursesByInstructor.get(link.instructorId) ?? [];
    list.push({ courseId: link.courseId, title: link.courseTitle });
    coursesByInstructor.set(link.instructorId, list);
  }

  return instructors.map((instructor) => ({
    ...instructor,
    courses: coursesByInstructor.get(instructor.id) ?? []
  }));
}

export async function assignOrgInstructorCourse(orgId: string, instructorId: string, courseId: string): Promise<void> {
  const instructor = await getInstructorById(instructorId, orgId);
  if (!instructor) {
    throw new AppError('Instructor not found', ErrorCodes.NOT_FOUND, 404);
  }

  await assignInstructorToCourse(instructorId, courseId);
}

export async function unassignOrgInstructorCourse(
  orgId: string,
  instructorId: string,
  courseId: string
): Promise<void> {
  const instructor = await getInstructorById(instructorId, orgId);
  if (!instructor) {
    throw new AppError('Instructor not found', ErrorCodes.NOT_FOUND, 404);
  }

  await unassignInstructorFromCourse(instructorId, courseId);
}
