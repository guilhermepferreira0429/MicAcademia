import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCoursePaymentByKey,
  getCoursePaymentByProviderId,
  setCourseClassMemberStatusByPayment,
  updateCoursePayment
} from '@cio/db/queries/course';

import { grantCourseAccessForPayment } from '@api/services/course/invite';
import { isFailedStatus, isPaidStatus } from '@api/services/payments/easypay-client';
import { handleEasypayWebhook } from '@api/services/payments/easypay';

/**
 * What happens to a class seat as the money moves. A Multibanco reference can
 * sit unpaid for days holding a seat, so the seat must be confirmed when the
 * payment lands and handed back when it dies — otherwise a class stays sold out
 * because of payments that never happened.
 */

vi.mock('@cio/db/queries/course', () => ({
  createCoursePayment: vi.fn(),
  getCoursePaymentById: vi.fn(),
  getCoursePaymentByKey: vi.fn(),
  getCoursePaymentByProviderId: vi.fn(),
  getCourseWithRelations: vi.fn(),
  getLatestCoursePaymentForProfile: vi.fn(),
  listReconcilableCoursePayments: vi.fn(),
  updateCoursePayment: vi.fn(),
  setCourseClassMemberStatusByPayment: vi.fn(),
  upsertCourseClassMember: vi.fn()
}));

vi.mock('@cio/db/queries/group', () => ({ getGroupMemberIdByGroupAndProfile: vi.fn() }));
vi.mock('@api/services/course/invite', () => ({ grantCourseAccessForPayment: vi.fn() }));
vi.mock('@api/services/course/class', () => ({
  listOpenClassesForCourse: vi.fn(async () => []),
  resolveClassForCheckout: vi.fn()
}));

vi.mock('@api/services/payments/easypay-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@api/services/payments/easypay-client')>();

  return {
    ...actual,
    createSinglePayment: vi.fn(),
    getSinglePayment: vi.fn(),
    isEasypayConfigured: vi.fn(() => true)
  };
});

const mockedByProviderId = vi.mocked(getCoursePaymentByProviderId);
const mockedByKey = vi.mocked(getCoursePaymentByKey);
const mockedUpdatePayment = vi.mocked(updateCoursePayment);
const mockedSeatStatus = vi.mocked(setCourseClassMemberStatusByPayment);
const mockedGrant = vi.mocked(grantCourseAccessForPayment);

function buildPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    courseId: 'course-1',
    orgId: 'org-1',
    profileId: 'student-1',
    email: 'joao@x.pt',
    provider: 'easypay',
    providerPaymentId: 'ep-1',
    paymentKey: 'MICA-pay-1',
    method: 'multibanco',
    status: 'pending',
    amountCents: 25_000,
    currency: 'EUR',
    ...overrides
  } as never;
}

describe('easypay status helpers', () => {
  it('recognises the statuses that mean the money arrived', () => {
    expect(isPaidStatus('paid')).toBe(true);
    expect(isPaidStatus('PAID')).toBe(true);
    expect(isPaidStatus('pending')).toBe(false);
  });

  it('treats an expired reference as a failure, not as still pending', () => {
    // This is what releases the seat of a reference nobody ever paid.
    expect(isFailedStatus('expired')).toBe(true);
    expect(isFailedStatus('failed')).toBe(true);
    expect(isFailedStatus('cancelled')).toBe(true);
    expect(isFailedStatus('pending')).toBe(false);
  });
});

describe('handleEasypayWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedByProviderId.mockResolvedValue(null);
    mockedByKey.mockResolvedValue(null);
    mockedUpdatePayment.mockResolvedValue(buildPayment());
  });

  it('reports an unknown payment instead of throwing', async () => {
    const result = await handleEasypayWebhook({ id: 'nope', payment_status: 'paid' } as never);

    expect(result).toEqual({ success: false });
  });

  it('falls back to our own payment key when the provider id does not match', async () => {
    mockedByKey.mockResolvedValue(buildPayment());

    const result = await handleEasypayWebhook({ key: 'MICA-pay-1', payment_status: 'paid' } as never);

    expect(result).toEqual({ success: true });
    expect(mockedByKey).toHaveBeenCalledWith('MICA-pay-1');
  });

  it('confirms the seat and grants access when the payment is paid', async () => {
    mockedByProviderId.mockResolvedValue(buildPayment());

    await handleEasypayWebhook({ id: 'ep-1', payment_status: 'paid' } as never);

    expect(mockedUpdatePayment).toHaveBeenCalledWith('pay-1', expect.objectContaining({ status: 'paid' }));
    expect(mockedSeatStatus).toHaveBeenCalledWith('pay-1', 'confirmed');
    expect(mockedGrant).toHaveBeenCalledWith(expect.objectContaining({ courseId: 'course-1', profileId: 'student-1' }));
  });

  it('gives the seat back when the payment fails', async () => {
    mockedByProviderId.mockResolvedValue(buildPayment());

    await handleEasypayWebhook({ id: 'ep-1', payment_status: 'failed' } as never);

    expect(mockedSeatStatus).toHaveBeenCalledWith('pay-1', 'cancelled');
    expect(mockedGrant).not.toHaveBeenCalled();
  });

  it('gives the seat back when the reference expires', async () => {
    mockedByProviderId.mockResolvedValue(buildPayment());

    await handleEasypayWebhook({ id: 'ep-1', payment_status: 'expired' } as never);

    expect(mockedSeatStatus).toHaveBeenCalledWith('pay-1', 'cancelled');
  });

  it('is idempotent: a redelivered paid event does not grant access twice', async () => {
    mockedByProviderId.mockResolvedValue(buildPayment({ status: 'paid' }));

    await handleEasypayWebhook({ id: 'ep-1', payment_status: 'paid' } as never);

    expect(mockedUpdatePayment).not.toHaveBeenCalled();
    expect(mockedGrant).not.toHaveBeenCalled();
  });

  it('does not touch a paid payment when a late failure event arrives', async () => {
    mockedByProviderId.mockResolvedValue(buildPayment({ status: 'paid' }));

    await handleEasypayWebhook({ id: 'ep-1', payment_status: 'failed' } as never);

    expect(mockedUpdatePayment).not.toHaveBeenCalled();
    expect(mockedSeatStatus).not.toHaveBeenCalled();
  });

  it('reads the status from `status` when `payment_status` is absent', async () => {
    mockedByProviderId.mockResolvedValue(buildPayment());

    await handleEasypayWebhook({ id: 'ep-1', status: 'paid' } as never);

    expect(mockedSeatStatus).toHaveBeenCalledWith('pay-1', 'confirmed');
  });
});
