import { classroomio, type InferResponseType } from '$lib/utils/services/api';

// Classes ("turmas"): the dated, seat-limited editions a course is sold as.
export type ListClassesRequest = (typeof classroomio.course)[':courseId']['classes']['$get'];
export type ListOpenClassesRequest = (typeof classroomio.course)[':courseId']['classes']['open']['$get'];
export type CreateClassRequest = (typeof classroomio.course)[':courseId']['classes']['$post'];
export type UpdateClassRequest = (typeof classroomio.course)[':courseId']['classes'][':classId']['$put'];
export type DeleteClassRequest = (typeof classroomio.course)[':courseId']['classes'][':classId']['$delete'];
export type ListClassStudentsRequest =
  (typeof classroomio.course)[':courseId']['classes'][':classId']['students']['$get'];
export type RemoveClassStudentRequest =
  (typeof classroomio.course)[':courseId']['classes'][':classId']['students'][':profileId']['$delete'];

type ListClassesSuccess = Extract<InferResponseType<ListClassesRequest>, { success: true }>;
export type CourseClasses = ListClassesSuccess['data'];
export type CourseClass = CourseClasses[number];

type ListStudentsSuccess = Extract<InferResponseType<ListClassStudentsRequest>, { success: true }>;
export type ClassStudents = ListStudentsSuccess['data'];
export type ClassStudent = ClassStudents[number];
