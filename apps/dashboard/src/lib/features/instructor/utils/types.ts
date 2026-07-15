import { classroomio, type InferResponseType } from '$lib/utils/services/api';

// List instructors types
export type ListInstructorsRequest = typeof classroomio.instructor.$get;
export type ListInstructorsResponse = InferResponseType<ListInstructorsRequest> | null;
export type ListInstructorsSuccess = Extract<InferResponseType<ListInstructorsRequest>, { success: true }>;
export type Instructors = ListInstructorsSuccess['data'];

/** A single DGERT instructor (array element of the list response). */
export type Instructor = Instructors[number];

/** The `courses` chips carried on an instructor. */
export type InstructorCourse = Instructor['courses'][number];

// Create instructor types
export type CreateInstructorRequest = typeof classroomio.instructor.$post;
export type CreateInstructorResponse = InferResponseType<CreateInstructorRequest>;
export type CreateInstructorSuccess = Extract<CreateInstructorResponse, { success: true }>;
export type CreateInstructorData = CreateInstructorSuccess['data'];

// Update instructor types
export type UpdateInstructorRequest = (typeof classroomio.instructor)[':instructorId']['$put'];
export type UpdateInstructorResponse = InferResponseType<UpdateInstructorRequest>;
export type UpdateInstructorSuccess = Extract<UpdateInstructorResponse, { success: true }>;
export type UpdateInstructorData = UpdateInstructorSuccess['data'];

// Delete instructor types
export type DeleteInstructorRequest = (typeof classroomio.instructor)[':instructorId']['$delete'];

// Assign / unassign course types
export type AssignInstructorCourseRequest = (typeof classroomio.instructor)[':instructorId']['courses']['$post'];
export type UnassignInstructorCourseRequest =
  (typeof classroomio.instructor)[':instructorId']['courses'][':courseId']['$delete'];
