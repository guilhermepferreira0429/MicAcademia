import { Hono } from '@api/utils/hono';
import { handleError } from '@api/utils/errors';
import { handleLiveKitEvent, receiveLiveKitWebhook } from '@api/services/livekit/attendance';

export const livekitWebhookRouter = new Hono()
  /**
   * POST /webhooks/livekit
   * LiveKit server events (participant_joined/left, room_finished) that drive
   * live-session attendance. Authenticated by LiveKit's signed Authorization
   * header, verified against our API secret — hence the raw body read.
   */
  .post('/livekit', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      if (!authHeader) {
        return c.json({ success: false, error: 'Missing signature' }, 401);
      }

      const rawBody = await c.req.text();
      const event = await receiveLiveKitWebhook(rawBody, authHeader);
      const result = await handleLiveKitEvent(event);

      return c.json({ success: true, event: event.event, handled: result.handled }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to process LiveKit webhook');
    }
  });
