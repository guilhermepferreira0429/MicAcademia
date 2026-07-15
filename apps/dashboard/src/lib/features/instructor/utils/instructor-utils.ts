import type { BadgeVariant } from '@cio/ui/base/badge';
import type { TInstructorStatus } from '@cio/utils/validation/instructor/instructor';

/** At-a-glance CCP validity: valid when an end date exists and is today or later. */
export function isCcpValid(ccpValidUntil: string | null, now: Date = new Date()): boolean {
  if (!ccpValidUntil) return false;

  const validUntil = new Date(ccpValidUntil);
  if (Number.isNaN(validUntil.getTime())) return false;

  // Compare on calendar-day granularity so "expires today" still counts as valid.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(validUntil.getFullYear(), validUntil.getMonth(), validUntil.getDate());

  return end.getTime() >= today.getTime();
}

/** Badge variant for the CCP validity indicator (green when valid, red otherwise). */
export function ccpBadgeVariant(ccpValidUntil: string | null, now: Date = new Date()): BadgeVariant {
  return isCcpValid(ccpValidUntil, now) ? 'success' : 'destructive';
}

/** Translation key for the CCP validity label. */
export function ccpStatusLabelKey(ccpValidUntil: string | null, now: Date = new Date()): string {
  return isCcpValid(ccpValidUntil, now) ? 'instructor.ccp.valid' : 'instructor.ccp.expired';
}

/** Badge variant for contract / IP-cession status (green signed, amber pending, grey none). */
export function statusBadgeVariant(status: TInstructorStatus): BadgeVariant {
  if (status === 'signed') return 'success';
  if (status === 'pending') return 'warning';

  return 'secondary';
}

/** Translation key for a contract / IP-cession status value. */
export function statusLabelKey(status: TInstructorStatus): string {
  return `instructor.status.${status}`;
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
