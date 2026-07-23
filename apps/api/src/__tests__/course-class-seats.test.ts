import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCourseClassById,
  getCourseWithRelations,
  listCourseClassMembers,
  updateCourseClass
} from '@cio/db/queries/course';

import { getClassAvailability, resolveClassForCheckout, updateClassForCourse } from '@api/services/course/class';

/**
 * Seat rules for classes (turmas). Overselling a room with 16 chairs is a
 * real-world problem — someone shows up and has nowhere to sit — so these
 * guards matter more than the usual CRUD.
 */

vi.mock('@cio/db/queries/course', () => ({
  createCourseClass: vi.fn(),
  deleteCourseClass: vi.fn(),
  getCourseClassById: vi.fn(),
  getCourseWithRelations: vi.fn(),
  listCourseClassMembers: vi.fn(),
  listCourseClasses: vi.fn(),
  setCourseClassMemberStatus: vi.fn(),
  updateCourseClass: vi.fn(),
  upsertCourseClassMember: vi.fn()
}));

const mockedGetClass = vi.mocked(getCourseClassById);
const mockedGetCourse = vi.mocked(getCourseWithRelations);
const mockedMembers = vi.mocked(listCourseClassMembers);
const mockedUpdate = vi.mocked(updateCourseClass);

const COURSE_ID = 'course-1';
const CLASS_ID = 'class-1';

function buildClass(overrides: Record<string, unknown> = {}) {
  return {
    id: CLASS_ID,
    courseId: COURSE_ID,
    orgId: 'org-1',
    name: 'January class',
    startsOn: '2026-01-12',
    endsOn: '2026-02-20',
    enrollmentOpensAt: null,
    enrollmentClosesAt: null,
    seats: 16,
    priceCents: null,
    currency: 'EUR',
    mode: 'in_person',
    location: null,
    schedule: null,
    instructorId: null,
    instructorName: null,
    status: 'open',
    notes: null,
    takenSeats: 0,
    confirmedSeats: 0,
    createdAt: '2025-12-01T10:00:00.000Z',
    updatedAt: '2025-12-01T10:00:00.000Z',
    ...overrides
  } as never;
}

describe('getClassAvailability', () => {
  it('reports free seats on an open class', () => {
    const availability = getClassAvailability(buildClass({ takenSeats: 4 }));

    expect(availability).toMatchObject({ seatsLeft: 12, isFull: false, windowOpen: true, enrollable: true });
  });

  it('treats a class without a seat limit as never full', () => {
    const availability = getClassAvailability(buildClass({ seats: null, takenSeats: 500 }));

    expect(availability.seatsLeft).toBeNull();
    expect(availability.isFull).toBe(false);
  });

  it('is full once every seat is taken', () => {
    const availability = getClassAvailability(buildClass({ takenSeats: 16 }));

    expect(availability).toMatchObject({ seatsLeft: 0, isFull: true, enrollable: false });
  });

  it('closes enrolment outside the window', () => {
    const now = new Date('2026-01-10T12:00:00.000Z');

    const notYet = getClassAvailability(buildClass({ enrollmentOpensAt: '2026-01-20T00:00:00.000Z' }), now);
    const tooLate = getClassAvailability(buildClass({ enrollmentClosesAt: '2026-01-05T00:00:00.000Z' }), now);

    expect(notYet.windowOpen).toBe(false);
    expect(tooLate.windowOpen).toBe(false);
    expect(notYet.enrollable).toBe(false);
  });

  it('does not offer a draft class even with seats and an open window', () => {
    expect(getClassAvailability(buildClass({ status: 'draft' })).enrollable).toBe(false);
  });
});

