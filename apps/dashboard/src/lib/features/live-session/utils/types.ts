import { classroomio, type InferResponseType } from '$lib/utils/services/api';

export type LiveSessionTokenRequest = (typeof classroomio.course)[':courseId']['livekit'][':lessonId']['token']['$get'];
export type LiveSessionTokenResponse = InferResponseType<LiveSessionTokenRequest>;
export type LiveSessionToken = Extract<LiveSessionTokenResponse, { success: true }>['data'];

// Recordings of a live lesson (LiveKit Egress)
export type ListRecordingsRequest =
  (typeof classroomio.course)[':courseId']['livekit'][':lessonId']['recordings']['$get'];
export type StartRecordingRequest =
  (typeof classroomio.course)[':courseId']['livekit'][':lessonId']['recordings']['start']['$post'];
export type StopRecordingRequest =
  (typeof classroomio.course)[':courseId']['livekit'][':lessonId']['recordings']['stop']['$post'];
export type PublishRecordingRequest =
  (typeof classroomio.course)[':courseId']['livekit'][':lessonId']['recordings'][':recordingId']['publish']['$post'];

type ListRecordingsSuccess = Extract<InferResponseType<ListRecordingsRequest>, { success: true }>;
export type Recordings = ListRecordingsSuccess['data']['recordings'];
export type Recording = Recordings[number];
