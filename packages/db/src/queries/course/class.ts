import * as schema from '@db/schema';

import { TCourseClass, TCourseClassMember, TNewCourseClass, TNewCourseClassMember } from '@db/types';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';

import { db } from '@db/drizzle';

/**
 * Seats that count against capacity: everything except cancelled. A reserved
 * seat (payment pending) holds capacity so the same seat is not sold twice.
 */
const HOLDS_A_SEAT = ne(schema.courseClassMember.status, 'cancelled');

export interface CourseClassRow extends TCourseClass {
  takenSeats: number;
  confirmedSeats: number;
  instructorName: string | null;
}

async function decorate(rows: TCourseClass[]): Promise<CourseClassRow[]> {
  if (rows.length === 0) return [];

  const classIds = rows.map((row) => row.id);
  const instructorIds = rows.map((row) => row.instructorId).filter((id): id is string => Boolean(id));

  const [counts, instructors] = await Promise.all([
    db
      .select({
        classId: schema.courseClassMember.classId,
        taken: sql<number>`count(*)`,
        confirmed: sql<number>`count(*) filter (where ${schema.courseClassMember.status} = 'confirmed')`
      })
      .from(schema.courseClassMember)
      .where(and(inArray(schema.courseClassMember.classId, classIds), HOLDS_A_SEAT))
      .groupBy(schema.courseClassMember.classId),
    instructorIds.length > 0
      ? db
          .select({ id: schema.instructorProfile.id, fullname: schema.instructorProfile.fullname })
          .from(schema.instructorProfile)
          .where(inArray(schema.instructorProfile.id, instructorIds))
      : Promise.resolve([] as Array<{ id: string; fullname: string }>)
  ]);

  const countByClass = new Map(counts.map((row) => [row.classId, row]));
  const nameByInstructor = new Map(instructors.map((row) => [row.id, row.fullname]));

  return rows.map((row) => ({
    ...row,
    takenSeats: Number(countByClass.get(row.id)?.taken ?? 0),
    confirmedSeats: Number(countByClass.get(row.id)?.confirmed ?? 0),
    instructorName: row.instructorId ? (nameByInstructor.get(row.instructorId) ?? null) : null
  }));
}

export async function listCourseClasses(courseId: string): Promise<CourseClassRow[]> {
  try {
    const rows = await db
      .select()
      .from(schema.courseClass)
      .where(eq(schema.courseClass.courseId, courseId))
      // Undated classes sort last, so the next run to start is always on top.
      .orderBy(sql`${schema.courseClass.startsOn} asc nulls last`, asc(schema.courseClass.createdAt));

    return decorate(rows);
  } catch (error) {
    console.error('listCourseClasses error:', error);
    throw new Error('Failed to list course classes');
  }
}

/** A single class with its seat counts — the shape every guard reads. */
export async function getCourseClassById(id: string): Promise<CourseClassRow | null> {
  try {
    const [row] = await db.select().from(schema.courseClass).where(eq(schema.courseClass.id, id)).limit(1);
    if (!row) return null;

    const [decorated] = await decorate([row]);

    return decorated ?? null;
  } catch (error) {
    console.error('getCourseClassById error:', error);
    throw new Error('Failed to fetch course class');
  }
}

export async function createCourseClass(data: TNewCourseClass): Promise<TCourseClass> {
  try {
    const [row] = await db.insert(schema.courseClass).values(data).returning();

    if (!row) {
      throw new Error('Insert returned no row');
    }

    return row;
  } catch (error) {
    console.error('createCourseClass error:', error);
    throw new Error('Failed to create course class');
  }
}

export async function updateCourseClass(
  id: string,
  courseId: string,
  patch: Partial<TNewCourseClass>
): Promise<TCourseClass | null> {
  try {
    const [row] = await db
      .update(schema.courseClass)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(and(eq(schema.courseClass.id, id), eq(schema.courseClass.courseId, courseId)))
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('updateCourseClass error:', error);
    throw new Error('Failed to update course class');
  }
}

