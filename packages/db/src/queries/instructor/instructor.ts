import * as schema from '@db/schema';

import { TInstructorCourse, TInstructorProfile, TNewInstructorProfile } from '@db/types';
import { and, eq } from 'drizzle-orm';

import { db } from '@db/drizzle';

export async function createInstructor(data: TNewInstructorProfile): Promise<TInstructorProfile> {
  try {
    const [row] = await db.insert(schema.instructorProfile).values(data).returning();

    if (!row) {
      throw new Error('Insert returned no row');
    }

    return row;
  } catch (error) {
    console.error('createInstructor error:', error);
    throw new Error('Failed to create instructor');
  }
}

export async function updateInstructor(
  id: string,
  orgId: string,
  patch: Partial<TNewInstructorProfile>
): Promise<TInstructorProfile | null> {
  try {
    const [row] = await db
      .update(schema.instructorProfile)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(and(eq(schema.instructorProfile.id, id), eq(schema.instructorProfile.orgId, orgId)))
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('updateInstructor error:', error);
    throw new Error('Failed to update instructor');
  }
}

export async function deleteInstructor(id: string, orgId: string): Promise<boolean> {
  try {
    const rows = await db
      .delete(schema.instructorProfile)
      .where(and(eq(schema.instructorProfile.id, id), eq(schema.instructorProfile.orgId, orgId)))
      .returning({ id: schema.instructorProfile.id });

    return rows.length > 0;
  } catch (error) {
    console.error('deleteInstructor error:', error);
    throw new Error('Failed to delete instructor');
  }
}

export async function getInstructorById(id: string, orgId: string): Promise<TInstructorProfile | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.instructorProfile)
      .where(and(eq(schema.instructorProfile.id, id), eq(schema.instructorProfile.orgId, orgId)))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getInstructorById error:', error);
    throw new Error('Failed to fetch instructor');
  }
}

export async function listInstructors(orgId: string): Promise<TInstructorProfile[]> {
  try {
    return await db
      .select()
      .from(schema.instructorProfile)
      .where(eq(schema.instructorProfile.orgId, orgId))
      .orderBy(schema.instructorProfile.fullname);
  } catch (error) {
    console.error('listInstructors error:', error);
    throw new Error('Failed to list instructors');
  }
}

/** Instructor↔course links (with course titles) for every instructor in the org. */
export async function listInstructorCourseLinks(
  orgId: string
): Promise<Array<{ instructorId: string; courseId: string; courseTitle: string }>> {
  try {
    return await db
      .select({
        instructorId: schema.instructorCourse.instructorId,
        courseId: schema.instructorCourse.courseId,
        courseTitle: schema.course.title
      })
      .from(schema.instructorCourse)
      .innerJoin(schema.instructorProfile, eq(schema.instructorProfile.id, schema.instructorCourse.instructorId))
      .innerJoin(schema.course, eq(schema.course.id, schema.instructorCourse.courseId))
      .where(eq(schema.instructorProfile.orgId, orgId));
  } catch (error) {
    console.error('listInstructorCourseLinks error:', error);
    throw new Error('Failed to list instructor course links');
  }
}

export async function assignInstructorToCourse(
  instructorId: string,
  courseId: string
): Promise<TInstructorCourse | null> {
  try {
    const [row] = await db
      .insert(schema.instructorCourse)
      .values({ instructorId, courseId })
      .onConflictDoNothing()
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('assignInstructorToCourse error:', error);
    throw new Error('Failed to assign instructor to course');
  }
}

export async function unassignInstructorFromCourse(instructorId: string, courseId: string): Promise<boolean> {
  try {
    const rows = await db
      .delete(schema.instructorCourse)
      .where(
        and(eq(schema.instructorCourse.instructorId, instructorId), eq(schema.instructorCourse.courseId, courseId))
      )
      .returning({ id: schema.instructorCourse.id });

    return rows.length > 0;
  } catch (error) {
    console.error('unassignInstructorFromCourse error:', error);
    throw new Error('Failed to unassign instructor from course');
  }
}
