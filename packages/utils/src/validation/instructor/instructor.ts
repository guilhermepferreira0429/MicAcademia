import * as z from 'zod';

/** DGERT trainer status values (contract, IP cession). */
export const ZInstructorStatus = z.enum(['none', 'pending', 'signed']);
export type TInstructorStatus = z.infer<typeof ZInstructorStatus>;

export const ZCreateInstructor = z.object({
  fullname: z.string().min(2).max(120),
  email: z.union([z.email(), z.literal('')]).optional(),
  /** Optional link to an existing platform account. */
  profileId: z.string().uuid().optional(),
  ccpNumber: z.string().max(60).optional(),
  /** CCP validity end date (ISO). Empty clears it. */
  ccpValidUntil: z.string().max(40).optional(),
  specialization: z.string().max(120).optional(),
  contractStatus: ZInstructorStatus.optional(),
  ipCessionStatus: ZInstructorStatus.optional(),
  notes: z.string().max(2000).optional()
});
export type TCreateInstructor = z.infer<typeof ZCreateInstructor>;

export const ZUpdateInstructor = ZCreateInstructor.partial();
export type TUpdateInstructor = z.infer<typeof ZUpdateInstructor>;

export const ZAssignInstructorCourse = z.object({
  courseId: z.string().uuid()
});
export type TAssignInstructorCourse = z.infer<typeof ZAssignInstructorCourse>;
