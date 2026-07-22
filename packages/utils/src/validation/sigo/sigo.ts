import * as z from 'zod';

/** Where a SIGO submission stands. IEFP has no API, so this is tracked by hand. */
export const ZSigoStatus = z.enum(['pending', 'submitted', 'approved', 'paid', 'rejected']);
export type TSigoStatus = z.infer<typeof ZSigoStatus>;

const submissionFields = {
  status: ZSigoStatus.optional(),
  /** Reference SIGO assigns the submission. */
  reference: z.string().max(120).optional(),
  submittedAt: z.string().max(40).optional(),
  approvedAt: z.string().max(40).optional(),
  paidAt: z.string().max(40).optional(),
  /** Funding amount in cents. */
  amountCents: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional()
};

export const ZCreateSigoSubmission = z.object({
  courseId: z.string().uuid(),
  ...submissionFields
});
export type TCreateSigoSubmission = z.infer<typeof ZCreateSigoSubmission>;

export const ZUpdateSigoSubmission = z.object(submissionFields);
export type TUpdateSigoSubmission = z.infer<typeof ZUpdateSigoSubmission>;
