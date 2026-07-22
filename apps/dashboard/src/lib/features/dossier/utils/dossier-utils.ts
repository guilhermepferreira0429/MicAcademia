import type { BadgeVariant } from '@cio/ui/base/badge';
import type { DossierGap } from './types';

/** The API stores trainer document statuses as free text, so narrow before labelling. */
const TRAINER_STATUSES = ['none', 'pending', 'signed'];

/** Badge variant for a trainer's contract / IP-cession status. */
export function trainerStatusBadgeVariant(status: string): BadgeVariant {
  if (status === 'signed') return 'success';
  if (status === 'pending') return 'warning';

  return 'secondary';
}

/** Translation key for a trainer's contract / IP-cession status. */
export function trainerStatusLabelKey(status: string): string {
  const known = TRAINER_STATUSES.includes(status) ? status : 'none';

  return `instructor.status.${known}`;
}

/** Translation key for a gap code, e.g. `dossier.gaps.trainer_ccp_expired`. */
export function gapMessageKey(gap: DossierGap): string {
  return `dossier.gaps.${gap.code}`;
}

/** Placeholders for a gap message: the trainer name or the count it is about. */
export function gapMessageParams(gap: DossierGap): Record<string, string> {
  return { subject: gap.subject ?? '' };
}

/** Formats an ISO date to a locale short date, or a dash when absent/invalid. */
export function formatDossierDate(iso: string | null | undefined, fallback = '—'): string {
  if (!iso) return fallback;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

/** Seconds as `Xh MMm`, the unit attendance sheets are read in. */
export function formatDossierHours(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/** Seconds as decimal hours, for the CSV export. */
export function toDossierDecimalHours(seconds: number | null | undefined): string {
  return ((seconds ?? 0) / 3600).toFixed(2);
}

/** Escapes a CSV cell so commas, quotes and newlines survive the round trip. */
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/** Triggers a browser download of the given rows as a CSV file. */
export function downloadDossierCsv(filename: string, rows: string[][]) {
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

/**
 * Share of the whole action a student attended, so the sheet can state a single
 * percentage next to the hours (auditors look for a minimum attendance rate).
 */
export function attendancePercent(attendedSeconds: number, totalSessionSeconds: number): number {
  if (totalSessionSeconds <= 0) return 0;

  return Math.min(100, Math.round((attendedSeconds / totalSessionSeconds) * 100));
}
