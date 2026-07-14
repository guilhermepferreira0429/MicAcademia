import {
  createCoursePayment,
  getCoursePaymentById,
  getCoursePaymentByKey,
  getCoursePaymentByProviderId,
  getCourseWithRelations,
  getLatestCoursePaymentForProfile,
  listReconcilableCoursePayments,
  updateCoursePayment
} from '@cio/db/queries/course';
import { getGroupMemberIdByGroupAndProfile } from '@cio/db/queries/group';

import { AppError, ErrorCodes } from '@api/utils/errors';
import type { TCoursePayment, TNewCoursePayment } from '@cio/db/types';
import type { TCreateEasypayCheckout, TEasypayWebhook } from '@cio/utils/validation';
import { grantCourseAccessForPayment } from '@api/services/course/invite';
import {
  createSinglePayment,
  getSinglePayment,
  isEasypayConfigured,
  isFailedStatus,
  isPaidStatus,
  type EasypaySingleResponse
} from './easypay-client';

/** Minimal authenticated-user shape used by the payment flows. */
interface AuthUser {
  id: string;
  email: string;
}

interface CheckoutResult {
  paymentId: string;
  status: TCoursePayment['status'];
  method: string;
  amountCents: number;
  currency: string;
  /** Present for Multibanco — the reference the payer uses at an ATM / homebanking. */
  multibanco?: { entity: string; reference: string };
  /** Present for MB WAY — a push was sent to this phone. */
  mbway?: { phone: string };
  expiresAt: string | null;
}

/** Effective amount in euros, applying the landing-page discount if enabled. */
function resolveAmountEuros(cost: unknown, metadata: unknown): number {
  const rawCost = Number(cost ?? 0);
  const meta = (metadata as { showDiscount?: boolean; discount?: number } | null) ?? null;

  if (meta?.showDiscount && meta?.discount) {
    return rawCost - (meta.discount / 100) * rawCost;
  }

  return rawCost;
}

/**
 * Marks a payment paid and grants course access. Idempotent — a no-op if the
 * payment is already paid. Safe to call from the webhook, verify, and reconcile.
 */
async function markPaidAndGrant(payment: TCoursePayment, rawPayload?: unknown): Promise<void> {
  if (payment.status === 'paid') {
    return;
  }

  await updateCoursePayment(payment.id, {
    status: 'paid',
    paidAt: new Date().toISOString(),
    ...(rawPayload ? { payload: rawPayload as TNewCoursePayment['payload'] } : {})
  });

  if (payment.profileId) {
    await grantCourseAccessForPayment({
      courseId: payment.courseId,
      profileId: payment.profileId,
      email: payment.email
    });
  }
}

/** Applies EasyPay live/notified status to our payment record. */
async function applyEasypayStatus(
  payment: TCoursePayment,
  status: string | undefined,
  rawPayload?: unknown
): Promise<TCoursePayment['status']> {
  if (isPaidStatus(status)) {
    await markPaidAndGrant(payment, rawPayload);

    return 'paid';
  }

  if (isFailedStatus(status)) {
    if (payment.status !== 'paid' && payment.status !== 'failed') {
      const reason = String(status ?? 'failed');
      await updateCoursePayment(payment.id, {
        status: 'failed',
        failureReason: reason,
        ...(rawPayload ? { payload: rawPayload as TNewCoursePayment['payload'] } : {})
      });
    }

    return 'failed';
  }

  return payment.status;
}

/**
 * Creates an EasyPay checkout for a paid course enrollment and writes a pending
 * payment record. Access is NOT granted here — only when EasyPay confirms.
 */
