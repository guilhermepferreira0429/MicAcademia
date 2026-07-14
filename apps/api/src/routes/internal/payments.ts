import { Hono } from '@api/utils/hono';
import { apiKeyMiddleware } from '@api/middlewares/api-key';
import { handleError } from '@api/utils/errors';
import { reconcileEasypayPayments } from '@api/services/payments/easypay';

export const internalPaymentsRouter = new Hono()
  /**
   * POST /internal/payments/easypay/reconcile
   * Lost-webhook safety net: re-checks pending/failed EasyPay payments against
   * EasyPay and settles ours. Triggered by the BullMQ maintenance scheduler
   * (server-to-server, PRIVATE_SERVER_KEY). Keeps all grant logic in the API.
   */
  .post('/easypay/reconcile', apiKeyMiddleware, async (c) => {
    try {
      const windowHoursRaw = c.req.query('windowHours');
      const windowHours = windowHoursRaw ? Number(windowHoursRaw) : 168;
      const result = await reconcileEasypayPayments(
        Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 168
      );

      return c.json({ success: true, data: result }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to reconcile EasyPay payments');
    }
  });
