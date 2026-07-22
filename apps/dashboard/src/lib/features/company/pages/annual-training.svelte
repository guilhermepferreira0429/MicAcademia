<script lang="ts">
  import * as Select from '@cio/ui/base/select';
  import * as Table from '@cio/ui/base/table';
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import { Progress } from '@cio/ui/base/progress';
  import { Spinner } from '@cio/ui/base/spinner';
  import DownloadIcon from '@lucide/svelte/icons/download';

  import { t } from '$lib/utils/functions/translations';
  import { companyApi } from '$features/company/api/company.svelte';
  import { downloadCsv, toFileSlug } from '$features/company/utils/company-utils';
  import type { AnnualTrainingEmployee } from '$features/company/utils/types';

  interface Props {
    companyId: string;
    /** Used for the CSV filename only. */
    companyName?: string;
  }

  let { companyId, companyName = '' }: Props = $props();

  /** How many past years HR can look back at from the year selector. */
  const YEARS_OFFERED = 5;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: YEARS_OFFERED }, (_, index) => currentYear - index);

  let selectedYear = $state(String(currentYear));
  let loadedKey = $state<string | null>(null);

  $effect(() => {
    const requestKey = `${companyId}:${selectedYear}`;
    if (!companyId || loadedKey === requestKey) return;

    loadedKey = requestKey;
    void companyApi.loadAnnualTraining(companyId, Number(selectedYear));
  });

  const report = $derived(companyApi.annualTraining?.companyId === companyId ? companyApi.annualTraining : null);
  const requiredHours = $derived(report?.requiredHours ?? 0);
  const hasData = $derived(Boolean(report && report.employees.length > 0));

  /**
   * Furthest from the obligation first: that is the order HR works through,
   * because those are the people who still need training booked this year.
   */
  const employees = $derived.by(() => {
    if (!report) return [] as AnnualTrainingEmployee[];

    return [...report.employees].sort((first, second) => second.remainingHours - first.remainingHours);
  });

  /** Decimal hours as a short label: `22` or `22.5`. */
  function formatDecimalHours(hours: number): string {
    return hours.toFixed(1).replace(/\.0$/, '');
  }

  function exportCsv() {
    if (!report) return;

    const rows: string[][] = [
      [
        t.get('annual_training.employee'),
        t.get('annual_training.job_title'),
        t.get('annual_training.hours_done'),
        t.get('annual_training.hours_required'),
        t.get('annual_training.hours_missing'),
        t.get('annual_training.percent'),
        t.get('annual_training.status')
      ]
    ];

    for (const employee of employees) {
      rows.push([
        employee.fullname ?? '',
        employee.jobTitle ?? '',
        employee.hours.toFixed(2),
        String(report.requiredHours),
        employee.remainingHours.toFixed(2),
        String(employee.percent),
        employee.met ? t.get('annual_training.met') : t.get('annual_training.not_met')
      ]);
    }

    downloadCsv(`${toFileSlug(companyName || 'company')}-${report.year}-annual-training.csv`, rows);
  }
</script>

<div class="flex flex-wrap items-end justify-between gap-3 pb-4">
  <div class="flex flex-col gap-1">
    <span class="ui:text-muted-foreground text-xs font-medium">{$t('annual_training.year')}</span>
    <Select.Root type="single" bind:value={selectedYear}>
      <Select.Trigger id="annual-training-year" class="ui:w-32">
        {selectedYear}
      </Select.Trigger>
      <Select.Content>
        {#each yearOptions as year (year)}
          <Select.Item value={String(year)}>{year}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
  </div>

  <Button onclick={exportCsv} disabled={!hasData}>
    <DownloadIcon size={16} />
    {$t('annual_training.export_csv')}
  </Button>
</div>

{#if companyApi.isLoading && !report}
  <div class="flex justify-center py-16">
    <Spinner class="size-10! text-blue-700!" />
  </div>
{:else if report}
  <section class="rounded-lg border p-4">
    <p class="text-base font-medium">
      {$t('annual_training.summary_headline', {
        met: report.summary.met,
        employees: report.summary.employees,
        hours: formatDecimalHours(report.requiredHours)
      })}
    </p>
    <p class="ui:text-muted-foreground mt-1 text-sm">
      {$t('annual_training.summary_total_hours', {
        hours: formatDecimalHours(report.summary.totalHours),
        year: String(report.year)
      })}
    </p>
    <p class="ui:text-muted-foreground mt-1 text-xs">{$t('annual_training.legal_note')}</p>
  </section>

  {#if hasData}
    <div class="mt-4 w-full overflow-x-auto rounded-lg border">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{$t('annual_training.employee')}</Table.Head>
            <Table.Head>{$t('annual_training.job_title')}</Table.Head>
            <Table.Head>{$t('annual_training.hours_done')}</Table.Head>
            <Table.Head class="min-w-40">{$t('annual_training.progress')}</Table.Head>
            <Table.Head>{$t('annual_training.hours_missing')}</Table.Head>
            <Table.Head>{$t('annual_training.status')}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each employees as employee (employee.profileId)}
            <Table.Row>
              <Table.Cell class="font-medium">{employee.fullname ?? '—'}</Table.Cell>
              <Table.Cell>
                {#if employee.jobTitle}
                  {employee.jobTitle}
                {:else}
                  <span class="ui:text-muted-foreground">—</span>
                {/if}
              </Table.Cell>
              <Table.Cell class="font-medium whitespace-nowrap">
                {formatDecimalHours(employee.hours)} / {formatDecimalHours(requiredHours)}
              </Table.Cell>
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <Progress
                    value={employee.percent}
                    variant={employee.met ? 'default' : 'muted'}
                    aria-label={$t('annual_training.progress')}
                    class="w-28"
                  />
                  <span class="ui:text-muted-foreground text-xs">{employee.percent}%</span>
                </div>
              </Table.Cell>
              <Table.Cell class="whitespace-nowrap">
                {#if employee.remainingHours > 0}
                  {$t('annual_training.hours_short', { hours: formatDecimalHours(employee.remainingHours) })}
                {:else}
                  <span class="ui:text-muted-foreground">—</span>
                {/if}
              </Table.Cell>
              <Table.Cell>
                <Badge variant={employee.met ? 'success' : 'warning'}>
                  {employee.met ? $t('annual_training.met') : $t('annual_training.not_met')}
                </Badge>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {:else}
    <p class="ui:text-muted-foreground py-8 text-center text-sm">{$t('annual_training.empty')}</p>
  {/if}
{:else}
  <p class="ui:text-muted-foreground py-8 text-center text-sm">{$t('annual_training.empty')}</p>
{/if}
