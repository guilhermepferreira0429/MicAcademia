import * as schema from '@db/schema';

import { TAttendanceLog, TNewAttendanceLog } from '@db/types';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@db/drizzle';

/** Opens a presence interval (participant joined a live session). */
export async function createAttendanceEntry(data: TNewAttendanceLog): Promise<TAttendanceLog> {
  try {
    const [row] = await db.insert(schema.attendanceLog).values(data).returning();

    if (!row) {
      throw new Error('Insert returned no row');
    }

    return row;
  } catch (error) {
    console.error('createAttendanceEntry error:', error);
    throw new Error('Failed to create attendance entry');
  }
}

/** The still-open interval for a (lesson, profile), if any. */
export async function getOpenAttendanceEntry(lessonId: string, profileId: string): Promise<TAttendanceLog | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.attendanceLog)
      .where(
        and(
          eq(schema.attendanceLog.lessonId, lessonId),
          eq(schema.attendanceLog.profileId, profileId),
          isNull(schema.attendanceLog.leftAt)
        )
      )
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getOpenAttendanceEntry error:', error);
    throw new Error('Failed to fetch open attendance entry');
  }
}

/** Closes one interval, recording when the participant left and for how long. */
export async function closeAttendanceEntry(
  id: string,
  leftAtIso: string,
  durationSeconds: number
): Promise<TAttendanceLog | null> {
  try {
    const [row] = await db
      .update(schema.attendanceLog)
      .set({ leftAt: leftAtIso, durationSeconds, updatedAt: new Date().toISOString() })
      .where(eq(schema.attendanceLog.id, id))
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('closeAttendanceEntry error:', error);
    throw new Error('Failed to close attendance entry');
  }
}

/**
 * Closes every still-open interval of a lesson — safety net for when a room
 * ends without a clean `participant_left` for everyone.
 */
export async function closeOpenAttendanceEntriesForLesson(lessonId: string, leftAtIso: string): Promise<number> {
  try {
    const rows = await db
      .update(schema.attendanceLog)
      .set({
        leftAt: leftAtIso,
        durationSeconds: sql`GREATEST(0, EXTRACT(EPOCH FROM (${leftAtIso}::timestamptz - ${schema.attendanceLog.joinedAt}))::int)`,
        updatedAt: new Date().toISOString()
      })
      .where(and(eq(schema.attendanceLog.lessonId, lessonId), isNull(schema.attendanceLog.leftAt)))
      .returning({ id: schema.attendanceLog.id });

    return rows.length;
  } catch (error) {
    console.error('closeOpenAttendanceEntriesForLesson error:', error);
    throw new Error('Failed to close open attendance entries');
  }
}

export interface CourseAttendanceRow {
  lessonId: string;
  lessonTitle: string;
  lessonAt: string | null;
  profileId: string;
  fullname: string | null;
  source: string;
  joinedAt: string;
  leftAt: string | null;
  durationSeconds: number | null;
}

/** Every presence interval of a course (all sessions, online + in-person). */
export async function listAttendanceForCourse(courseId: string): Promise<CourseAttendanceRow[]> {
  try {
    return await db
      .select({
        lessonId: schema.attendanceLog.lessonId,
        lessonTitle: schema.lesson.title,
        lessonAt: schema.lesson.lessonAt,
        profileId: schema.attendanceLog.profileId,
        fullname: schema.profile.fullname,
        source: schema.attendanceLog.source,
        joinedAt: schema.attendanceLog.joinedAt,
        leftAt: schema.attendanceLog.leftAt,
        durationSeconds: schema.attendanceLog.durationSeconds
      })
      .from(schema.attendanceLog)
      .innerJoin(schema.lesson, eq(schema.lesson.id, schema.attendanceLog.lessonId))
      .innerJoin(schema.profile, eq(schema.profile.id, schema.attendanceLog.profileId))
      .where(eq(schema.attendanceLog.courseId, courseId))
      .orderBy(schema.attendanceLog.joinedAt);
  } catch (error) {
    console.error('listAttendanceForCourse error:', error);
    throw new Error('Failed to list attendance for course');
  }
}

/** All presence intervals recorded for a lesson. */
export async function listAttendanceForLesson(lessonId: string): Promise<TAttendanceLog[]> {
  try {
    return await db
      .select()
      .from(schema.attendanceLog)
      .where(eq(schema.attendanceLog.lessonId, lessonId))
      .orderBy(schema.attendanceLog.joinedAt);
  } catch (error) {
    console.error('listAttendanceForLesson error:', error);
    throw new Error('Failed to list attendance for lesson');
  }
}
