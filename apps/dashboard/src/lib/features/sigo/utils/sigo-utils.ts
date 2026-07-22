import type { BadgeVariant } from '@cio/ui/base/badge';
import type { TSigoStatus } from '@cio/utils/validation/sigo/sigo';

/** Every SIGO status, in the order a submission normally moves through them. */
export const SIGO_STATUSES: TSigoStatus[] = ['pending', 'submitted', 'approved', 'paid', 'rejected'];

/** The API stores the status as free text, so narrow it before treating it as a stage. */
export function isSigoStatus(value: string): value is TSigoStatus {
  return (SIGO_STATUSES as string[]).includes(value);
}

/** Base badge variant per status; `sigoStatusBadgeClass` layers the exact colour on top. */
export function sigoStatusBadgeVariant(status: string): BadgeVariant {
  if (status === 'rejected') return 'destructive';
  if (status === 'approved' || status === 'paid') return 'success';

  return 'secondary';
}

/** Extra classes so each stage reads at a glance (blue submitted, stronger emerald when paid). */
export function sigoStatusBadgeClass(status: string): string {
  if (status === 'submitted') return 'bg-blue-600 text-white border-transparent';
  if (status === 'paid') return 'bg-emerald-700 text-white border-transparent';

  return '';
}

/** Translation key for a status label. */
export function sigoStatusLabelKey(status: string): string {
  return `sigo.status.${status}`;
}

/**
 * The date that matters for the stage a submission is in: paid date when paid,
 * approval date when approved, otherwise the submission date.
 */
export function relevantDate(submission: {
  status: string;
  submittedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
}): string | null {
  if (submission.status === 'paid') return submission.paidAt ?? submission.approvedAt ?? submission.submittedAt;
  if (submission.status === 'approved') return submission.approvedAt ?? submission.submittedAt;

  return submission.submittedAt;
}

/** Formats an ISO date to a locale short date, or an empty string when absent/invalid. */
export function formatDate(iso: string | null): string {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

/** Converts an ISO datetime string to the `YYYY-MM-DD` value a native date input expects. */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** Formats a cent amount as EUR, the currency SIGO funding is reported in. */
export function formatEuros(amountCents: number | null | undefined): string {
  const cents = amountCents ?? 0;

  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Converts a euro amount typed in the form to integer cents; null when blank/invalid. */
export function eurosToCents(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;

  const euros = Number(trimmed);
  if (Number.isNaN(euros) || euros < 0) return null;

  return Math.round(euros * 100);
}

/** Converts stored cents back to the euro string the amount input shows. */
export function centsToEuros(amountCents: number | null | undefined): string {
  if (amountCents === null || amountCents === undefined) return '';

  return (amountCents / 100).toFixed(2);
}
