import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { orgAdminMiddleware } from '@api/middlewares/org-admin';
import { handleError } from '@api/utils/errors';
import { zValidator } from '@hono/zod-validator';
import { ZCreateSigoSubmission, ZUpdateSigoSubmission } from '@cio/utils/validation';
import {
  createOrgSigoSubmission,
  deleteOrgSigoSubmission,
  listOrgSigoSubmissions,
  updateOrgSigoSubmission
} from '@api/services/sigo/sigo';

/** SIGO submission tracker. Org-admin only; orgId comes from the `cio-org-id` header. */
export const sigoRouter = new Hono()
  .use('*', authMiddleware, orgAdminMiddleware)
  .get('/', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const submissions = await listOrgSigoSubmissions(orgId);

      return c.json({ success: true, data: submissions }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to list SIGO submissions');
    }
  })
  .post('/', zValidator('json', ZCreateSigoSubmission), async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const user = c.get('user')!;
      const submission = await createOrgSigoSubmission(orgId, c.req.valid('json'), user.id);

      return c.json({ success: true, data: submission }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to create SIGO submission');
    }
  })
  .put('/:submissionId', zValidator('json', ZUpdateSigoSubmission), async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const submissionId = c.req.param('submissionId');
      const submission = await updateOrgSigoSubmission(orgId, submissionId, c.req.valid('json'));

      return c.json({ success: true, data: submission }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to update SIGO submission');
    }
  })
  .delete('/:submissionId', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const submissionId = c.req.param('submissionId');
      await deleteOrgSigoSubmission(orgId, submissionId);

      return c.json({ success: true, data: { id: submissionId } }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to delete SIGO submission');
    }
  });
