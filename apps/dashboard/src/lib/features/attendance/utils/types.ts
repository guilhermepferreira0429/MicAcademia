import { classroomio, type InferResponseType } from '$lib/utils/services/api';

// Check-in code (trainer mints the short-lived token rendered as the session QR)
export type CreateCheckinCodeRequest =
  (typeof classroomio.course)[':courseId']['attendance'][':lessonId']['checkin-code']['$post'];
export type CreateCheckinCodeResponse = InferResponseType<CreateCheckinCodeRequest>;
export type CreateCheckinCodeSuccess = Extract<CreateCheckinCodeResponse, { success: true }>;
/** `{ token, expiresAt }` — the payload encoded into the QR code. */
export type CheckinCode = CreateCheckinCodeSuccess['data'];

// Student check-in / check-out (same endpoint, toggles based on open entry)
export type CheckinRequest = (typeof classroomio.course)[':courseId']['attendance']['checkin']['$post'];
export type CheckinResponse = InferResponseType<CheckinRequest>;
export type CheckinSuccess = Extract<CheckinResponse, { success: true }>;
/** `{ action, lessonId, at, durationSeconds? }`. */
export type CheckinResult = CheckinSuccess['data'];

// Manual marking (students who cannot scan)
export type ManualAttendanceRequest =
  (typeof classroomio.course)[':courseId']['attendance'][':lessonId']['manual']['$post'];
export type ManualAttendanceResponse = InferResponseType<ManualAttendanceRequest>;
export type ManualAttendanceSuccess = Extract<ManualAttendanceResponse, { success: true }>;
export type ManualAttendanceResult = ManualAttendanceSuccess['data'];

// Consolidated per-course attendance summary (online + in-person)
export type AttendanceSummaryRequest = (typeof classroomio.course)[':courseId']['attendance']['summary']['$get'];
export type AttendanceSummaryResponse = InferResponseType<AttendanceSummaryRequest>;
export type AttendanceSummarySuccess = Extract<AttendanceSummaryResponse, { success: true }>;
export type AttendanceSummary = AttendanceSummarySuccess['data'];

/** One session (scheduled lesson) row in the summary header. */
export type AttendanceSummarySession = AttendanceSummary['sessions'][number];

/** One student row in the consolidated record. */
export type AttendanceSummaryStudent = AttendanceSummary['students'][number];

/** A student's attendance for a single session, with the sources that fed it. */
export type AttendanceSummaryPerSession = AttendanceSummaryStudent['perSession'][number];
