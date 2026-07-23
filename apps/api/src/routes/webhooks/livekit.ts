import { Hono } from '@api/utils/hono';
import { handleError } from '@api/utils/errors';
import { handleLiveKitEvent, receiveLiveKitWebhook } from '@api/services/livekit/attendance';
import { handleEgressEvent } from '@api/services/livekit/recording';

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

      // Egress events carry no participant and name the room inside egressInfo,
      // so they take their own path instead of the attendance handler.
      const result = event.event.startsWith('egress_')
        ? await handleEgressEvent(event)
        : await handleLiveKitEvent(event);

      return c.json({ success: true, event: event.event, handled: result.handled }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to process LiveKit webhook');
    }
  });
