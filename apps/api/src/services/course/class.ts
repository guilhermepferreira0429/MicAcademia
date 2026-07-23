import { AppError, ErrorCodes } from '@api/utils/errors';
import {
  createCourseClass,
  deleteCourseClass,
  getCourseClassById,
  getCourseWithRelations,
  listCourseClassMembers,
  listCourseClasses,
  setCourseClassMemberStatus,
  updateCourseClass,
  upsertCourseClassMember,
  type CourseClassMemberRow,
  type CourseClassRow
} from '@cio/db/queries/course';
import type { TNewCourseClass } from '@cio/db/types';
import type { TCreateCourseClass, TUpdateCourseClass } from '@cio/utils/validation';

/**
 * Classes ("turmas") are the dated, seat-limited editions a course is actually
 * sold as: "Turma de Janeiro", 16 seats, enrolment open until the 5th. Seats are
 * held from the moment checkout starts so a pending Multibanco reference cannot
 * be outsold, and released when the payment fails or expires.
 */

/** Statuses that still occupy a seat — mirrors the DB-side seat count. */
export const SEAT_HOLDING_STATUSES = ['reserved', 'confirmed'] as const;

export interface CourseClassAvailability {
  /** Null when the class has no seat limit. */
  seatsLeft: number | null;
  isFull: boolean;
  /** Whether the enrolment window is open right now. */
  windowOpen: boolean;
  /** True only when a student could enrol at this instant. */
  enrollable: boolean;
}

/** Empty strings from date/select inputs mean "not set". */
function normalize(data: TCreateCourseClass | TUpdateCourseClass): Partial<TNewCourseClass> {
  const patch: Partial<TNewCourseClass> = { ...data };

  for (const key of [
    'startsOn',
    'endsOn',
    'enrollmentOpensAt',
    'enrollmentClosesAt',
    'instructorId',
    'location',
    'schedule',
    'notes'
  ] as const) {
    if (patch[key] === '') patch[key] = null;
  }

  return patch;
}

export function getClassAvailability(row: CourseClassRow, now = new Date()): CourseClassAvailability {
  const seatsLeft = row.seats === null ? null : Math.max(0, row.seats - row.takenSeats);
  const isFull = seatsLeft !== null && seatsLeft === 0;

  const opensAt = row.enrollmentOpensAt ? new Date(row.enrollmentOpensAt) : null;
  const closesAt = row.enrollmentClosesAt ? new Date(row.enrollmentClosesAt) : null;
  const windowOpen = (!opensAt || opensAt <= now) && (!closesAt || closesAt >= now);

  return {
    seatsLeft,
    isFull,
    windowOpen,
    enrollable: row.status === 'open' && windowOpen && !isFull
  };
}

export type CourseClassWithAvailability = CourseClassRow & CourseClassAvailability;

function withAvailability(row: CourseClassRow): CourseClassWithAvailability {
  return { ...row, ...getClassAvailability(row) };
}

async function requireCourse(courseId: string): Promise<{ orgId: string; cost: number }> {
  const course = await getCourseWithRelations(courseId);
  if (!course?.org) {
    throw new AppError('Course not found', ErrorCodes.COURSE_NOT_FOUND, 404);
  }

  return { orgId: course.org.id, cost: Number(course.cost ?? 0) };
}

async function requireClass(courseId: string, classId: string): Promise<CourseClassRow> {
  const found = await getCourseClassById(classId);
  if (!found || found.courseId !== courseId) {
    throw new AppError('Class not found', ErrorCodes.NOT_FOUND, 404);
  }

  return found;
}

export async function listClassesForCourse(courseId: string): Promise<CourseClassWithAvailability[]> {
  const rows = await listCourseClasses(courseId);

  return rows.map(withAvailability);
}

/** What a prospective student sees: only runs that are actually on sale. */
export async function listOpenClassesForCourse(courseId: string): Promise<CourseClassWithAvailability[]> {
  const rows = await listClassesForCourse(courseId);

  return rows.filter((row) => row.status === 'open' && row.windowOpen);
}

