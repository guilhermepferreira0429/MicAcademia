import { Hono } from '@api/utils/hono';
import { env } from '@cio/core/config/env';
import { handleError } from '@api/utils/errors';
import { zValidator } from '@hono/zod-validator';
import { ZEasypayWebhook } from '@cio/utils/validation';
import { handleEasypayWebhook } from '@api/services/payments/easypay';

export const easypayWebhookRouter = new Hono()
  /**
   * POST /webhooks/easypay
   * EasyPay payment notification. Public (EasyPay has no per-request signature) —
   * guarded by an optional shared `?token=` matching EASYPAY_WEBHOOK_SECRET.
   * Always answers 200 so EasyPay doesn't retry unknown/settled payments.
   */
  .post('/easypay', zValidator('json', ZEasypayWebhook), async (c) => {
    try {
      const secret = env.EASYPAY_WEBHOOK_SECRET?.trim();
      if (secret && c.req.query('token') !== secret) {
        return c.json({ success: false }, 401);
      }

      const payload = c.req.valid('json');
      const result = await handleEasypayWebhook(payload);

      return c.json(result, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to process EasyPay webhook');
    }
  });
