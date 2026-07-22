import { AppError, ErrorCodes } from '@api/utils/errors';
import {
  createSigoSubmission,
  deleteSigoSubmission,
  listSigoSubmissions,
  updateSigoSubmission,
  type SigoSubmissionRow
} from '@cio/db/queries/sigo';
import type { TNewSigoSubmission, TSigoSubmission } from '@cio/db/types';
import type { TCreateSigoSubmission, TUpdateSigoSubmission } from '@cio/utils/validation';

/**
 * SIGO submission tracker (PRD 3.2). IEFP exposes no public API, so moving a
 * training action from submitted → approved → paid is recorded by hand here.
 */

/** Empty strings from forms mean "not set". */
function normalize(data: TCreateSigoSubmission | TUpdateSigoSubmission): Partial<TNewSigoSubmission> {
  const patch: Partial<TNewSigoSubmission> = { ...data };

  for (const key of ['reference', 'submittedAt', 'approvedAt', 'paidAt', 'notes'] as const) {
    if (patch[key] === '') patch[key] = null;
  }

  return patch;
}

/**
 * Stamps the date for a stage when the status moves there and no date was
 * given — so the tracker stays accurate without extra typing.
 */
function withStatusTimestamps(patch: Partial<TNewSigoSubmission>): Partial<TNewSigoSubmission> {
  const now = new Date().toISOString();
  const stamped = { ...patch };

  if (stamped.status === 'submitted' && !stamped.submittedAt) stamped.submittedAt = now;
  if (stamped.status === 'approved' && !stamped.approvedAt) stamped.approvedAt = now;
  if (stamped.status === 'paid' && !stamped.paidAt) stamped.paidAt = now;

  return stamped;
}

export async function listOrgSigoSubmissions(orgId: string): Promise<SigoSubmissionRow[]> {
  return listSigoSubmissions(orgId);
}

export async function createOrgSigoSubmission(
  orgId: string,
  data: TCreateSigoSubmission,
  createdBy: string
): Promise<TSigoSubmission> {
  return createSigoSubmission({
    ...withStatusTimestamps(normalize(data)),
    orgId,
    courseId: data.courseId,
    createdBy
  });
}

export async function updateOrgSigoSubmission(
  orgId: string,
  id: string,
  data: TUpdateSigoSubmission
): Promise<TSigoSubmission> {
  const updated = await updateSigoSubmission(id, orgId, withStatusTimestamps(normalize(data)));
  if (!updated) {
    throw new AppError('Submission not found', ErrorCodes.NOT_FOUND, 404);
  }

  return updated;
}

export async function deleteOrgSigoSubmission(orgId: string, id: string): Promise<void> {
  const deleted = await deleteSigoSubmission(id, orgId);
  if (!deleted) {
    throw new AppError('Submission not found', ErrorCodes.NOT_FOUND, 404);
  }
}
