import * as schema from '@db/schema';

import {
  TCompany,
  TCompanyEnrollment,
  TCompanyMember,
  TNewCompany,
  TNewCompanyEnrollment,
  TNewCompanyMember
} from '@db/types';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';

import { db } from '@db/drizzle';

// ─── Companies ───────────────────────────────────────────────────────────────

export async function createCompany(data: TNewCompany): Promise<TCompany> {
  try {
    const [row] = await db.insert(schema.company).values(data).returning();

    if (!row) {
      throw new Error('Insert returned no row');
    }

    return row;
  } catch (error) {
    console.error('createCompany error:', error);
    throw new Error('Failed to create company');
  }
}

export async function updateCompany(id: string, orgId: string, patch: Partial<TNewCompany>): Promise<TCompany | null> {
  try {
    const [row] = await db
      .update(schema.company)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(and(eq(schema.company.id, id), eq(schema.company.orgId, orgId)))
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('updateCompany error:', error);
    throw new Error('Failed to update company');
  }
}

export async function deleteCompany(id: string, orgId: string): Promise<boolean> {
  try {
    const rows = await db
      .delete(schema.company)
      .where(and(eq(schema.company.id, id), eq(schema.company.orgId, orgId)))
      .returning({ id: schema.company.id });

    return rows.length > 0;
  } catch (error) {
    console.error('deleteCompany error:', error);
    throw new Error('Failed to delete company');
  }
}

export async function getCompanyById(id: string, orgId: string): Promise<TCompany | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.company)
      .where(and(eq(schema.company.id, id), eq(schema.company.orgId, orgId)))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getCompanyById error:', error);
    throw new Error('Failed to fetch company');
  }
}

export interface CompanyListRow extends TCompany {
  memberCount: number;
}

