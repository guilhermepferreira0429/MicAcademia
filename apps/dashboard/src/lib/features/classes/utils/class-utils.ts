import type { BadgeVariant } from '@cio/ui/base/badge';
import type { TCourseClassMode, TCourseClassStatus } from '@cio/utils/validation/course-class/course-class';
import type { CourseClass } from './types';

/** Lifecycle of a class, in the order a class normally moves through it. */
export const CLASS_STATUSES: TCourseClassStatus[] = ['draft', 'open', 'closed', 'running', 'finished', 'cancelled'];

/** How the class is delivered — decides whether a venue is relevant. */
export const CLASS_MODES: TCourseClassMode[] = ['online', 'in_person', 'hybrid'];

export function classStatusBadgeVariant(status: string): BadgeVariant {
  if (status === 'open') return 'success';
  if (status === 'running') return 'secondary';
  if (status === 'cancelled') return 'destructive';

  return 'outline';
}

export function classStatusLabelKey(status: string): string {
  return `classes.status.${status}`;
}

export function classModeLabelKey(mode: string): string {
  return `classes.mode.${mode}`;
}

/** Formats a cent amount as EUR — the currency classes are sold in. */
export function formatClassPrice(priceCents: number | null | undefined): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format((priceCents ?? 0) / 100);
}

/** Converts euros typed in the form to integer cents; null when blank (= inherit the course price). */
export function eurosToCents(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;

  const euros = Number(trimmed);
  if (Number.isNaN(euros) || euros < 0) return null;

  return Math.round(euros * 100);
}

/** Cents back to the euro string the price input shows. */
export function centsToEuros(priceCents: number | null | undefined): string {
  return priceCents == null ? '' : (priceCents / 100).toFixed(2);
}

export function formatClassDate(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** `<input type="datetime-local">` needs a local `YYYY-MM-DDTHH:mm`, not an ISO instant. */
export function toDateTimeLocalInput(value: string | null | undefined): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offsetMs = date.getTime() - date.getTimezoneOffset() * 60 * 1000;

  return new Date(offsetMs).toISOString().slice(0, 16);
}

/** The reverse: a local datetime-local value back to an ISO instant. */
export function fromDateTimeLocalInput(value: string): string {
  if (!value) return '';

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** "12 of 16" — or just the headcount when the class has no seat limit. */
export function seatLabel(row: Pick<CourseClass, 'seats' | 'takenSeats'>): string {
  return row.seats == null ? String(row.takenSeats) : `${row.takenSeats} / ${row.seats}`;
}

/** Occupancy as a percentage, for the progress bar. Unlimited classes read as 0. */
export function seatPercent(row: Pick<CourseClass, 'seats' | 'takenSeats'>): number {
  if (!row.seats) return 0;

  return Math.min(100, Math.round((row.takenSeats / row.seats) * 100));
}