describe('resolveClassForCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCourse.mockResolvedValue({ id: COURSE_ID, cost: 250, org: { id: 'org-1' } } as never);
    mockedMembers.mockResolvedValue([]);
  });

  it('charges the course price when the class has none of its own', async () => {
    mockedGetClass.mockResolvedValue(buildClass());

    const result = await resolveClassForCheckout(COURSE_ID, CLASS_ID, 'student-1');

    expect(result.amountCents).toBe(25_000);
  });

  it('charges the class price when it has one', async () => {
    mockedGetClass.mockResolvedValue(buildClass({ priceCents: 19_900 }));

    const result = await resolveClassForCheckout(COURSE_ID, CLASS_ID, 'student-1');

    expect(result.amountCents).toBe(19_900);
  });

  it('refuses a class that is not open', async () => {
    mockedGetClass.mockResolvedValue(buildClass({ status: 'closed' }));

    await expect(resolveClassForCheckout(COURSE_ID, CLASS_ID, 'student-1')).rejects.toThrow(/not open/i);
  });

  it('refuses once the enrolment window has closed', async () => {
    mockedGetClass.mockResolvedValue(buildClass({ enrollmentClosesAt: '2020-01-01T00:00:00.000Z' }));

    await expect(resolveClassForCheckout(COURSE_ID, CLASS_ID, 'student-1')).rejects.toThrow(/closed/i);
  });

  it('refuses to sell the last seat twice', async () => {
    mockedGetClass.mockResolvedValue(buildClass({ seats: 1, takenSeats: 1 }));
    mockedMembers.mockResolvedValue([
      { id: 'm1', profileId: 'someone-else', fullname: null, email: null, status: 'reserved', createdAt: '' }
    ] as never);

    await expect(resolveClassForCheckout(COURSE_ID, CLASS_ID, 'student-1')).rejects.toThrow(/full/i);
  });

  it('lets the holder of a seat retry her own unpaid checkout', async () => {
    // The seat is already hers, so this is not a new seat and must not be refused.
    mockedGetClass.mockResolvedValue(buildClass({ seats: 1, takenSeats: 1 }));
    mockedMembers.mockResolvedValue([
      { id: 'm1', profileId: 'student-1', fullname: null, email: null, status: 'reserved', createdAt: '' }
    ] as never);

    await expect(resolveClassForCheckout(COURSE_ID, CLASS_ID, 'student-1')).resolves.toMatchObject({
      amountCents: 25_000
    });
  });

  it('lets a student whose reservation was cancelled buy again', async () => {
    mockedGetClass.mockResolvedValue(buildClass({ seats: 1, takenSeats: 0 }));
    mockedMembers.mockResolvedValue([
      { id: 'm1', profileId: 'student-1', fullname: null, email: null, status: 'cancelled', createdAt: '' }
    ] as never);

    await expect(resolveClassForCheckout(COURSE_ID, CLASS_ID, 'student-1')).resolves.toBeTruthy();
  });
});

describe('updateClassForCourse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCourse.mockResolvedValue({ id: COURSE_ID, cost: 250, org: { id: 'org-1' } } as never);
  });

  it('refuses a seat limit below the students already enrolled', async () => {
    mockedGetClass.mockResolvedValue(buildClass({ seats: 16, takenSeats: 12 }));

    await expect(updateClassForCourse(COURSE_ID, CLASS_ID, { seats: 8 })).rejects.toThrow(/cannot be lower/i);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it('allows shrinking down to exactly the seats taken', async () => {
    mockedGetClass.mockResolvedValue(buildClass({ seats: 16, takenSeats: 12 }));
    mockedUpdate.mockResolvedValue(buildClass({ seats: 12, takenSeats: 12 }));

    await updateClassForCourse(COURSE_ID, CLASS_ID, { seats: 12 });

    expect(mockedUpdate).toHaveBeenCalledWith(CLASS_ID, COURSE_ID, expect.objectContaining({ seats: 12 }));
  });

  it('turns empty form values into cleared fields', async () => {
    mockedGetClass.mockResolvedValue(buildClass());
    mockedUpdate.mockResolvedValue(buildClass());

    await updateClassForCourse(COURSE_ID, CLASS_ID, { location: '', instructorId: '', endsOn: '' });

    expect(mockedUpdate).toHaveBeenCalledWith(
      CLASS_ID,
      COURSE_ID,
      expect.objectContaining({ location: null, instructorId: null, endsOn: null })
    );
  });
});
