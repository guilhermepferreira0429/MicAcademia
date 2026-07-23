import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EgressStatus } from 'livekit-server-sdk';

import {
  getLessonById,
  getLessonRecordingById,
  updateLesson,
  updateLessonRecording,
  upsertLessonRecording
} from '@cio/db/queries/lesson';

import {
  buildRecordingFilepath,
  handleEgressEvent,
  mapEgressStatus,
  publishRecordingToLesson
} from '@api/services/livekit/recording';

/**
 * Recording of live classes. The valuable part is not starting the recorder —
 * it is that a finished file ends up published on the lesson without anyone
 * remembering to do it, and that it is not published twice.
 */

vi.mock('@cio/db/queries/lesson', () => ({
  getActiveLessonRecording: vi.fn(),
  getLessonById: vi.fn(),
  getLessonRecordingById: vi.fn(),
  getLessonRecordingByEgressId: vi.fn(),
  listLessonRecordings: vi.fn(),
  updateLesson: vi.fn(),
  updateLessonRecording: vi.fn(),
  upsertLessonRecording: vi.fn()
}));

vi.mock('@cio/db/queries/attendance', () => ({
  closeAttendanceEntry: vi.fn(),
  closeOpenAttendanceEntriesForLesson: vi.fn(),
  createAttendanceEntry: vi.fn(),
  getOpenAttendanceEntry: vi.fn(),
  listAttendanceForLesson: vi.fn(),
  upsertAttendance: vi.fn()
}));

vi.mock('@cio/db/queries/course', () => ({ getCourseWithRelations: vi.fn(), getCourseTeachers: vi.fn() }));
vi.mock('@cio/db/queries/group', () => ({ getGroupMemberIdByGroupAndProfile: vi.fn() }));

vi.mock('@cio/core/config/storage', () => ({
  getStorageConfig: () => ({
    endpoint: 'http://minio:9000',
    region: 'us-east-1',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    forcePathStyle: true,
    bucketVideos: 'videos',
    bucketDocuments: 'documents',
    bucketMedia: 'media',
    mediaPublicBaseUrl: null,
    presignUploadExpiresSeconds: 3600,
    presignDownloadExpiresSeconds: 3600
  })
}));

vi.mock('@cio/core/utils/s3', () => ({
  generateVideoDownloadPresignedUrls: vi.fn(async (keys: string[]) =>
    Object.fromEntries(keys.map((key) => [key, `https://signed.example/${key}`]))
  )
}));

const mockedGetLesson = vi.mocked(getLessonById);
const mockedUpsert = vi.mocked(upsertLessonRecording);
const mockedGetRecording = vi.mocked(getLessonRecordingById);
const mockedUpdateLesson = vi.mocked(updateLesson);
const mockedUpdateRecording = vi.mocked(updateLessonRecording);

const LESSON_ID = '22222222-2222-4222-8222-222222222222';
const ROOM = `mica-lesson-${LESSON_ID}`;

function buildRecording(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    courseId: 'course-1',
    lessonId: LESSON_ID,
    egressId: 'EG_123',
    roomName: ROOM,
    status: 'complete',
    storageKey: 'videos/recordings/course-1/lesson/rec.mp4',
    location: 'http://minio:9000/videos/recordings/course-1/lesson/rec.mp4',
    durationSeconds: 5400,
    sizeBytes: 1024,
    startedAt: '2026-01-12T19:00:00.000Z',
    endedAt: '2026-01-12T20:30:00.000Z',
    publishedAt: null,
    error: null,
    payload: null,
    createdAt: '2026-01-12T19:00:00.000Z',
    updatedAt: '2026-01-12T20:30:00.000Z',
    ...overrides
  } as never;
}

describe('buildRecordingFilepath', () => {
  it('files a recording under its course and lesson', () => {
    expect(buildRecordingFilepath('course-1', LESSON_ID)).toBe(
      `recordings/course-1/${LESSON_ID}/{room_name}-{time}.mp4`
    );
  });
});

describe('mapEgressStatus', () => {
  it('translates every LiveKit status into one of ours', () => {
    expect(mapEgressStatus(EgressStatus.EGRESS_STARTING)).toBe('starting');
    expect(mapEgressStatus(EgressStatus.EGRESS_ACTIVE)).toBe('active');
    // Ending still holds the room, so it must not read as finished yet.
    expect(mapEgressStatus(EgressStatus.EGRESS_ENDING)).toBe('active');
    expect(mapEgressStatus(EgressStatus.EGRESS_COMPLETE)).toBe('complete');
    expect(mapEgressStatus(EgressStatus.EGRESS_FAILED)).toBe('failed');
    expect(mapEgressStatus(EgressStatus.EGRESS_ABORTED)).toBe('aborted');
    expect(mapEgressStatus(EgressStatus.EGRESS_LIMIT_REACHED)).toBe('aborted');
    expect(mapEgressStatus(undefined)).toBe('starting');
  });
});

