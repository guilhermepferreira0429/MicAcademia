import { AppError, ErrorCodes } from '@api/utils/errors';
import {
  addCompanyMember,
  createCompany,
  createCompanyEnrollment,
  deleteCompany,
  getCompanyById,
  listCompanies,
  listCompanyEnrollments,
  listCompanyMembers,
  listCompanyTraining,
  removeCompanyMember,
  sumAttendanceByProfileAndCourse,
  sumAttendanceByProfileForPeriod,
  updateCompany,
  updateCompanyEnrollment,
  type CompanyEnrollmentRow,
  type CompanyListRow,
  type CompanyMemberRow
} from '@cio/db/queries/company';
import { getCourseWithRelations } from '@cio/db/queries/course';
import type { TCompany, TNewCompany } from '@cio/db/types';
import type {
  TAddCompanyMember,
  TCompanyBulkEnroll,
  TCreateCompany,
  TUpdateCompany,
  TUpdateCompanyEnrollment
} from '@cio/utils/validation';
import { grantCourseAccessForPayment } from '@api/services/course/invite';

/**
 * B2B company accounts. Companies buy training for their staff (the legal
 * 40h/year obligation), so seats are enrolled in bulk and billed once to the
 * company rather than paid individually by each employee.
 */

/** Empty strings from forms mean "not set". */
function normalize(data: TCreateCompany | TUpdateCompany): Partial<TNewCompany> {
  const patch: Partial<TNewCompany> = { ...data };

  for (const key of ['nif', 'email', 'phone', 'address', 'notes'] as const) {
    if (patch[key] === '') patch[key] = null;
  }

  return patch;
}

async function requireCompany(orgId: string, companyId: string): Promise<TCompany> {
  const found = await getCompanyById(companyId, orgId);
  if (!found) {
    throw new AppError('Company not found', ErrorCodes.NOT_FOUND, 404);
  }

  return found;
}

export async function listOrgCompanies(orgId: string): Promise<CompanyListRow[]> {
  return listCompanies(orgId);
}

export async function createOrgCompany(orgId: string, data: TCreateCompany): Promise<TCompany> {
  return createCompany({ orgId, name: data.name, ...normalize(data) });
}

export async function updateOrgCompany(orgId: string, id: string, data: TUpdateCompany): Promise<TCompany> {
  const updated = await updateCompany(id, orgId, normalize(data));
  if (!updated) {
    throw new AppError('Company not found', ErrorCodes.NOT_FOUND, 404);
  }

  return updated;
}

export async function deleteOrgCompany(orgId: string, id: string): Promise<void> {
  const deleted = await deleteCompany(id, orgId);
  if (!deleted) {
    throw new AppError('Company not found', ErrorCodes.NOT_FOUND, 404);
  }
}

export interface CompanyDetail {
  company: TCompany;
  members: CompanyMemberRow[];
  enrollments: CompanyEnrollmentRow[];
}

export async function getOrgCompanyDetail(orgId: string, companyId: string): Promise<CompanyDetail> {
  const found = await requireCompany(orgId, companyId);
  const [members, enrollments] = await Promise.all([listCompanyMembers(companyId), listCompanyEnrollments(companyId)]);

  return { company: found, members, enrollments };
}

export async function addOrgCompanyMember(
  orgId: string,
  companyId: string,
  data: TAddCompanyMember
): Promise<CompanyMemberRow[]> {
  await requireCompany(orgId, companyId);
  await addCompanyMember({
    companyId,
    profileId: data.profileId,
    role: data.role ?? 'employee',
    jobTitle: data.jobTitle ?? null
  });

  return listCompanyMembers(companyId);
}

export async function removeOrgCompanyMember(
  orgId: string,
  companyId: string,
  profileId: string
): Promise<CompanyMemberRow[]> {
  await requireCompany(orgId, companyId);
  await removeCompanyMember(companyId, profileId);

  return listCompanyMembers(companyId);
}

export interface BulkEnrollResult {
  enrolled: number;
  alreadyEnrolled: number;
  failed: number;
  enrollment: CompanyEnrollmentRow | null;
}

/**
 * Enrols a batch of the company's staff into a course and records one order for
 * the whole batch, so the company gets a single invoice. Individual failures do
 * not abort the batch — they are counted and reported.
 */
export async function bulkEnrollCompany(
  orgId: string,
  companyId: string,
  data: TCompanyBulkEnroll,
  createdBy: string
): Promise<BulkEnrollResult> {
  await requireCompany(orgId, companyId);

  const course = await getCourseWithRelations(data.courseId);
  if (!course) {
    throw new AppError('Course not found', ErrorCodes.COURSE_NOT_FOUND, 404);
  }

  const members = await listCompanyMembers(companyId);
  const emailByProfile = new Map(members.map((member) => [member.profileId, member.email]));

  let enrolled = 0;
  let alreadyEnrolled = 0;
  let failed = 0;

  for (const profileId of data.profileIds) {
    const email = emailByProfile.get(profileId);
    if (!email) {
      failed++;
      continue;
    }

    try {
      const result = await grantCourseAccessForPayment({ courseId: data.courseId, profileId, email });
      if (result.alreadyJoined) {
        alreadyEnrolled++;
      } else {
        enrolled++;
      }
    } catch (error) {
      failed++;
      console.error('bulkEnrollCompany: could not enrol', profileId, error instanceof Error ? error.message : error);
    }
  }

  const seats = enrolled + alreadyEnrolled;
  const unitPriceCents = data.unitPriceCents ?? Math.round(Number(course.cost ?? 0) * 100);

  const order = await createCompanyEnrollment({
    companyId,
    courseId: data.courseId,
    seats,
    unitPriceCents,
    totalCents: seats * unitPriceCents,
    status: 'pending',
    createdBy
  });

  return {
    enrolled,
    alreadyEnrolled,
    failed,
    enrollment: { ...order, courseTitle: course.title }
  };
}

