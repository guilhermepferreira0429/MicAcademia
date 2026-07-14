import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { handleError } from '@api/utils/errors';
import { zValidator } from '@hono/zod-validator';
import { ZCreateEasypayCheckout } from '@cio/utils/validation';
import { createCourseCheckout, verifyCoursePayment } from '@api/services/payments/easypay';

export const easypayRouter = new Hono()
  /**
   * POST /course/:courseId/easypay/checkout
   * Creates an EasyPay payment (Multibanco reference or MB WAY push) for a paid
   * course and writes a pending payment record. Access is granted only when
   * EasyPay confirms (webhook / verify), not here.
   */
  .post('/checkout', authMiddleware, zValidator('json', ZCreateEasypayCheckout), async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const body = c.req.valid('json');
      const user = c.get('user')!;

      const result = await createCourseCheckout(courseId, { id: user.id, email: user.email }, body);

      return c.json({ success: true, data: result }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to create payment');
    }
  })
  /**
   * GET /course/:courseId/easypay/verify
   * Live status check for post-checkout polling (Multibanco/MB WAY have no
   * hosted redirect). Reconciles the payment against EasyPay and grants access
   * if it settled.
   */
  .get('/verify', authMiddleware, async (c) => {
    try {
      const courseId = c.req.param('courseId')!;
      const user = c.get('user')!;

      const result = await verifyCoursePayment(courseId, { id: user.id, email: user.email });

      return c.json({ success: true, data: result }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to verify payment');
    }
  });
