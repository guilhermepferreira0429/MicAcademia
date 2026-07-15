import { getRevenueByCourse } from '@cio/db/queries/course';

/** House split applied when a course has no custom revenue-share config. */
const DEFAULT_SHARES: Array<{ label: string; percent: number }> = [
  { label: 'Nautis', percent: 50 },
  { label: 'Microlopes', percent: 50 }
];

export interface RevenueShareReport {
  currency: string;
  totalCents: number;
  /** Aggregate entitlement per party across all courses. */
  parties: Array<{ label: string; amountCents: number }>;
  courses: Array<{
    courseId: string;
    title: string;
    revenueCents: number;
    shares: Array<{ label: string; percent: number; amountCents: number }>;
  }>;
}

/**
 * Computes revenue-share entitlements from paid EasyPay payments: each course's
 * revenue is split by its configured shares (or the default house split), and
 * the per-party amounts are aggregated across the period.
 */
export async function computeRevenueShareReport(
  orgId: string,
  fromIso?: string,
  toIso?: string
): Promise<RevenueShareReport> {
  const rows = await getRevenueByCourse(orgId, fromIso, toIso);

  const partyTotals = new Map<string, number>();
  let totalCents = 0;

  const courses = rows.map((row) => {
    totalCents += row.totalCents;

    const shares = row.revenueShare?.shares?.length ? row.revenueShare.shares : DEFAULT_SHARES;
    const breakdown = shares.map((share) => {
      const amountCents = Math.round((row.totalCents * share.percent) / 100);
      partyTotals.set(share.label, (partyTotals.get(share.label) ?? 0) + amountCents);

      return { label: share.label, percent: share.percent, amountCents };
    });

    return { courseId: row.courseId, title: row.title, revenueCents: row.totalCents, shares: breakdown };
  });

  const parties = [...partyTotals.entries()]
    .map(([label, amountCents]) => ({ label, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);

  return { currency: 'EUR', totalCents, parties, courses };
}
