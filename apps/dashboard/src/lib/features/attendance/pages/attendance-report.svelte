<script lang="ts">
  import * as Table from '@cio/ui/base/table';
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import { Empty } from '@cio/ui/custom/empty';
  import { Spinner } from '@cio/ui/base/spinner';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';

  import { t } from '$lib/utils/functions/translations';
  import { attendanceApi } from '$features/attendance/api/attendance.svelte';
  import type { AttendanceSummarySession } from '$features/attendance/utils/types';

  interface Props {
    courseId: string;
  }

  let { courseId }: Props = $props();

  let loadedForCourse = $state<string | null>(null);

  $effect(() => {
    if (!courseId || loadedForCourse === courseId) return;

    loadedForCourse = courseId;
    void attendanceApi.loadSummary(courseId);
  });

  const summary = $derived(attendanceApi.summary);
  const hasData = $derived(!!summary && summary.students.length > 0);

  /** Seconds to a compact `1h 30m` label — the unit trainers report in. */
  function formatDuration(seconds: number): string {
    const totalMinutes = Math.round((seconds ?? 0) / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  function formatHoursDecimal(seconds: number): string {
    return ((seconds ?? 0) / 3600).toFixed(2);
  }

  function formatSessionDate(session: AttendanceSummarySession): string {
    if (!session.lessonAt) return '';

    const date = new Date(session.lessonAt);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(date);
  }

  function sourceLabel(source: string): string {
    if (source === 'livekit') return t.get('attendance.report.source.livekit');
    if (source === 'qr') return t.get('attendance.report.source.qr');
    if (source === 'manual') return t.get('attendance.report.source.manual');

    return source;
  }

  function csvCell(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  function exportCsv() {
    if (!summary) return;

    const header = [
      t.get('attendance.report.student'),
      t.get('attendance.report.total_hours'),
      ...summary.sessions.map((session) => session.title)
    ];

    const rows: string[][] = [header];

    for (const student of summary.students) {
      const bySession = new Map(student.perSession.map((entry) => [entry.lessonId, entry]));

      rows.push([
        student.fullname ?? '',
        formatHoursDecimal(student.totalSeconds),
        ...summary.sessions.map((session) => {
          const entry = bySession.get(session.lessonId);
          if (!entry) return '0%';

          const sources = entry.sources.length ? ` (${entry.sources.map(sourceLabel).join(' / ')})` : '';
          return `${Math.round(entry.percent)}%${sources}`;
        })
      ]);
    }

    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${courseId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
</script>

<div class="flex flex-wrap items-center justify-between gap-3 pb-4">
  <p class="ui:text-muted-foreground text-sm">{$t('attendance.report.description')}</p>

  <Button onclick={exportCsv} disabled={!hasData}>
    <DownloadIcon size={16} />
    {$t('attendance.report.export_csv')}
  </Button>
</div>

{#if attendanceApi.isLoading && !summary}
  <div class="flex justify-center py-16">
    <Spinner class="size-10! text-blue-700!" />
  </div>
{:else if hasData && summary}
  <div class="w-full overflow-x-auto rounded-lg border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="min-w-48">{$t('attendance.report.student')}</Table.Head>
          <Table.Head class="text-right">{$t('attendance.report.total_hours')}</Table.Head>
          {#each summary.sessions as session (session.lessonId)}
            <Table.Head class="min-w-40">
              <span class="block truncate">{session.title}</span>
              <span class="ui:text-muted-foreground block text-xs font-normal">
                {formatSessionDate(session)} · {formatDuration(session.sessionSeconds)}
              </span>
            </Table.Head>
          {/each}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each summary.students as student (student.profileId)}
          {@const bySession = new Map(student.perSession.map((entry) => [entry.lessonId, entry]))}
          <Table.Row>
            <Table.Cell class="font-medium">{student.fullname}</Table.Cell>
            <Table.Cell class="text-right">{formatDuration(student.totalSeconds)}</Table.Cell>
            {#each summary.sessions as session (session.lessonId)}
              {@const entry = bySession.get(session.lessonId)}
              <Table.Cell>
                {#if entry}
                  <div class="flex flex-wrap items-center gap-1">
                    <span class="text-sm">{Math.round(entry.percent)}%</span>
                    {#each entry.sources as source (source)}
                      <Badge variant="secondary" class="text-[10px]">{sourceLabel(source)}</Badge>
                    {/each}
                  </div>
                {:else}
                  <span class="ui:text-muted-foreground text-sm">{$t('attendance.report.absent')}</span>
                {/if}
              </Table.Cell>
            {/each}
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{:else}
  <Empty title={$t('attendance.report.empty')} icon={CalendarCheckIcon} variant="page" />
{/if}
