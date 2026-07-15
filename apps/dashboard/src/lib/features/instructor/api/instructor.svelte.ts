import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';

import type {
  AssignInstructorCourseRequest,
  CreateInstructorRequest,
  DeleteInstructorRequest,
  Instructor,
  Instructors,
  ListInstructorsRequest,
  UnassignInstructorCourseRequest,
  UpdateInstructorRequest
} from '../utils/types';
import {
  ZCreateInstructor,
  ZUpdateInstructor,
  type TCreateInstructor,
  type TUpdateInstructor
} from '@cio/utils/validation/instructor/instructor';
import { mapZodErrorsToTranslations } from '$lib/utils/validation';
import { snackbar } from '$features/ui/snackbar/store';

/**
 * API class for DGERT instructor management operations.
 */
export class InstructorApi extends BaseApiWithErrors {
  instructors = $state<Instructors>([]);

  /** Fetches all instructors for the current organization. */
  async list() {
    await this.execute<ListInstructorsRequest>({
      requestFn: () => classroomio.instructor.$get(),
      logContext: 'fetching instructors',
      onSuccess: (response) => {
        if (response.data) {
          this.instructors = response.data;
        }
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('instructor.snackbar.list_failed');
        }
      }
    });
  }

  /** Creates a new instructor after client-side validation. */
  async create(fields: TCreateInstructor) {
    const result = ZCreateInstructor.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    await this.execute<CreateInstructorRequest>({
      requestFn: () => classroomio.instructor.$post({ json: result.data }),
      logContext: 'creating instructor',
      onSuccess: async () => {
        snackbar.success('instructor.snackbar.created');
        this.success = true;
        this.errors = {};
        await this.list();
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('instructor.snackbar.create_failed');
          return;
        }
        if ('field' in result && result.field) {
          this.errors[result.field] = result.error;
        } else if ('error' in result) {
          this.errors.general = result.error;
        }
        snackbar.error('instructor.snackbar.create_failed');
      }
    });
  }

  /** Updates an existing instructor after client-side validation. */
  async update(instructorId: string, fields: TUpdateInstructor) {
    const result = ZUpdateInstructor.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    await this.execute<UpdateInstructorRequest>({
      requestFn: () =>
        classroomio.instructor[':instructorId'].$put({
          param: { instructorId },
          json: result.data
        }),
      logContext: 'updating instructor',
      onSuccess: async () => {
        snackbar.success('instructor.snackbar.updated');
        this.success = true;
        this.errors = {};
        await this.list();
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('instructor.snackbar.update_failed');
          return;
        }
        if ('field' in result && result.field) {
          this.errors[result.field] = result.error;
        } else if ('error' in result) {
          this.errors.general = result.error;
        }
        snackbar.error('instructor.snackbar.update_failed');
      }
    });
  }

  /** Deletes an instructor. */
  async remove(instructorId: string) {
    await this.execute<DeleteInstructorRequest>({
      requestFn: () =>
        classroomio.instructor[':instructorId'].$delete({
          param: { instructorId }
        }),
      logContext: 'deleting instructor',
      onSuccess: () => {
        this.instructors = this.instructors.filter((instructor) => instructor.id !== instructorId);
        snackbar.success('instructor.snackbar.deleted');
        this.success = true;
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('instructor.snackbar.delete_failed');
        }
      }
    });
  }

  /** Assigns a course to an instructor. */
  async assignCourse(instructorId: string, courseId: string) {
    await this.execute<AssignInstructorCourseRequest>({
      requestFn: () =>
        classroomio.instructor[':instructorId'].courses.$post({
          param: { instructorId },
          json: { courseId }
        }),
      logContext: 'assigning course to instructor',
      onSuccess: async () => {
        snackbar.success('instructor.snackbar.course_assigned');
        this.success = true;
        this.errors = {};
        await this.list();
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('instructor.snackbar.course_assign_failed');
        }
      }
    });
  }

  /** Removes a course assignment from an instructor. */
  async unassignCourse(instructorId: string, courseId: string) {
    await this.execute<UnassignInstructorCourseRequest>({
      requestFn: () =>
        classroomio.instructor[':instructorId'].courses[':courseId'].$delete({
          param: { instructorId, courseId }
        }),
      logContext: 'unassigning course from instructor',
      onSuccess: async () => {
        snackbar.success('instructor.snackbar.course_unassigned');
        this.success = true;
        this.errors = {};
        await this.list();
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('instructor.snackbar.course_unassign_failed');
        }
      }
    });
  }

  /** Finds a loaded instructor by id (used by the edit modal after list refresh). */
  findById(instructorId: string): Instructor | undefined {
    return this.instructors.find((instructor) => instructor.id === instructorId);
  }
}

export const instructorApi = /* @__PURE__ */ new InstructorApi();
