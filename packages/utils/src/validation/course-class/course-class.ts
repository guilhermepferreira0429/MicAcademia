import * as z from 'zod';

/** Where the class is delivered — drives the venue field and attendance mode. */
export const ZCourseClassMode = z.enum(['online', 'in_person', 'hybrid']);
export type TCourseClassMode = z.infer<typeof ZCourseClassMode>;

/**
 * `draft` is invisible to students, `open` accepts enrolments, `closed` stops
 * them without cancelling the run, and the rest are lifecycle states.
 */
export const ZCourseClassStatus = z.enum(['draft', 'open', 'closed', 'running', 'finished', 'cancelled']);
export type TCourseClassStatus = z.infer<typeof ZCourseClassStatus>;

/** Empty strings are what HTML date/number inputs send for "not set". */
const optionalDate = z.union([z.iso.date(), z.literal('')]).optional();
const optionalDateTime = z.union([z.iso.datetime({ offset: true }), z.iso.datetime(), z.literal('')]).optional();

const classShape = {
  name: z.string().min(2).max(120),
  startsOn: optionalDate,
  endsOn: optionalDate,
  enrollmentOpensAt: optionalDateTime,
  enrollmentClosesAt: optionalDateTime,
  /** Null/absent = unlimited seats. */
  seats: z.number().int().min(1).max(10000).nullable().optional(),
  /** Null/absent = inherit the course price. */
  priceCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  mode: ZCourseClassMode.optional(),
  location: z.string().max(200).optional(),
  schedule: z.string().max(200).optional(),
  instructorId: z.union([z.uuid(), z.literal('')]).optional(),
  status: ZCourseClassStatus.optional(),
  notes: z.string().max(2000).optional()
};

/** Chronology checks, shared by create and update (both may carry the dates). */
interface ClassPeriod {
  startsOn?: string;
  endsOn?: string;
  enrollmentOpensAt?: string;
  enrollmentClosesAt?: string;
}

function endsAfterItStarts(value: ClassPeriod): boolean {
  return !value.startsOn || !value.endsOn || value.startsOn <= value.endsOn;
}

function enrollmentClosesAfterItOpens(value: ClassPeriod): boolean {
  return (
    !value.enrollmentOpensAt ||
    !value.enrollmentClosesAt ||
    new Date(value.enrollmentOpensAt) <= new Date(value.enrollmentClosesAt)
  );
}

const END_BEFORE_START = {
  message: 'The end date must not be before the start date',
  path: ['endsOn']
};

const CLOSES_BEFORE_OPENS = {
  message: 'Enrolment must close after it opens',
  path: ['enrollmentClosesAt']
};

export const ZCreateCourseClass = z
  .object(classShape)
  .refine(endsAfterItStarts, END_BEFORE_START)
  .refine(enrollmentClosesAfterItOpens, CLOSES_BEFORE_OPENS);
export type TCreateCourseClass = z.infer<typeof ZCreateCourseClass>;

export const ZUpdateCourseClass = z
  .object(classShape)
  .partial()
  .refine(endsAfterItStarts, END_BEFORE_START)
  .refine(enrollmentClosesAfterItOpens, CLOSES_BEFORE_OPENS);
export type TUpdateCourseClass = z.infer<typeof ZUpdateCourseClass>;

export const ZAddCourseClassMember = z.object({
  profileId: z.uuid(),
  status: z.enum(['reserved', 'confirmed']).optional()
});
export type TAddCourseClassMember = z.infer<typeof ZAddCourseClassMember>;
