import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { orgAdminMiddleware } from '@api/middlewares/org-admin';
import { handleError } from '@api/utils/errors';
import { computeRevenueShareReport } from '@api/services/payments/revenue-share';

/** Revenue-share reporting. Org-admin only; orgId from the `cio-org-id` header. */
export const revenueShareRouter = new Hono().use('*', authMiddleware, orgAdminMiddleware).get('/report', async (c) => {
  try {
    const orgId = c.req.header('cio-org-id')!;
    const from = c.req.query('from') || undefined;
    const to = c.req.query('to') || undefined;

    const report = await computeRevenueShareReport(orgId, from, to);

    return c.json({ success: true, data: report }, 200);
  } catch (error) {
    return handleError(c, error, 'Failed to compute revenue-share report');
  }
});
