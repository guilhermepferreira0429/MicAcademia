import {
  EgressClient,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptionsPreset,
  RoomCompositeEgressRequest,
  RoomEgress,
  S3Upload,
  type EgressInfo,
  type WebhookEvent
} from 'livekit-server-sdk';

import { AppError, ErrorCodes } from '@api/utils/errors';
import { env } from '@cio/core/config/env';
import { getStorageConfig } from '@cio/core/config/storage';
import { generateVideoDownloadPresignedUrls } from '@cio/core/utils/s3';
import {
  getActiveLessonRecording,
  getLessonById,
  getLessonRecordingById,
  getLessonRecordingByEgressId,
  listLessonRecordings,
  updateLesson,
  updateLessonRecording,
  upsertLessonRecording
} from '@cio/db/queries/lesson';
import type { TLesson, TLessonRecording, TNewLessonRecording } from '@cio/db/types';

import { getLessonRoomName, isLiveKitConfigured, toHttpUrl } from './config';
import { parseLessonIdFromRoom } from './attendance';

/**
 * Recording of live classes (LiveKit Egress). A live lesson is recorded from
 * the moment the room starts — the teacher does not have to remember to press
 * anything — and the finished file is uploaded straight to the videos bucket
 * and attached to the lesson, so the class becomes on-demand content for anyone
 * who missed it.
 *
 * Egress runs as its own LiveKit service; without it the room still works, the
 * recording simply never starts. That is deliberate: a missing recorder must
 * not stop a class from happening.
 */

/** Where a lesson's recordings live in the videos bucket. */
export function buildRecordingFilepath(courseId: string, lessonId: string): string {
  return `recordings/${courseId}/${lessonId}/{room_name}-{time}.mp4`;
}

export function isRecordingConfigured(): boolean {
  if (!isLiveKitConfigured()) return false;

  const storage = getStorageConfig();

  return Boolean(storage.accessKeyId && storage.secretAccessKey && storage.bucketVideos);
}

function getEgressClient(): EgressClient {
  return new EgressClient(toHttpUrl(env.LIVEKIT_URL!), env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!);
}

/** The MP4-to-S3 output every recording of ours writes to. */
function buildFileOutput(courseId: string, lessonId: string): EncodedFileOutput {
  const storage = getStorageConfig();

  return new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: buildRecordingFilepath(courseId, lessonId),
    output: {
      case: 's3',
      value: new S3Upload({
        accessKey: storage.accessKeyId,
        secret: storage.secretAccessKey,
        region: storage.region,
        endpoint: storage.endpoint,
        bucket: storage.bucketVideos,
        forcePathStyle: storage.forcePathStyle
      })
    }
  });
}

/**
 * The auto-record clause attached to the room at creation time. LiveKit starts
 * this egress by itself when the room starts, which is what makes recording
 * automatic rather than something a teacher has to remember.
 */
export function buildRoomAutoEgress(courseId: string, lessonId: string): RoomEgress | undefined {
  if (!isRecordingConfigured()) return undefined;

  return new RoomEgress({
    room: new RoomCompositeEgressRequest({
      roomName: getLessonRoomName(lessonId),
      layout: 'speaker',
      options: { case: 'preset', value: EncodingOptionsPreset.H264_720P_30 },
      fileOutputs: [buildFileOutput(courseId, lessonId)]
    })
  });
}

