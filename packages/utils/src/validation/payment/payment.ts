import * as z from 'zod';

/** Payment methods enabled for MicAcademia course enrollment (Phase 1). */
export const ZEasypayMethod = z.enum(['multibanco', 'mbway']);
export type TEasypayMethod = z.infer<typeof ZEasypayMethod>;

/**
 * Body for POST /course/:courseId/easypay/checkout.
 * courseId comes from the URL param, not the body.
 */
export const ZCreateEasypayCheckout = z
  .object({
    method: ZEasypayMethod,
    /** The class (turma) being bought. Required only for courses that run in classes. */
    classId: z.union([z.uuid(), z.literal('')]).optional(),
    /** MB WAY sends a push to this phone — required for mbway, ignored for multibanco. */
    phone: z.string().min(6).max(20).optional(),
    /** Optional payer identity; falls back to the authenticated user. */
    email: z.email().optional(),
    fullname: z.string().min(1).max(120).optional()
  })
  .refine((value) => value.method !== 'mbway' || Boolean(value.phone), {
    message: 'Phone number is required for MB WAY',
    path: ['phone']
  });
export type TCreateEasypayCheckout = z.infer<typeof ZCreateEasypayCheckout>;

/**
 * EasyPay notification payload. EasyPay does not send a stable schema across
 * events/versions, so known fields are optional and everything else passes
 * through. `payment_status` is the authoritative status field; some events use
 * `status` — the handler reads both.
 */
export const ZEasypayWebhook = z
  .object({
    id: z.string().optional(),
    key: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    payment_status: z.string().optional(),
    value: z.number().optional(),
    currency: z.string().optional(),
    method: z.unknown().optional(),
    messages: z.array(z.string()).optional()
  })
  .catchall(z.unknown());
export type TEasypayWebhook = z.infer<typeof ZEasypayWebhook>;
