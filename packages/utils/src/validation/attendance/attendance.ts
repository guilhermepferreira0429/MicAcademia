import * as z from 'zod';

export const ZAttendanceUpsert = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  studentId: z.string().min(1),
  isPresent: z.boolean()
});
export type TAttendanceUpsert = z.infer<typeof ZAttendanceUpsert>;

export const ZAttendanceListQuery = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().optional()
});
export type TAttendanceListQuery = z.infer<typeof ZAttendanceListQuery>;

/** Where a presence interval came from. */
export const ZAttendanceSource = z.enum(['livekit', 'qr', 'manual']);
export type TAttendanceSource = z.infer<typeof ZAttendanceSource>;

/** Body for a student scanning the session QR (same call checks in and out). */
export const ZAttendanceCheckin = z.object({
  token: z.string().min(10)
});
export type TAttendanceCheckin = z.infer<typeof ZAttendanceCheckin>;

/** Trainer marking a student present for an in-person session. */
export const ZAttendanceManualMark = z.object({
  profileId: z.string().uuid(),
  /** Attended minutes to credit; defaults to the session's scheduled length. */
  minutes: z.number().int().positive().max(1440).optional()
});
export type TAttendanceManualMark = z.infer<typeof ZAttendanceManualMark>;