/** Starts recording a room that is already running (the manual escape hatch). */
export async function startLessonRecording(courseId: string, lessonId: string): Promise<TLessonRecording> {
  if (!isRecordingConfigured()) {
    throw new AppError('Recording is not configured', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const lesson = await getLessonById(lessonId);
  if (!lesson || lesson.courseId !== courseId) {
    throw new AppError('Lesson not found', ErrorCodes.NOT_FOUND, 404);
  }

  const active = await getActiveLessonRecording(lessonId);
  if (active) {
    return active;
  }

  const roomName = getLessonRoomName(lessonId);

  let info: EgressInfo;
  try {
    info = await getEgressClient().startRoomCompositeEgress(roomName, buildFileOutput(courseId, lessonId), {
      layout: 'speaker',
      encodingOptions: EncodingOptionsPreset.H264_720P_30
    });
  } catch (error) {
    console.error('startLessonRecording error:', error instanceof Error ? error.message : error);
    throw new AppError('Could not start the recording', ErrorCodes.VALIDATION_ERROR, 400);
  }

  return upsertLessonRecording({
    courseId,
    lessonId,
    egressId: info.egressId,
    roomName,
    status: 'active',
    startedAt: new Date().toISOString()
  });
}

/** Stops the running recording of a lesson; the file arrives via the webhook. */
export async function stopLessonRecording(courseId: string, lessonId: string): Promise<TLessonRecording> {
  const active = await getActiveLessonRecording(lessonId);
  if (!active || active.courseId !== courseId) {
    throw new AppError('There is no recording running for this lesson', ErrorCodes.NOT_FOUND, 404);
  }

  try {
    await getEgressClient().stopEgress(active.egressId);
  } catch (error) {
    console.error('stopLessonRecording error:', error instanceof Error ? error.message : error);
    throw new AppError('Could not stop the recording', ErrorCodes.VALIDATION_ERROR, 400);
  }

  return (await updateLessonRecording(active.id, { status: 'complete', endedAt: new Date().toISOString() })) ?? active;
}

/** LiveKit's numeric status mapped to the words the UI shows. */
export function mapEgressStatus(status: EgressStatus | number | undefined): TLessonRecording['status'] {
  switch (status) {
    case EgressStatus.EGRESS_STARTING:
      return 'starting';
    case EgressStatus.EGRESS_ACTIVE:
    case EgressStatus.EGRESS_ENDING:
      return 'active';
    case EgressStatus.EGRESS_COMPLETE:
      return 'complete';
    case EgressStatus.EGRESS_FAILED:
      return 'failed';
    case EgressStatus.EGRESS_ABORTED:
    case EgressStatus.EGRESS_LIMIT_REACHED:
      return 'aborted';
    default:
      return 'starting';
  }
}

/** LiveKit timestamps are unix nanoseconds on egress payloads. */
function nanosToIso(value: bigint | number | undefined): string | null {
  const nanos = Number(value ?? 0);
  if (!nanos) return null;

  return new Date(nanos / 1_000_000).toISOString();
}

/**
 * Applies an `egress_*` webhook. Called for every stage of the job; only the
 * final one carries the file, at which point the recording is published on the
 * lesson so students see it without anyone lifting a finger.
 */
export async function handleEgressEvent(event: WebhookEvent): Promise<{ handled: boolean }> {
  const info = event.egressInfo;
  if (!info) {
    return { handled: false };
  }

  const lessonId = parseLessonIdFromRoom(info.roomName);
  if (!lessonId) {
    return { handled: false };
  }

  const lesson = await getLessonById(lessonId);
  if (!lesson) {
    return { handled: false };
  }

  const file = info.fileResults?.[0];
  const status = mapEgressStatus(info.status);

  const record = await upsertLessonRecording({
    courseId: lesson.courseId,
    lessonId,
    egressId: info.egressId,
    roomName: info.roomName,
    status,
    startedAt: nanosToIso(info.startedAt),
    endedAt: nanosToIso(info.endedAt),
    storageKey: file?.filename || null,
    location: file?.location || null,
    durationSeconds: file?.duration ? Math.round(Number(file.duration) / 1_000_000_000) : null,
    sizeBytes: file?.size ? Number(file.size) : null,
    error: info.error || null,
    payload: info as TNewLessonRecording['payload']
  });

  if (status === 'complete' && record.storageKey) {
    await publishRecordingToLesson(record.id);
  }

  return { handled: true };
}

/** Storage keys come back as full paths; the bucket prefix is not part of the key. */
function toStorageKey(filename: string, bucket: string): string {
  const trimmed = filename.replace(/^\/+/, '');

  return trimmed.startsWith(`${bucket}/`) ? trimmed.slice(bucket.length + 1) : trimmed;
}

/**
 * Attaches a finished recording to the lesson as an uploaded video, which is
 * what turns a live class into on-demand content. Idempotent: publishing twice
 * does not add the video twice.
 */
export async function publishRecordingToLesson(recordingId: string): Promise<TLessonRecording> {
  const recording = await getLessonRecordingById(recordingId);
  if (!recording) {
    throw new AppError('Recording not found', ErrorCodes.NOT_FOUND, 404);
  }

  if (recording.publishedAt || !recording.storageKey) {
    return recording;
  }

  const lesson = await getLessonById(recording.lessonId);
  if (!lesson) {
    throw new AppError('Lesson not found', ErrorCodes.NOT_FOUND, 404);
  }

  const storage = getStorageConfig();
  const key = toStorageKey(recording.storageKey, storage.bucketVideos);

  const videos = (lesson.videos ?? []) as NonNullable<TLesson['videos']>;
  if (videos.some((video) => video.key === key)) {
    return (await updateLessonRecording(recording.id, { publishedAt: new Date().toISOString() })) ?? recording;
  }

  // A presigned URL expires, so `key` is what playback re-signs from later.
  let link = recording.location ?? '';
  try {
    const signed = await generateVideoDownloadPresignedUrls([key]);
    link = signed[key] ?? link;
  } catch (error) {
    console.warn('publishRecordingToLesson: presign failed:', error instanceof Error ? error.message : error);
  }

  await updateLesson(recording.lessonId, {
    videos: [
      ...videos,
      {
        type: 'upload',
        link,
        key,
        fileName: `${lesson.title}.mp4`,
        metadata: {
          title: lesson.title,
          duration: recording.durationSeconds ?? undefined,
          createdAt: recording.endedAt ?? new Date().toISOString()
        }
      }
    ]
  });

  return (await updateLessonRecording(recording.id, { publishedAt: new Date().toISOString() })) ?? recording;
}

export interface LessonRecordingView extends TLessonRecording {
  /** Freshly signed playback URL; the stored one expires. */
  playbackUrl: string | null;
}

/** Recordings of a lesson, each with a playable URL for the course team. */
export async function listRecordingsForLesson(courseId: string, lessonId: string): Promise<LessonRecordingView[]> {
  const lesson = await getLessonById(lessonId);
  if (!lesson || lesson.courseId !== courseId) {
    throw new AppError('Lesson not found', ErrorCodes.NOT_FOUND, 404);
  }

  const recordings = await listLessonRecordings(lessonId);
  const storage = getStorageConfig();
  const keys = recordings
    .filter((recording) => recording.storageKey)
    .map((recording) => toStorageKey(recording.storageKey!, storage.bucketVideos));

  let signed: Record<string, string> = {};
  if (keys.length > 0) {
    try {
      signed = await generateVideoDownloadPresignedUrls(keys);
    } catch (error) {
      console.warn('listRecordingsForLesson: presign failed:', error instanceof Error ? error.message : error);
    }
  }

  return recordings.map((recording) => ({
    ...recording,
    playbackUrl: recording.storageKey
      ? (signed[toStorageKey(recording.storageKey, storage.bucketVideos)] ?? recording.location)
      : null
  }));
}