export async function createClassForCourse(
  courseId: string,
  data: TCreateCourseClass
): Promise<CourseClassWithAvailability> {
  const { orgId } = await requireCourse(courseId);

  const created = await createCourseClass({ courseId, orgId, name: data.name, ...normalize(data) });

  return requireClass(courseId, created.id).then(withAvailability);
}

export async function updateClassForCourse(
  courseId: string,
  classId: string,
  data: TUpdateCourseClass
): Promise<CourseClassWithAvailability> {
  const current = await requireClass(courseId, classId);

  // Shrinking below the seats already taken would silently oversell the class.
  if (typeof data.seats === 'number' && data.seats < current.takenSeats) {
    throw new AppError(
      `This class already has ${current.takenSeats} enrolled — the seat limit cannot be lower`,
      ErrorCodes.VALIDATION_ERROR,
      400
    );
  }

  const updated = await updateCourseClass(classId, courseId, normalize(data));
  if (!updated) {
    throw new AppError('Class not found', ErrorCodes.NOT_FOUND, 404);
  }

  return requireClass(courseId, classId).then(withAvailability);
}

export async function deleteClassForCourse(courseId: string, classId: string): Promise<void> {
  const current = await requireClass(courseId, classId);

  // Enrolments are records of who trained when; cancel the class instead.
  if (current.takenSeats > 0) {
    throw new AppError(
      'This class has enrolled students — cancel it instead of deleting it',
      ErrorCodes.VALIDATION_ERROR,
      400
    );
  }

  await deleteCourseClass(classId, courseId);
}

export async function listClassStudents(courseId: string, classId: string): Promise<CourseClassMemberRow[]> {
  await requireClass(courseId, classId);

  return listCourseClassMembers(classId);
}

/**
 * Places a student in a class, bypassing the enrolment window (an admin adding
 * someone by hand) but never the seat limit — overselling a room with 16 chairs
 * is a real-world problem, an expired enrolment window is not.
 */
export async function addStudentToClass(
  courseId: string,
  classId: string,
  profileId: string,
  status: 'reserved' | 'confirmed' = 'confirmed'
): Promise<CourseClassMemberRow[]> {
  const current = await requireClass(courseId, classId);
  await assertSeatAvailable(current, profileId);

  await upsertCourseClassMember({ classId, profileId, status });

  return listCourseClassMembers(classId);
}

export async function removeStudentFromClass(
  courseId: string,
  classId: string,
  profileId: string
): Promise<CourseClassMemberRow[]> {
  await requireClass(courseId, classId);
  await setCourseClassMemberStatus(classId, profileId, 'cancelled');

  return listCourseClassMembers(classId);
}

/** Throws unless the class can still take this student. */
export async function assertSeatAvailable(row: CourseClassRow, profileId: string): Promise<void> {
  const members = await listCourseClassMembers(row.id);
  const existing = members.find((member) => member.profileId === profileId);

  // Re-taking a seat you already hold is not a new seat.
  if (existing && existing.status !== 'cancelled') {
    return;
  }

  const { isFull } = getClassAvailability(row);
  if (isFull) {
    throw new AppError('This class is full', ErrorCodes.VALIDATION_ERROR, 400);
  }
}

/**
 * Validates a class chosen at checkout and returns the price to charge.
 * Falls back to the course cost when the class has no price of its own.
 */
export async function resolveClassForCheckout(
  courseId: string,
  classId: string,
  profileId: string
): Promise<{ classRow: CourseClassRow; amountCents: number | null }> {
  const { cost } = await requireCourse(courseId);
  const classRow = await requireClass(courseId, classId);
  const availability = getClassAvailability(classRow);

  if (classRow.status !== 'open') {
    throw new AppError('This class is not open for enrolment', ErrorCodes.VALIDATION_ERROR, 400);
  }

  if (!availability.windowOpen) {
    throw new AppError('Enrolment for this class is closed', ErrorCodes.VALIDATION_ERROR, 400);
  }

  await assertSeatAvailable(classRow, profileId);

  return {
    classRow,
    amountCents: classRow.priceCents ?? (cost > 0 ? Math.round(cost * 100) : null)
  };
}
