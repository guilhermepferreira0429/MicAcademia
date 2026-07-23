import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';

import type {
  ClassStudents,
  CourseClasses,
  CreateClassRequest,
  DeleteClassRequest,
  ListClassStudentsRequest,
  ListClassesRequest,
  ListOpenClassesRequest,
  RemoveClassStudentRequest,
  UpdateClassRequest
} from '../utils/types';
import {
  ZCreateCourseClass,
  ZUpdateCourseClass,
  type TCreateCourseClass,
  type TUpdateCourseClass
} from '@cio/utils/validation/course-class/course-class';
import { mapZodErrorsToTranslations } from '$lib/utils/validation';
import { snackbar } from '$features/ui/snackbar/store';

/**
 * API class for a course's classes (turmas): the dated editions with their own
 * seats, price and enrolment window. Course team only; the client sends the
 * `cio-org-id` header automatically.
 */
export class ClassesApi extends BaseApiWithErrors {
  classes = $state<CourseClasses>([]);

  /** Classes on sale right now — what a student picks from before paying. */
  openClasses = $state<CourseClasses>([]);

  /** Students of the class currently expanded on screen. */
  students = $state<ClassStudents>([]);
  studentsClassId = $state<string | null>(null);

  async list(courseId: string) {
    await this.execute<ListClassesRequest>({
      requestFn: () => classroomio.course[':courseId'].classes.$get({ param: { courseId } }),
      logContext: 'fetching course classes',
      onSuccess: (response) => {
        if (response.data) {
          this.classes = response.data;
        }
        this.errors = {};
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('classes.snackbar.list_failed');
        }
      }
    });
  }

  /** The on-sale list, readable by any enrolled-or-prospective student. */
  async listOpen(courseId: string) {
    await this.execute<ListOpenClassesRequest>({
      requestFn: () => classroomio.course[':courseId'].classes.open.$get({ param: { courseId } }),
      logContext: 'fetching open classes',
      onSuccess: (response) => {
        if (response.data) {
          this.openClasses = response.data;
        }
      },
      onError: () => {
        // A student who cannot list classes simply gets the course-level price.
        this.openClasses = [];
      }
    });
  }

  async create(courseId: string, fields: TCreateCourseClass) {
    const result = ZCreateCourseClass.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    await this.execute<CreateClassRequest>({
      requestFn: () => classroomio.course[':courseId'].classes.$post({ param: { courseId }, json: result.data }),
      logContext: 'creating course class',
      onSuccess: async () => {
        snackbar.success('classes.snackbar.created');
        this.success = true;
        this.errors = {};
        await this.list(courseId);
      },
      onError: (result) => this.handleFormError(result, 'classes.snackbar.create_failed')
    });
  }

  async update(courseId: string, classId: string, fields: TUpdateCourseClass) {
    const result = ZUpdateCourseClass.safeParse(fields);
    if (!result.success) {
      this.errors = mapZodErrorsToTranslations(result.error);
      return;
    }

    await this.execute<UpdateClassRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].classes[':classId'].$put({
          param: { courseId, classId },
          json: result.data
        }),
      logContext: 'updating course class',
      onSuccess: async () => {
        snackbar.success('classes.snackbar.updated');
        this.success = true;
        this.errors = {};
        await this.list(courseId);
      },
      onError: (result) => this.handleFormError(result, 'classes.snackbar.update_failed')
    });
  }

  async remove(courseId: string, classId: string) {
    await this.execute<DeleteClassRequest>({
      requestFn: () => classroomio.course[':courseId'].classes[':classId'].$delete({ param: { courseId, classId } }),
      logContext: 'deleting course class',
      onSuccess: async () => {
        snackbar.success('classes.snackbar.deleted');
        await this.list(courseId);
      },
      onError: (result) => this.handleFormError(result, 'classes.snackbar.delete_failed')
    });
  }

  /** Loads the roster of one class; toggling the same class again closes it. */
  async loadStudents(courseId: string, classId: string) {
    await this.execute<ListClassStudentsRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].classes[':classId'].students.$get({ param: { courseId, classId } }),
      logContext: 'fetching class students',
      onSuccess: (response) => {
        if (response.data) {
          this.students = response.data;
          this.studentsClassId = classId;
        }
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('classes.snackbar.students_failed');
        }
      }
    });
  }

  /** Frees a seat: the student is marked cancelled, not deleted, keeping the history. */
  async removeStudent(courseId: string, classId: string, profileId: string) {
    await this.execute<RemoveClassStudentRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].classes[':classId'].students[':profileId'].$delete({
          param: { courseId, classId, profileId }
        }),
      logContext: 'removing student from class',
      onSuccess: async (response) => {
        snackbar.success('classes.snackbar.student_removed');
        if (response.data) {
          this.students = response.data;
        }
        await this.list(courseId);
      },
      onError: (result) => this.handleFormError(result, 'classes.snackbar.student_remove_failed')
    });
  }

  override reset() {
    super.reset();
    this.classes = [];
    this.students = [];
    this.studentsClassId = null;
  }
}

export const classesApi = /* @__PURE__ */ new ClassesApi();
