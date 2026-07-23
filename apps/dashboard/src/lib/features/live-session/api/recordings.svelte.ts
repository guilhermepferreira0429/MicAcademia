import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';

import type {
  ListRecordingsRequest,
  PublishRecordingRequest,
  Recordings,
  StartRecordingRequest,
  StopRecordingRequest
} from '../utils/types';
import { snackbar } from '$features/ui/snackbar/store';

/**
 * Recordings of a live lesson. The class records itself, so this is mostly a
 * read-only view — the start/stop actions exist for the class that was already
 * running when someone noticed it was not being recorded.
 */
export class RecordingsApi extends BaseApiWithErrors {
  recordings = $state<Recordings>([]);

  /** False when the server has no egress/storage configured — the UI says so. */
  isConfigured = $state(true);

  async list(courseId: string, lessonId: string) {
    await this.execute<ListRecordingsRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].livekit[':lessonId'].recordings.$get({ param: { courseId, lessonId } }),
      logContext: 'fetching lesson recordings',
      onSuccess: (response) => {
        if (response.data) {
          this.recordings = response.data.recordings;
          this.isConfigured = response.data.isConfigured;
        }
      },
      onError: (result) => {
        if (typeof result === 'string') {
          snackbar.error('live_session.recordings.snackbar.list_failed');
        }
      }
    });
  }

  async start(courseId: string, lessonId: string) {
    await this.execute<StartRecordingRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].livekit[':lessonId'].recordings.start.$post({ param: { courseId, lessonId } }),
      logContext: 'starting lesson recording',
      onSuccess: async () => {
        snackbar.success('live_session.recordings.snackbar.started');
        await this.list(courseId, lessonId);
      },
      onError: (result) => this.handleFormError(result, 'live_session.recordings.snackbar.start_failed')
    });
  }

  async stop(courseId: string, lessonId: string) {
    await this.execute<StopRecordingRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].livekit[':lessonId'].recordings.stop.$post({ param: { courseId, lessonId } }),
      logContext: 'stopping lesson recording',
      onSuccess: async () => {
        snackbar.success('live_session.recordings.snackbar.stopped');
        await this.list(courseId, lessonId);
      },
      onError: (result) => this.handleFormError(result, 'live_session.recordings.snackbar.stop_failed')
    });
  }

  /** Re-attaches a recording to the lesson; normally this happens by itself. */
  async publish(courseId: string, lessonId: string, recordingId: string) {
    await this.execute<PublishRecordingRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].livekit[':lessonId'].recordings[':recordingId'].publish.$post({
          param: { courseId, lessonId, recordingId }
        }),
      logContext: 'publishing lesson recording',
      onSuccess: async () => {
        snackbar.success('live_session.recordings.snackbar.published');
        await this.list(courseId, lessonId);
      },
      onError: (result) => this.handleFormError(result, 'live_session.recordings.snackbar.publish_failed')
    });
  }

  override reset() {
    super.reset();
    this.recordings = [];
  }
}

export const recordingsApi = /* @__PURE__ */ new RecordingsApi();
