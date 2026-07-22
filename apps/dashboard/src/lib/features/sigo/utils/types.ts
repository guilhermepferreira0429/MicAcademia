import { classroomio, type InferResponseType } from '$lib/utils/services/api';

// List submissions types
export type ListSigoSubmissionsRequest = typeof classroomio.sigo.$get;
export type ListSigoSubmissionsResponse = InferResponseType<ListSigoSubmissionsRequest> | null;
export type ListSigoSubmissionsSuccess = Extract<InferResponseType<ListSigoSubmissionsRequest>, { success: true }>;
export type SigoSubmissions = ListSigoSubmissionsSuccess['data'];

/** A single SIGO submission (array element of the list response). */
export type SigoSubmission = SigoSubmissions[number];

/** The SIGO config carried on the submission's course (may be absent). */
export type SigoCourseConfig = SigoSubmission['courseSigo'];

// Create submission types
export type CreateSigoSubmissionRequest = typeof classroomio.sigo.$post;
export type CreateSigoSubmissionResponse = InferResponseType<CreateSigoSubmissionRequest>;
export type CreateSigoSubmissionSuccess = Extract<CreateSigoSubmissionResponse, { success: true }>;
export type CreateSigoSubmissionData = CreateSigoSubmissionSuccess['data'];

// Update submission types
export type UpdateSigoSubmissionRequest = (typeof classroomio.sigo)[':submissionId']['$put'];
export type UpdateSigoSubmissionResponse = InferResponseType<UpdateSigoSubmissionRequest>;
export type UpdateSigoSubmissionSuccess = Extract<UpdateSigoSubmissionResponse, { success: true }>;
export type UpdateSigoSubmissionData = UpdateSigoSubmissionSuccess['data'];

// Delete submission types
export type DeleteSigoSubmissionRequest = (typeof classroomio.sigo)[':submissionId']['$delete'];