export async function createCourseCheckout(
  courseId: string,
  user: AuthUser,
  body: TCreateEasypayCheckout
): Promise<CheckoutResult> {
  if (!isEasypayConfigured()) {
    throw new AppError('EasyPay is not configured', ErrorCodes.VALIDATION_ERROR, 400);
  }

  if (!user.id || !user.email) {
    throw new AppError('Authenticated user email is required', ErrorCodes.UNAUTHORIZED, 401);
  }

  const course = await getCourseWithRelations(courseId);
  if (!course) {
    throw new AppError('Course not found', ErrorCodes.COURSE_NOT_FOUND, 404);
  }

  const { groupId, status, isPublished, title, org } = course;
  if (!groupId || !org) {
    throw new AppError('Course not found', ErrorCodes.COURSE_NOT_FOUND, 404);
  }

  if (status !== 'ACTIVE' || !isPublished) {
    throw new AppError('This course is not available for enrollment', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const amountEuros = resolveAmountEuros(course.cost, course.metadata);
  if (!(amountEuros > 0)) {
    throw new AppError('This is a free course — no payment is required', ErrorCodes.VALIDATION_ERROR, 400);
  }

  // Already enrolled? Don't take money for access they already have.
  const existingMemberId = await getGroupMemberIdByGroupAndProfile(groupId, user.id);
  if (existingMemberId) {
    throw new AppError('You are already enrolled in this course', ErrorCodes.VALIDATION_ERROR, 400);
  }

  // Pre-retry: if a previous payment exists, check it live before creating a new
  // one. If it already settled (missed webhook), grant access and stop.
  const previous = await getLatestCoursePaymentForProfile(courseId, user.id);
  if (previous?.status === 'pending' && previous.providerPaymentId) {
    try {
      const live = await getSinglePayment(previous.providerPaymentId);
      if (isPaidStatus(live.payment_status ?? live.status)) {
        await markPaidAndGrant(previous, live);
        throw new AppError('This course has already been paid', ErrorCodes.VALIDATION_ERROR, 400);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Network failure on the live check must not block a fresh attempt.
    }
  }

  const amountCents = Math.round(amountEuros * 100);
  const currency = 'EUR';

  const pending = await createCoursePayment({
    courseId,
    orgId: org.id,
    profileId: user.id,
    email: user.email.toLowerCase().trim(),
    fullname: body.fullname ?? null,
    provider: 'easypay',
    method: body.method,
    status: 'pending',
    amountCents,
    currency,
    phone: body.method === 'mbway' ? (body.phone ?? null) : null,
    phoneIndicative: body.method === 'mbway' ? '+351' : null
  });

  const paymentKey = `MICA-${pending.id}`;

  let easypayResponse: EasypaySingleResponse;
  try {
    easypayResponse = await createSinglePayment({
      method: body.method,
      amountEuros,
      orderKey: paymentKey,
      transactionKey: `MICA-TX-${pending.id}`.substring(0, 50),
      customerKey: `MICA-C-${user.id}`.substring(0, 50),
      customerName: body.fullname ?? user.email,
      customerEmail: body.email ?? user.email,
      customerPhone: body.phone,
      descriptive: `${title}`.substring(0, 50)
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message.substring(0, 500) : 'Failed to create payment';
    await updateCoursePayment(pending.id, { status: 'failed', failureReason: reason, paymentKey });
    throw new AppError('Failed to create payment session', ErrorCodes.VALIDATION_ERROR, 400);
  }

  const method = easypayResponse.method ?? {};
  const updated = await updateCoursePayment(pending.id, {
    providerPaymentId: easypayResponse.id,
    paymentKey,
    mbEntity: method.entity ?? null,
    mbReference: method.reference ?? null,
    expiresAt: method.expiration_time ?? null,
    payload: easypayResponse as TNewCoursePayment['payload']
  });

  const record = updated ?? pending;

  return {
    paymentId: record.id,
    status: record.status,
    method: body.method,
    amountCents,
    currency,
    ...(body.method === 'multibanco' && method.entity && method.reference
      ? { multibanco: { entity: method.entity, reference: method.reference } }
      : {}),
    ...(body.method === 'mbway' ? { mbway: { phone: body.phone ?? '' } } : {}),
    expiresAt: record.expiresAt ?? null
  };
}

/**
 * Handles an EasyPay notification. Finds the payment by provider id or by our
 * key, then applies the status (granting access on paid). Idempotent.
 */
export async function handleEasypayWebhook(payload: TEasypayWebhook): Promise<{ success: boolean }> {
  const status = (payload.payment_status as string | undefined) ?? payload.status;

  let payment: TCoursePayment | null = null;
  if (typeof payload.id === 'string' && payload.id) {
    payment = await getCoursePaymentByProviderId(payload.id);
  }

  if (!payment && typeof payload.key === 'string' && payload.key) {
    payment = await getCoursePaymentByKey(payload.key);
  }

  if (!payment) {
    console.warn('handleEasypayWebhook: payment not found for', payload.id ?? payload.key);

    return { success: false };
  }

  await applyEasypayStatus(payment, status, payload);

  return { success: true };
}

/**
 * Live verification for post-redirect polling. Looks at the latest payment for
 * (course, user), asks EasyPay for its live status, reconciles, and returns it.
 */
export async function verifyCoursePayment(
  courseId: string,
  user: AuthUser
): Promise<{ status: TCoursePayment['status']; paymentId: string | null }> {
  if (!user.id) {
    throw new AppError('Authentication required', ErrorCodes.UNAUTHORIZED, 401);
  }

  const payment = await getLatestCoursePaymentForProfile(courseId, user.id);
  if (!payment) {
    return { status: 'pending', paymentId: null };
  }

  if (payment.status === 'paid') {
    return { status: 'paid', paymentId: payment.id };
  }

  if (payment.providerPaymentId) {
    try {
      const live = await getSinglePayment(payment.providerPaymentId);
      const status = await applyEasypayStatus(payment, live.payment_status ?? live.status, live);

      return { status, paymentId: payment.id };
    } catch (error) {
      console.warn('verifyCoursePayment live check failed:', error instanceof Error ? error.message : error);
    }
  }

  return { status: payment.status, paymentId: payment.id };
}

/** Reads a single payment record scoped to the requesting user (for the UI). */
export async function getCoursePaymentForUser(paymentId: string, user: AuthUser): Promise<TCoursePayment> {
  const payment = await getCoursePaymentById(paymentId);
  if (!payment || payment.profileId !== user.id) {
    throw new AppError('Payment not found', ErrorCodes.NOT_FOUND, 404);
  }

  return payment;
}

/**
 * Reconciliation pass (lost-webhook safety net). For pending/failed EasyPay
 * payments in the window, asks EasyPay for the live status and settles ours.
 * Returns how many were flipped to paid.
 */
export async function reconcileEasypayPayments(windowHours = 168): Promise<{ checked: number; fixed: number }> {
  if (!isEasypayConfigured()) {
    return { checked: 0, fixed: 0 };
  }

  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const candidates = await listReconcilableCoursePayments(since);

  let fixed = 0;
  for (const payment of candidates) {
    if (!payment.providerPaymentId) continue;

    try {
      const live = await getSinglePayment(payment.providerPaymentId);
      const status = await applyEasypayStatus(payment, live.payment_status ?? live.status, live);
      if (status === 'paid') {
        fixed++;
        console.log(`[EASYPAY RECONCILE] ${payment.id} settled as paid (missed webhook).`);
      }
    } catch (error) {
      console.warn(`[EASYPAY RECONCILE] ${payment.id}:`, error instanceof Error ? error.message : error);
    }
  }

  return { checked: candidates.length, fixed };
}