describe('handleEgressEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetLesson.mockResolvedValue({ id: LESSON_ID, courseId: 'course-1', title: 'Aula 1', videos: [] } as never);
    mockedUpsert.mockResolvedValue(buildRecording({ status: 'active', storageKey: null }));
  });

  it('ignores an event without egress info', async () => {
    await expect(handleEgressEvent({ event: 'egress_started' } as never)).resolves.toEqual({ handled: false });
  });

  it('ignores a room that is not one of our lessons', async () => {
    const result = await handleEgressEvent({
      event: 'egress_started',
      egressInfo: { egressId: 'EG_1', roomName: 'some-other-room', status: EgressStatus.EGRESS_ACTIVE }
    } as never);

    expect(result).toEqual({ handled: false });
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it('records a started egress as active', async () => {
    await handleEgressEvent({
      event: 'egress_started',
      egressInfo: {
        egressId: 'EG_123',
        roomName: ROOM,
        status: EgressStatus.EGRESS_ACTIVE,
        startedAt: BigInt(Date.parse('2026-01-12T19:00:00.000Z')) * BigInt(1_000_000)
      }
    } as never);

    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonId: LESSON_ID,
        egressId: 'EG_123',
        status: 'active',
        startedAt: '2026-01-12T19:00:00.000Z'
      })
    );
  });

  it('stores the file and publishes it when the recording finishes', async () => {
    mockedUpsert.mockResolvedValue(buildRecording());
    mockedGetRecording.mockResolvedValue(buildRecording());
    mockedUpdateRecording.mockResolvedValue(buildRecording({ publishedAt: '2026-01-12T20:31:00.000Z' }));

    await handleEgressEvent({
      event: 'egress_ended',
      egressInfo: {
        egressId: 'EG_123',
        roomName: ROOM,
        status: EgressStatus.EGRESS_COMPLETE,
        fileResults: [
          {
            filename: 'videos/recordings/course-1/lesson/rec.mp4',
            location: 'http://minio:9000/videos/recordings/course-1/lesson/rec.mp4',
            duration: BigInt(5400) * BigInt(1_000_000_000),
            size: BigInt(1024)
          }
        ]
      }
    } as never);

    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'complete', durationSeconds: 5400, sizeBytes: 1024 })
    );
    expect(mockedUpdateLesson).toHaveBeenCalled();
  });

  it('keeps the failure reason of a recording that broke', async () => {
    mockedUpsert.mockResolvedValue(buildRecording({ status: 'failed', storageKey: null }));

    await handleEgressEvent({
      event: 'egress_ended',
      egressInfo: {
        egressId: 'EG_123',
        roomName: ROOM,
        status: EgressStatus.EGRESS_FAILED,
        error: 'no space left on device'
      }
    } as never);

    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: 'no space left on device' })
    );
    expect(mockedUpdateLesson).not.toHaveBeenCalled();
  });
});

describe('publishRecordingToLesson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetLesson.mockResolvedValue({ id: LESSON_ID, courseId: 'course-1', title: 'Aula 1', videos: [] } as never);
    mockedUpdateRecording.mockResolvedValue(buildRecording({ publishedAt: '2026-01-12T20:31:00.000Z' }));
  });

  it('adds the recording to the lesson as an uploaded video, keyed without the bucket', async () => {
    mockedGetRecording.mockResolvedValue(buildRecording());

    await publishRecordingToLesson('rec-1');

    expect(mockedUpdateLesson).toHaveBeenCalledWith(
      LESSON_ID,
      expect.objectContaining({
        videos: [
          expect.objectContaining({
            type: 'upload',
            key: 'recordings/course-1/lesson/rec.mp4',
            link: 'https://signed.example/recordings/course-1/lesson/rec.mp4'
          })
        ]
      })
    );
  });

  it('does nothing for a recording that was already published', async () => {
    mockedGetRecording.mockResolvedValue(buildRecording({ publishedAt: '2026-01-12T20:31:00.000Z' }));

    await publishRecordingToLesson('rec-1');

    expect(mockedUpdateLesson).not.toHaveBeenCalled();
  });

  it('does not add the same video twice if the lesson already has it', async () => {
    mockedGetRecording.mockResolvedValue(buildRecording());
    mockedGetLesson.mockResolvedValue({
      id: LESSON_ID,
      courseId: 'course-1',
      title: 'Aula 1',
      videos: [{ type: 'upload', link: 'x', key: 'recordings/course-1/lesson/rec.mp4' }]
    } as never);

    await publishRecordingToLesson('rec-1');

    expect(mockedUpdateLesson).not.toHaveBeenCalled();
    expect(mockedUpdateRecording).toHaveBeenCalledWith(
      'rec-1',
      expect.objectContaining({ publishedAt: expect.any(String) })
    );
  });

  it('keeps the existing videos of the lesson', async () => {
    mockedGetRecording.mockResolvedValue(buildRecording());
    mockedGetLesson.mockResolvedValue({
      id: LESSON_ID,
      courseId: 'course-1',
      title: 'Aula 1',
      videos: [{ type: 'youtube', link: 'https://youtu.be/abc' }]
    } as never);

    await publishRecordingToLesson('rec-1');

    const [, patch] = mockedUpdateLesson.mock.calls[0]!;
    expect((patch as { videos: unknown[] }).videos).toHaveLength(2);
  });

  it('refuses to publish a recording that does not exist', async () => {
    mockedGetRecording.mockResolvedValue(null);

    await expect(publishRecordingToLesson('missing')).rejects.toThrow(/not found/i);
  });
});