export async function deleteCourseClass(id: string, courseId: string): Promise<boolean> {
  try {
    const rows = await db
      .delete(schema.courseClass)
      .where(and(eq(schema.courseClass.id, id), eq(schema.courseClass.courseId, courseId)))
      .returning({ id: schema.courseClass.id });

    return rows.length > 0;
  } catch (error) {
    console.error('deleteCourseClass error:', error);
    throw new Error('Failed to delete course class');
  }
}

// ─── Seats ───────────────────────────────────────────────────────────────────

export interface CourseClassMemberRow {
  id: string;
  profileId: string;
  fullname: string | null;
  email: string | null;
  status: string;
  createdAt: string;
}

export async function listCourseClassMembers(classId: string): Promise<CourseClassMemberRow[]> {
  try {
    return await db
      .select({
        id: schema.courseClassMember.id,
        profileId: schema.courseClassMember.profileId,
        fullname: schema.profile.fullname,
        email: schema.profile.email,
        status: schema.courseClassMember.status,
        createdAt: schema.courseClassMember.createdAt
      })
      .from(schema.courseClassMember)
      .innerJoin(schema.profile, eq(schema.profile.id, schema.courseClassMember.profileId))
      .where(eq(schema.courseClassMember.classId, classId))
      .orderBy(schema.profile.fullname);
  } catch (error) {
    console.error('listCourseClassMembers error:', error);
    throw new Error('Failed to list class members');
  }
}

export async function getCourseClassMember(classId: string, profileId: string): Promise<TCourseClassMember | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.courseClassMember)
      .where(and(eq(schema.courseClassMember.classId, classId), eq(schema.courseClassMember.profileId, profileId)))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getCourseClassMember error:', error);
    throw new Error('Failed to fetch class member');
  }
}

/**
 * Takes a seat, re-using the student's existing row if they already had one
 * (a cancelled or expired reservation is revived rather than duplicated —
 * the unique (class, profile) constraint allows only one row per student).
 */
export async function upsertCourseClassMember(data: TNewCourseClassMember): Promise<TCourseClassMember> {
  try {
    const [row] = await db
      .insert(schema.courseClassMember)
      .values(data)
      .onConflictDoUpdate({
        target: [schema.courseClassMember.classId, schema.courseClassMember.profileId],
        set: {
          status: data.status ?? 'reserved',
          paymentId: data.paymentId ?? null,
          reservedUntil: data.reservedUntil ?? null,
          updatedAt: new Date().toISOString()
        }
      })
      .returning();

    if (!row) {
      throw new Error('Upsert returned no row');
    }

    return row;
  } catch (error) {
    console.error('upsertCourseClassMember error:', error);
    throw new Error('Failed to take class seat');
  }
}

export async function setCourseClassMemberStatus(
  classId: string,
  profileId: string,
  status: string
): Promise<TCourseClassMember | null> {
  try {
    const [row] = await db
      .update(schema.courseClassMember)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(and(eq(schema.courseClassMember.classId, classId), eq(schema.courseClassMember.profileId, profileId)))
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('setCourseClassMemberStatus error:', error);
    throw new Error('Failed to update class seat');
  }
}

/** Seat held by a payment — how the payment webhook finds the seat to confirm or release. */
export async function setCourseClassMemberStatusByPayment(
  paymentId: string,
  status: string
): Promise<TCourseClassMember | null> {
  try {
    const [row] = await db
      .update(schema.courseClassMember)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(schema.courseClassMember.paymentId, paymentId))
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('setCourseClassMemberStatusByPayment error:', error);
    throw new Error('Failed to update class seat by payment');
  }
}

/** The class a student holds a live seat in, for a given course. */
export async function getStudentClassForCourse(courseId: string, profileId: string): Promise<TCourseClass | null> {
  try {
    const [row] = await db
      .select({ classRow: schema.courseClass })
      .from(schema.courseClassMember)
      .innerJoin(schema.courseClass, eq(schema.courseClass.id, schema.courseClassMember.classId))
      .where(
        and(eq(schema.courseClass.courseId, courseId), eq(schema.courseClassMember.profileId, profileId), HOLDS_A_SEAT)
      )
      .limit(1);

    return row?.classRow ?? null;
  } catch (error) {
    console.error('getStudentClassForCourse error:', error);
    throw new Error('Failed to fetch student class');
  }
}
