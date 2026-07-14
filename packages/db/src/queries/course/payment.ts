import * as schema from '@db/schema';

import { TCoursePayment, TNewCoursePayment } from '@db/types';
import { and, desc, eq, gt, inArray, isNotNull } from 'drizzle-orm';

import { db } from '@db/drizzle';

/**
 * Creates a pending course payment record. Access is NOT granted here — the
 * groupmember row is only created once EasyPay confirms payment.
 */
export async function createCoursePayment(data: TNewCoursePayment): Promise<TCoursePayment> {
  try {
    const [row] = await db.insert(schema.coursePayment).values(data).returning();

    if (!row) {
      throw new Error('Insert returned no row');
    }

    return row;
  } catch (error) {
    console.error('createCoursePayment error:', error);
    throw new Error('Failed to create course payment');
  }
}

/** Patches a course payment by id, always bumping updatedAt. Returns the row or null. */
export async function updateCoursePayment(
  id: string,
  patch: Partial<TNewCoursePayment>
): Promise<TCoursePayment | null> {
  try {
    const [row] = await db
      .update(schema.coursePayment)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(schema.coursePayment.id, id))
      .returning();

    return row ?? null;
  } catch (error) {
    console.error('updateCoursePayment error:', error);
    throw new Error('Failed to update course payment');
  }
}

export async function getCoursePaymentById(id: string): Promise<TCoursePayment | null> {
  try {
    const [row] = await db.select().from(schema.coursePayment).where(eq(schema.coursePayment.id, id)).limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getCoursePaymentById error:', error);
    throw new Error('Failed to fetch course payment');
  }
}

export async function getCoursePaymentByProviderId(providerPaymentId: string): Promise<TCoursePayment | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.coursePayment)
      .where(eq(schema.coursePayment.providerPaymentId, providerPaymentId))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getCoursePaymentByProviderId error:', error);
    throw new Error('Failed to fetch course payment');
  }
}

export async function getCoursePaymentByKey(paymentKey: string): Promise<TCoursePayment | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.coursePayment)
      .where(eq(schema.coursePayment.paymentKey, paymentKey))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getCoursePaymentByKey error:', error);
    throw new Error('Failed to fetch course payment');
  }
}

/** Most recent payment (any status) for a (course, profile) pair — used for pre-retry checks. */
export async function getLatestCoursePaymentForProfile(
  courseId: string,
  profileId: string
): Promise<TCoursePayment | null> {
  try {
    const [row] = await db
      .select()
      .from(schema.coursePayment)
      .where(and(eq(schema.coursePayment.courseId, courseId), eq(schema.coursePayment.profileId, profileId)))
      .orderBy(desc(schema.coursePayment.createdAt))
      .limit(1);

    return row ?? null;
  } catch (error) {
    console.error('getLatestCoursePaymentForProfile error:', error);
    throw new Error('Failed to fetch course payment');
  }
}

/**
 * Payments worth re-checking against EasyPay (lost-webhook safety net): still
 * pending or failed, EasyPay provider, created since `sinceIso`, and already
 * have a provider payment id to query.
 */
export async function listReconcilableCoursePayments(sinceIso: string, limit = 100): Promise<TCoursePayment[]> {
  try {
    return await db
      .select()
      .from(schema.coursePayment)
      .where(
        and(
          eq(schema.coursePayment.provider, 'easypay'),
          inArray(schema.coursePayment.status, ['pending', 'failed']),
          isNotNull(schema.coursePayment.providerPaymentId),
          gt(schema.coursePayment.createdAt, sinceIso)
        )
      )
      .orderBy(desc(schema.coursePayment.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('listReconcilableCoursePayments error:', error);
    throw new Error('Failed to list reconcilable course payments');
  }
}
