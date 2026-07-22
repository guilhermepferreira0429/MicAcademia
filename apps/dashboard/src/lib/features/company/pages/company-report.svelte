<script lang="ts">
  import * as Table from '@cio/ui/base/table';
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import { Spinner } from '@cio/ui/base/spinner';
  import DownloadIcon from '@lucide/svelte/icons/download';

  import { t } from '$lib/utils/functions/translations';
  import { companyApi } from '$features/company/api/company.svelte';
  import {
    downloadCsv,
    formatDate,
    formatHours,
    toDecimalHours,
    toFileSlug
  } from '$features/company/utils/company-utils';

  interface Props {
    companyId: string;
    /** Used for the CSV filename only. */
    companyName?: string;
  }

  let { companyId, companyName = '' }: Props = $props();

  let loadedForCompany = $state<string | null>(null);

  $effect(() => {
    if (!companyId || loadedForCompany === companyId) return;

    loadedForCompany = companyId;
    void companyApi.loadReport(companyId);
  });

  const report = $derived(companyApi.report?.companyId === companyId ? companyApi.report : null);
  const hasData = $derived(Boolean(report && report.employees.length > 0));

  /** Total hours attended by the whole company, the headline HR number. */
  const totalSeconds = $derived(report?.employees.reduce((total, employee) => total + employee.totalSeconds, 0) ?? 0);

  function exportCsv() {
    if (!report) return;

    const rows: string[][] = [
      [
        t.get('company.report.employee'),
        t.get('company.report.email'),
        t.get('company.report.job_title'),
        t.get('company.report.course'),
        t.get('company.report.enrolled_at'),
        t.get('company.report.hours'),
        t.get('company.report.certificate')
      ]
    ];

    for (const employee of report.employees) {
      if (employee.courses.length === 0) {
        rows.push([employee.fullname ?? '', employee.email ?? '', employee.jobTitle ?? '', '', '', '0.00', '']);
        continue;
      }

      for (const course of employee.courses) {
        rows.push([
          employee.fullname ?? '',
          employee.email ?? '',
          employee.jobTitle ?? '',
          course.title,
          formatDate(course.enrolledAt),
          toDecimalHours(course.attendedSeconds),
          course.certificateEarnedAt ? formatDate(course.certificateEarnedAt) : t.get('company.report.not_earned')
        ]);
      }
    }

    downloadCsv(`${toFileSlug(companyName || 'company')}-training.csv`, rows);
  }
</script>

<div class="flex flex-wrap items-center justify-between gap-3 pb-4">
  <p class="ui:text-muted-foreground text-sm">
    {$t('company.report.total_hours', { hours: formatHours(totalSeconds) })}
  </p>
  <Button onclick={exportCsv} disabled={!hasData}>
    <DownloadIcon size={16} />
    {$t('company.report.export_csv')}
  </Button>
</div>

{#if companyApi.isLoading && !report}
  <div class="flex justify-center py-16">
    <Spinner class="size-10! text-blue-700!" />
  </div>
{:else if hasData && report}
  <div class="space-y-6">
    {#each report.employees as employee (employee.profileId)}
      <section class="rounded-lg border">
        <header class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div class="flex flex-col">
            <span class="font-medium">{employee.fullname ?? employee.email}</span>
            <span class="ui:text-muted-foreground text-xs">
              {employee.email}{#if employee.jobTitle}
                · {employee.jobTitle}
              {/if}
            </span>
          </div>
          <Badge variant="secondary">
            {$t('company.report.employee_total', { hours: formatHours(employee.totalSeconds) })}
          </Badge>
        </header>

        {#if employee.courses.length === 0}
          <p class="ui:text-muted-foreground px-4 py-3 text-sm">{$t('company.report.no_courses')}</p>
        {:else}
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{$t('company.report.course')}</Table.Head>
                <Table.Head>{$t('company.report.enrolled_at')}</Table.Head>
                <Table.Head>{$t('company.report.hours')}</Table.Head>
                <Table.Head>{$t('company.report.certificate')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each employee.courses as course (course.courseId)}
                <Table.Row>
                  <Table.Cell>{course.title}</Table.Cell>
                  <Table.Cell>
                    {#if course.enrolledAt}
                      {formatDate(course.enrolledAt)}
                    {:else}
                      <span class="ui:text-muted-foreground">—</span>
                    {/if}
                  </Table.Cell>
                  <Table.Cell class="font-medium">{formatHours(course.attendedSeconds)}</Table.Cell>
                  <Table.Cell>
                    {#if course.certificateEarnedAt}
                      <Badge variant="success">
                        {$t('company.report.earned_on', { date: formatDate(course.certificateEarnedAt) })}
                      </Badge>
                    {:else}
                      <Badge variant="outline">{$t('company.report.not_earned')}</Badge>
                    {/if}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        {/if}
      </section>
    {/each}
  </div>
{:else}
  <p class="ui:text-muted-foreground py-8 text-center text-sm">{$t('company.report.empty')}</p>
{/if}
