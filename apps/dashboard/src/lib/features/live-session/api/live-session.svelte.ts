import { BaseApiWithErrors, classroomio } from '$lib/utils/services/api';

import type { LiveSessionToken, LiveSessionTokenRequest } from '../utils/types';

class LiveSessionApi extends BaseApiWithErrors {
  session = $state<LiveSessionToken | null>(null);

  /** Fetches a LiveKit join token for a live lesson (course members only). */
  async getToken(courseId: string, lessonId: string) {
    const result = await this.execute<LiveSessionTokenRequest>({
      requestFn: () =>
        classroomio.course[':courseId'].livekit[':lessonId'].token.$get({
          param: { courseId, lessonId }
        }),
      logContext: 'fetching live session token'
    });

    this.session = result?.data ?? null;

    return this.session;
  }

  reset() {
    super.reset();
    this.session = null;
  }
}

export const liveSessionApi = /* @__PURE__ */ new LiveSessionApi();