export async function updateOrgCompanyEnrollment(
  orgId: string,
  companyId: string,
  enrollmentId: string,
  data: TUpdateCompanyEnrollment
): Promise<CompanyEnrollmentRow[]> {
  await requireCompany(orgId, companyId);

  const updated = await updateCompanyEnrollment(enrollmentId, companyId, {
    ...data,
    invoiceReference: data.invoiceReference === '' ? null : data.invoiceReference
  });
  if (!updated) {
    throw new AppError('Order not found', ErrorCodes.NOT_FOUND, 404);
  }

  return listCompanyEnrollments(companyId);
}

/** Portuguese labour law: 40 hours of continuous training per worker per year. */
export const LEGAL_ANNUAL_TRAINING_HOURS = 40;

export interface AnnualTrainingReport {
  companyId: string;
  year: number;
  requiredHours: number;
  summary: { employees: number; met: number; totalHours: number };
  employees: Array<{
    profileId: string;
    fullname: string | null;
    jobTitle: string | null;
    hours: number;
    remainingHours: number;
    percent: number;
    met: boolean;
  }>;
}

/**
 * How each employee stands against the annual training obligation — the number
 * an HR contact actually asks for ("João: 22 of 40 hours this year").
 * Hours come from real attended time (online + in-person), not enrolments.
 */
export async function getCompanyAnnualTraining(
  orgId: string,
  companyId: string,
  year: number
): Promise<AnnualTrainingReport> {
  const found = await requireCompany(orgId, companyId);
  const requiredHours = found.annualTrainingHours ?? LEGAL_ANNUAL_TRAINING_HOURS;

  const members = await listCompanyMembers(companyId);
  const profileIds = members.map((member) => member.profileId);

  const from = new Date(Date.UTC(year, 0, 1)).toISOString();
  const to = new Date(Date.UTC(year + 1, 0, 1)).toISOString();
  const attendance = await sumAttendanceByProfileForPeriod(profileIds, from, to);
  const secondsByProfile = new Map(attendance.map((row) => [row.profileId, row.seconds]));

  const employees = members.map((member) => {
    const hours = Math.round(((secondsByProfile.get(member.profileId) ?? 0) / 3600) * 10) / 10;

    return {
      profileId: member.profileId,
      fullname: member.fullname,
      jobTitle: member.jobTitle,
      hours,
      remainingHours: Math.max(0, Math.round((requiredHours - hours) * 10) / 10),
      percent: requiredHours > 0 ? Math.min(100, Math.round((hours / requiredHours) * 100)) : 0,
      met: hours >= requiredHours
    };
  });

  return {
    companyId,
    year,
    requiredHours,
    summary: {
      employees: employees.length,
      met: employees.filter((employee) => employee.met).length,
      totalHours: Math.round(employees.reduce((total, employee) => total + employee.hours, 0) * 10) / 10
    },
    employees
  };
}

export interface CompanyTrainingReport {
  companyId: string;
  employees: Array<{
    profileId: string;
    fullname: string | null;
    email: string | null;
    jobTitle: string | null;
    totalSeconds: number;
    courses: Array<{
      courseId: string;
      title: string;
      enrolledAt: string | null;
      certificateEarnedAt: string | null;
      attendedSeconds: number;
    }>;
  }>;
}

/**
 * "Who has done what" for the company's HR contact: every employee, the courses
 * they are on, hours actually attended and whether the certificate was earned.
 */
export async function getCompanyTrainingReport(orgId: string, companyId: string): Promise<CompanyTrainingReport> {
  await requireCompany(orgId, companyId);

  const members = await listCompanyMembers(companyId);
  const profileIds = members.map((member) => member.profileId);

  const [training, attendance] = await Promise.all([
    listCompanyTraining(profileIds),
    sumAttendanceByProfileAndCourse(profileIds)
  ]);

  const secondsByKey = new Map(attendance.map((row) => [`${row.profileId}:${row.courseId}`, row.seconds]));

  const employees = members.map((member) => {
    const courses = training
      .filter((row) => row.profileId === member.profileId)
      .map((row) => ({
        courseId: row.courseId,
        title: row.courseTitle,
        enrolledAt: row.enrolledAt,
        certificateEarnedAt: row.certificateEarnedAt,
        attendedSeconds: secondsByKey.get(`${member.profileId}:${row.courseId}`) ?? 0
      }));

    return {
      profileId: member.profileId,
      fullname: member.fullname,
      email: member.email,
      jobTitle: member.jobTitle,
      totalSeconds: courses.reduce((total, course) => total + course.attendedSeconds, 0),
      courses
    };
  });

  return { companyId, employees };
}
