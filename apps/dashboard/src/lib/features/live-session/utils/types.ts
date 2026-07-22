import { classroomio, type InferResponseType } from '$lib/utils/services/api';

export type LiveSessionTokenRequest = (typeof classroomio.course)[':courseId']['livekit'][':lessonId']['token']['$get'];
export type LiveSessionTokenResponse = InferResponseType<LiveSessionTokenRequest>;
export type LiveSessionToken = Extract<LiveSessionTokenResponse, { success: true }>['data'];
