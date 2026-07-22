import * as z from 'zod';

/** Company members are either staff being trained or the HR contact following progress. */
export const ZCompanyMemberRole = z.enum(['employee', 'manager']);
export type TCompanyMemberRole = z.infer<typeof ZCompanyMemberRole>;

export const ZCompanyEnrollmentStatus = z.enum(['pending', 'invoiced', 'paid']);
export type TCompanyEnrollmentStatus = z.infer<typeof ZCompanyEnrollmentStatus>;

export const ZCreateCompany = z.object({
  name: z.string().min(2).max(160),
  /** Portuguese tax number (9 digits); empty clears it. */
  nif: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{9}$/.test(value), { message: 'NIF must have 9 digits' })
    .optional(),
  email: z.union([z.email(), z.literal('')]).optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(400).optional(),
  notes: z.string().max(2000).optional(),
  /** Training hours required per employee per year; blank uses the 40h legal minimum. */
  annualTrainingHours: z.number().int().min(1).max(2000).nullable().optional()
});
export type TCreateCompany = z.infer<typeof ZCreateCompany>;

export const ZUpdateCompany = ZCreateCompany.partial();
export type TUpdateCompany = z.infer<typeof ZUpdateCompany>;

export const ZAddCompanyMember = z.object({
  profileId: z.string().uuid(),
  role: ZCompanyMemberRole.optional(),
  jobTitle: z.string().max(120).optional()
});
export type TAddCompanyMember = z.infer<typeof ZAddCompanyMember>;

/** Enrol a batch of a company's staff into one course, billed as a single order. */
export const ZCompanyBulkEnroll = z.object({
  courseId: z.string().uuid(),
  profileIds: z.array(z.string().uuid()).min(1).max(500),
  /** Price per seat in cents; defaults to the course price. */
  unitPriceCents: z.number().int().min(0).optional()
});
export type TCompanyBulkEnroll = z.infer<typeof ZCompanyBulkEnroll>;

export const ZUpdateCompanyEnrollment = z.object({
  status: ZCompanyEnrollmentStatus.optional(),
  invoiceReference: z.string().max(120).optional()
});
export type TUpdateCompanyEnrollment = z.infer<typeof ZUpdateCompanyEnrollment>;
