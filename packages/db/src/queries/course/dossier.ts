import * as schema from '@db/schema';

import { and, eq } from 'drizzle-orm';

import { ROLE } from '@cio/utils/constants';
import { db } from '@db/drizzle';

/**
 * Queries backing the audit dossier — the pack DGERT/IEFP ask for when they
 * audit a training action: who taught it (and with what credentials), who
 * attended, and who was certified.
 */

export interface DossierTrainerRow {
  fullname: string;
  email: string | null;
  ccpNumber: string | null;
  ccpValidUntil: string | null;
  specialization: string | null;
  contractStatus: string;
  ipCessionStatus: string;
}

/** Instructors assigned to a course, with the credentials an auditor checks. */
export async function listCourseInstructorsForDossier(courseId: string): Promise<DossierTrainerRow[]> {
  try {
    return await db
      .select({
        fullname: schema.instructorProfile.fullname,
        email: schema.instructorProfile.email,
        ccpNumber: schema.instructorProfile.ccpNumber,
        ccpValidUntil: schema.instructorProfile.ccpValidUntil,
        specialization: schema.instructorProfile.specialization,
        contractStatus: schema.instructorProfile.contractStatus,
        ipCessionStatus: schema.instructorProfile.ipCessionStatus
      })
      .from(schema.instructorCourse)
      .innerJoin(schema.instructorProfile, eq(schema.instructorProfile.id, schema.instructorCourse.instructorId))
      .where(eq(schema.instructorCourse.courseId, courseId))
      .orderBy(schema.instructorProfile.fullname);
  } catch (error) {
    console.error('listCourseInstructorsForDossier error:', error);
    throw new Error('Failed to list course instructors');
  }
}

export interface DossierStudentRow {
  profileId: string | null;
  fullname: string | null;
  email: string | null;
  /** Tax number — SIGO certificates identify trainees by NIF. */
  nif: string | null;
  certificateEarnedAt: string | null;
}

/** Enrolled students with the identifiers and certificate status a dossier needs. */
export async function listCourseStudentsForDossier(courseId: string): Promise<DossierStudentRow[]> {
  try {
    return await db
      .select({
        profileId: schema.groupmember.profileId,
        fullname: schema.profile.fullname,
        email: schema.profile.email,
        nif: schema.profile.nif,
        certificateEarnedAt: schema.groupmember.certificateEarnedAt
      })
      .from(schema.groupmember)
      .innerJoin(schema.group, eq(schema.group.id, schema.groupmember.groupId))
      .innerJoin(schema.course, eq(schema.course.groupId, schema.group.id))
      .innerJoin(schema.profile, eq(schema.profile.id, schema.groupmember.profileId))
      .where(and(eq(schema.course.id, courseId), eq(schema.groupmember.roleId, ROLE.STUDENT)))
      .orderBy(schema.profile.fullname);
  } catch (error) {
    console.error('listCourseStudentsForDossier error:', error);
    throw new Error('Failed to list course students');
  }
}