/** Companies of an org with their headcount. */
export async function listCompanies(orgId: string): Promise<CompanyListRow[]> {
  try {
    const rows = await db
      .select({
        companyRow: schema.company,
        memberCount: sql<number>`count(${schema.companyMember.id})`
      })
      .from(schema.company)
      .leftJoin(schema.companyMember, eq(schema.companyMember.companyId, schema.company.id))
      .where(eq(schema.company.orgId, orgId))
      .groupBy(schema.company.id)
      .orderBy(schema.company.name);

    return rows.map((row) => ({ ...row.companyRow, memberCount: Number(row.memberCount) }));
  } catch (error) {
    console.error('listCompanies error:', error);
    throw new Error('Failed to list companies');
  }
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function addCompanyMember(data: TNewCompanyMember): Promise<TCompanyMember | null> {
  try {
    const [row] = await db.insert(schema.companyMember).values(data).onConflictDoNothing().returning();

    return row ?? null;
  } catch (error) {
    console.error('addCompanyMember error:', error);
    throw new Error('Failed to add company member');
  }
}

export async function removeCompanyMember(companyId: string, profileId: string): Promise<boolean> {
  try {
    const rows = await db
      .delete(schema.companyMember)
      .where(and(eq(schema.companyMember.companyId, companyId), eq(schema.companyMember.profileId, profileId)))
      .returning({ id: schema.companyMember.id });

    return rows.length > 0;
  } catch (error) {
    console.error('removeCompanyMember error:', error);
    throw new Error('Failed to remove company member');
  }
}

export interface CompanyMemberRow {
  profileId: string;
  fullname: string | null;
  email: string | null;
  role: string;
  jobTitle: string | null;
}

export async function listCompanyMembers(companyId: string): Promise<CompanyMemberRow[]> {
  try {
    return await db
      .select({
        profileId: schema.companyMember.profileId,
        fullname: schema.profile.fullname,
        email: schema.profile.email,
        role: schema.companyMember.role,
        jobTitle: schema.companyMember.jobTitle
      })
      .from(schema.companyMember)
      .innerJoin(schema.profile, eq(schema.profile.id, schema.companyMember.profileId))
      .where(eq(schema.companyMember.companyId, companyId))
      .orderBy(schema.profile.fullname);
  } catch (error) {
    console.error('listCompanyMembers error:', error);
    throw new Error('Failed to list company members');
  }
}

// ─── Orders (bulk enrolments) ────────────────────────────────────────────────

export async function createCompanyEnrollment(data: TNewCompanyEnrollment): Promise<TCompanyEnrollment> {
  try {
    const [row] = await db.insert(schema.companyEnrollment).values(data).returning();

    if (!row) {
      throw new Error('Insert returned no row');
    }

    return row;
  } catch (error) {
    console.error('createCompanyEnrollment error:', error);
    throw new Error('Failed to create company enrollment');
  }
}

export async function updateCompanyEnrollment(
  id: string,
  companyId: string,
  patch: Partial<TNewCompanyEnrollment>
): Promise<TCompanyEnrollment | null> {
  try {
    const [row] = await db
      .update(schema.companyEnrollment)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(and(eq(schema.companyEnrollment.id, id), eq(schema.companyEnrollment.companyId, companyId)))
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('updateCompanyEnrollment error:', error);
    throw new Error('Failed to update company enrollment');
  }
}

export interface CompanyEnrollmentRow extends TCompanyEnrollment {
  courseTitle: string;
}

export async function listCompanyEnrollments(companyId: string): Promise<CompanyEnrollmentRow[]> {
  try {
    const rows = await db
      .select({ enrollment: schema.companyEnrollment, courseTitle: schema.course.title })
      .from(schema.companyEnrollment)
      .innerJoin(schema.course, eq(schema.course.id, schema.companyEnrollment.courseId))
      .where(eq(schema.companyEnrollment.companyId, companyId))
      .orderBy(desc(schema.companyEnrollment.createdAt));

    return rows.map((row) => ({ ...row.enrollment, courseTitle: row.courseTitle }));
  } catch (error) {
    console.error('listCompanyEnrollments error:', error);
    throw new Error('Failed to list company enrollments');
  }
}

// ─── HR report ───────────────────────────────────────────────────────────────

export interface CompanyTrainingRow {
  /** Nullable because groupmember rows can be email-only invites. */
  profileId: string | null;
  courseId: string;
  courseTitle: string;
  enrolledAt: string | null;
  certificateEarnedAt: string | null;
}

/** Course enrolments of a company's staff — the "who did what" backbone. */
export async function listCompanyTraining(profileIds: string[]): Promise<CompanyTrainingRow[]> {
  if (profileIds.length === 0) return [];

  try {
    return await db
      .select({
        profileId: schema.groupmember.profileId,
        courseId: schema.course.id,
        courseTitle: schema.course.title,
        enrolledAt: schema.groupmember.createdAt,
        certificateEarnedAt: schema.groupmember.certificateEarnedAt
      })
      .from(schema.groupmember)
      .innerJoin(schema.group, eq(schema.group.id, schema.groupmember.groupId))
      .innerJoin(schema.course, eq(schema.course.groupId, schema.group.id))
      .where(inArray(schema.groupmember.profileId, profileIds))
      .orderBy(schema.course.title);
  } catch (error) {
    console.error('listCompanyTraining error:', error);
    throw new Error('Failed to list company training');
  }
}

/**
 * Attended seconds per employee within a period — backs the legal annual
 * training-hours obligation (40h/year in Portugal).
 */
export async function sumAttendanceByProfileForPeriod(
  profileIds: string[],
  fromIso: string,
  toIso: string
): Promise<Array<{ profileId: string; seconds: number }>> {
  if (profileIds.length === 0) return [];

  try {
    const rows = await db
      .select({
        profileId: schema.attendanceLog.profileId,
        seconds: sql<number>`coalesce(sum(${schema.attendanceLog.durationSeconds}), 0)`
      })
      .from(schema.attendanceLog)
      .where(
        and(
          inArray(schema.attendanceLog.profileId, profileIds),
          gte(schema.attendanceLog.joinedAt, fromIso),
          lt(schema.attendanceLog.joinedAt, toIso)
        )
      )
      .groupBy(schema.attendanceLog.profileId);

    return rows.map((row) => ({ ...row, seconds: Number(row.seconds) }));
  } catch (error) {
    console.error('sumAttendanceByProfileForPeriod error:', error);
    throw new Error('Failed to sum attendance for period');
  }
}

/** Attended seconds per (profile, course) — feeds the hours each employee has done. */
export async function sumAttendanceByProfileAndCourse(
  profileIds: string[]
): Promise<Array<{ profileId: string; courseId: string; seconds: number }>> {
  if (profileIds.length === 0) return [];

  try {
    const rows = await db
      .select({
        profileId: schema.attendanceLog.profileId,
        courseId: schema.attendanceLog.courseId,
        seconds: sql<number>`coalesce(sum(${schema.attendanceLog.durationSeconds}), 0)`
      })
      .from(schema.attendanceLog)
      .where(inArray(schema.attendanceLog.profileId, profileIds))
      .groupBy(schema.attendanceLog.profileId, schema.attendanceLog.courseId);

    return rows.map((row) => ({ ...row, seconds: Number(row.seconds) }));
  } catch (error) {
    console.error('sumAttendanceByProfileAndCourse error:', error);
    throw new Error('Failed to sum attendance');
  }
}
