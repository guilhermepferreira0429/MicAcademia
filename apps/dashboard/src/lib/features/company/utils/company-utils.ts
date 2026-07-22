import type { BadgeVariant } from '@cio/ui/base/badge';
import type { TCompanyEnrollmentStatus, TCompanyMemberRole } from '@cio/utils/validation/company/company';

/** Every order status, in the order an order normally moves through them. */
export const COMPANY_ENROLLMENT_STATUSES: TCompanyEnrollmentStatus[] = ['pending', 'invoiced', 'paid'];

/** The roles a member of the company's staff can have. */
export const COMPANY_MEMBER_ROLES: TCompanyMemberRole[] = ['employee', 'manager'];

/** The API stores the status as free text, so narrow it before treating it as a stage. */
export function isCompanyEnrollmentStatus(value: string): value is TCompanyEnrollmentStatus {
  return (COMPANY_ENROLLMENT_STATUSES as string[]).includes(value);
}

/** Base badge variant per order status. */
export function orderStatusBadgeVariant(status: string): BadgeVariant {
  if (status === 'paid') return 'success';
  if (status === 'invoiced') return 'secondary';

  return 'outline';
}

/** Translation key for an order status label. */
export function orderStatusLabelKey(status: string): string {
  return `company.order_status.${status}`;
}

/** Managers are the HR contact following progress, so they read differently. */
export function roleBadgeVariant(role: string): BadgeVariant {
  return role === 'manager' ? 'secondary' : 'outline';
}

/** Translation key for a member role label. */
export function roleLabelKey(role: string): string {
  return `company.role.${role}`;
}

/** Formats a cent amount as EUR, the currency companies are invoiced in. */
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

/** Formats attended seconds as `Xh MMm`, the unit training hours are reported in. */
export function formatHours(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/** Attended seconds as decimal hours, for the CSV export. */
export function toDecimalHours(seconds: number | null | undefined): string {
  return ((seconds ?? 0) / 3600).toFixed(2);
}

/** Formats an ISO date to a locale short date, or an empty string when absent/invalid. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

/** Escapes a CSV cell so commas, quotes and newlines survive the round trip. */
export function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/** Triggers a browser download of the given rows as a CSV file. */
export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Filename-safe version of a company name, used for the CSV export. */
export function toFileSlug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'company'
  );
}
