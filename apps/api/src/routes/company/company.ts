import { Hono } from '@api/utils/hono';
import { authMiddleware } from '@api/middlewares/auth';
import { orgAdminMiddleware } from '@api/middlewares/org-admin';
import { handleError } from '@api/utils/errors';
import { zValidator } from '@hono/zod-validator';
import {
  ZAddCompanyMember,
  ZCompanyBulkEnroll,
  ZCreateCompany,
  ZUpdateCompany,
  ZUpdateCompanyEnrollment
} from '@cio/utils/validation';
import {
  addOrgCompanyMember,
  bulkEnrollCompany,
  createOrgCompany,
  deleteOrgCompany,
  getCompanyAnnualTraining,
  getCompanyTrainingReport,
  getOrgCompanyDetail,
  listOrgCompanies,
  removeOrgCompanyMember,
  updateOrgCompany,
  updateOrgCompanyEnrollment
} from '@api/services/company/company';

/** B2B company accounts. Org-admin only; orgId comes from the `cio-org-id` header. */
export const companyRouter = new Hono()
  .use('*', authMiddleware, orgAdminMiddleware)
  .get('/', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;

      return c.json({ success: true, data: await listOrgCompanies(orgId) }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to list companies');
    }
  })
  .post('/', zValidator('json', ZCreateCompany), async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;

      return c.json({ success: true, data: await createOrgCompany(orgId, c.req.valid('json')) }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to create company');
    }
  })
  .get('/:companyId', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;

      return c.json({ success: true, data: await getOrgCompanyDetail(orgId, c.req.param('companyId')) }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to fetch company');
    }
  })
  .put('/:companyId', zValidator('json', ZUpdateCompany), async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const updated = await updateOrgCompany(orgId, c.req.param('companyId'), c.req.valid('json'));

      return c.json({ success: true, data: updated }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to update company');
    }
  })
  .delete('/:companyId', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const companyId = c.req.param('companyId');
      await deleteOrgCompany(orgId, companyId);

      return c.json({ success: true, data: { id: companyId } }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to delete company');
    }
  })
  .post('/:companyId/members', zValidator('json', ZAddCompanyMember), async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const members = await addOrgCompanyMember(orgId, c.req.param('companyId'), c.req.valid('json'));

      return c.json({ success: true, data: members }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to add company member');
    }
  })
  .delete('/:companyId/members/:profileId', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const members = await removeOrgCompanyMember(orgId, c.req.param('companyId'), c.req.param('profileId'));

      return c.json({ success: true, data: members }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to remove company member');
    }
  })
  /**
   * POST /company/:companyId/enrollments
   * Enrols a batch of staff into a course and records one order for the whole
   * batch, so the company is invoiced once instead of per employee.
   */
  .post('/:companyId/enrollments', zValidator('json', ZCompanyBulkEnroll), async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const user = c.get('user')!;
      const result = await bulkEnrollCompany(orgId, c.req.param('companyId'), c.req.valid('json'), user.id);

      return c.json({ success: true, data: result }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to enrol company staff');
    }
  })
  .put('/:companyId/enrollments/:enrollmentId', zValidator('json', ZUpdateCompanyEnrollment), async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const enrollments = await updateOrgCompanyEnrollment(
        orgId,
        c.req.param('companyId'),
        c.req.param('enrollmentId'),
        c.req.valid('json')
      );

      return c.json({ success: true, data: enrollments }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to update order');
    }
  })
  /**
   * GET /company/:companyId/report
   * What each employee has done: courses, hours actually attended, certificates.
   */
  .get('/:companyId/report', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const report = await getCompanyTrainingReport(orgId, c.req.param('companyId'));

      return c.json({ success: true, data: report }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to build training report');
    }
  })
  /**
   * GET /company/:companyId/annual-training?year=YYYY
   * Progress against the legal annual training obligation (40h/worker/year in
   * Portugal, overridable per company), from real attended hours.
   */
  .get('/:companyId/annual-training', async (c) => {
    try {
      const orgId = c.req.header('cio-org-id')!;
      const yearParam = Number(c.req.query('year'));
      const year = Number.isInteger(yearParam) && yearParam > 2000 ? yearParam : new Date().getUTCFullYear();

      const report = await getCompanyAnnualTraining(orgId, c.req.param('companyId'), year);

      return c.json({ success: true, data: report }, 200);
    } catch (error) {
      return handleError(c, error, 'Failed to build annual training report');
    }
  });
