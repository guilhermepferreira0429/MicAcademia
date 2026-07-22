import * as schema from '@db/schema';

import { TNewSigoSubmission, TSigoSubmission } from '@db/types';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '@db/drizzle';

export interface SigoSubmissionRow extends TSigoSubmission {
  courseTitle: string;
  /** SIGO config carried on the course (set in the certificate settings). */
  courseSigo: {
    trainingEntity?: string;
    trainingAction?: string;
    ufcdCode?: string;
    totalHours?: number;
    startDate?: string;
    endDate?: string;
  } | null;
}

export async function createSigoSubmission(data: TNewSigoSubmission): Promise<TSigoSubmission> {
  try {
    const [row] = await db.insert(schema.sigoSubmission).values(data).returning();

    if (!row) {
      throw new Error('Insert returned no row');
    }

    return row;
  } catch (error) {
    console.error('createSigoSubmission error:', error);
    throw new Error('Failed to create SIGO submission');
  }
}

export async function updateSigoSubmission(
  id: string,
  orgId: string,
  patch: Partial<TNewSigoSubmission>
): Promise<TSigoSubmission | null> {
  try {
    const [row] = await db
      .update(schema.sigoSubmission)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(and(eq(schema.sigoSubmission.id, id), eq(schema.sigoSubmission.orgId, orgId)))
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('updateSigoSubmission error:', error);
    throw new Error('Failed to update SIGO submission');
  }
}

export async function deleteSigoSubmission(id: string, orgId: string): Promise<boolean> {
  try {
    const rows = await db
      .delete(schema.sigoSubmission)
      .where(and(eq(schema.sigoSubmission.id, id), eq(schema.sigoSubmission.orgId, orgId)))
      .returning({ id: schema.sigoSubmission.id });

    return rows.length > 0;
  } catch (error) {
    console.error('deleteSigoSubmission error:', error);
    throw new Error('Failed to delete SIGO submission');
  }
}

/** Submissions of an org, newest first, enriched with the course's SIGO config. */
export async function listSigoSubmissions(orgId: string): Promise<SigoSubmissionRow[]> {
  try {
    const rows = await db
      .select({
        submission: schema.sigoSubmission,
        courseTitle: schema.course.title,
        certificate: schema.course.certificate
      })
      .from(schema.sigoSubmission)
      .innerJoin(schema.course, eq(schema.course.id, schema.sigoSubmission.courseId))
      .where(eq(schema.sigoSubmission.orgId, orgId))
      .orderBy(desc(schema.sigoSubmission.createdAt));

    return rows.map((row) => ({
      ...row.submission,
      courseTitle: row.courseTitle,
      courseSigo: row.certificate?.sigo ?? null
    }));
  } catch (error) {
    console.error('listSigoSubmissions error:', error);
    throw new Error('Failed to list SIGO submissions');
  }
}
