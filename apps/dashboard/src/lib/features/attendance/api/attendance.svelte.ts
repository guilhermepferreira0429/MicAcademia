import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';

import type {
  AttendanceSummary,
  AttendanceSummaryRequest,
  CheckinCode,
  CheckinRequest,
  CheckinResult,
  CreateCheckinCodeRequest,
  ManualAttendanceRequest,
  ManualAttendanceResult
} from '../utils/types';
import { snackbar } from '$features/ui/snackbar/store';

/**
 * API class for in-person attendance (QR check-in/out and manual marking) and
 * the consolidated attendance record that merges it with online sessions.
 * The client automatically sends the `cio-org-id` header and session cookie.
 */
export class AttendanceApi extends BaseApiWithErrors {
  summary = $state<AttendanceSummary | null>(null);

  /**
   * Mints the short-lived signed token a trainer renders as the session QR.
   * Course team only. The token is valid for 15 minutes.
   */
  async createCheckinCode(courseId: string, lessonId: string): Promise<CheckinCode | null> {
    let code: CheckinCode | null = null;

    await this.execute<CreateCheckinCodeRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].attendance[':lessonId']['checkin-code'].$post({
          param: { courseId, lessonId }
        }),
      logContext: 'creating attendance check-in code',
      onSuccess: (response) => {
        if (response.data) {
          code = response.data;
        }
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('attendance.snackbar.code_failed');
        }
      }
    });

    return code;
  }

  /**
   * Records a scan for the signed-in student. The first scan checks in, the
   * next one checks out — so real attended time is measured.
   */
  async checkin(courseId: string, token: string): Promise<CheckinResult | null> {
    let result: CheckinResult | null = null;

    await this.execute<CheckinRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].attendance.checkin.$post({
          param: { courseId },
          json: { token }
        }),
      logContext: 'recording attendance check-in',
      onSuccess: (response) => {
        if (response.data) {
          result = response.data;
        }
        this.errors = {};
      }
    });

    return result;
  }

  /** Marks a student present for a session they could not scan into. Team only. */
  async markManual(
    courseId: string,
    lessonId: string,
    profileId: string,
    minutes?: number
  ): Promise<ManualAttendanceResult | null> {
    let result: ManualAttendanceResult | null = null;

    await this.execute<ManualAttendanceRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].attendance[':lessonId'].manual.$post({
          param: { courseId, lessonId },
          json: typeof minutes === 'number' ? { profileId, minutes } : { profileId }
        }),
      logContext: 'marking manual attendance',
      onSuccess: (response) => {
        if (response.data) {
          result = response.data;
        }
        this.errors = {};
        snackbar.success('attendance.snackbar.marked');
      },
      onError: (error) => {
        if (typeof error === 'string') {
          snackbar.error('attendance.snackbar.mark_failed');
        }
      }
    });

    return result;
  }

  /** Loads the consolidated attendance record for a course. Team only. */
  async loadSummary(courseId: string) {
    await this.execute<AttendanceSummaryRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].attendance.summary.$get({
          param: { courseId }
        }),
      logContext: 'fetching attendance summary',
      onSuccess: (response) => {
        if (response.data) {
          this.summary = response.data;
        }
        this.errors = {};
      },
      onError: (error) => {
        if (typeof error === 'string') {
          snackbar.error('attendance.snackbar.summary_failed');
        }
      }
    });
  }
}

export const attendanceApi = /* @__PURE__ */ new AttendanceApi();
