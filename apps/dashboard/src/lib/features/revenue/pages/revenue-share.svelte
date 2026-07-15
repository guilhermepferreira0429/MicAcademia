<script lang="ts">
  import * as Table from '@cio/ui/base/table';
  import * as Field from '@cio/ui/base/field';
  import { Input } from '@cio/ui/base/input';
  import { Button } from '@cio/ui/base/button';
  import { Empty } from '@cio/ui/custom/empty';
  import { Spinner } from '@cio/ui/base/spinner';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import CoinsIcon from '@lucide/svelte/icons/coins';

  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { revenueApi } from '$features/revenue/api/revenue.svelte';

  function toDateInput(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  const now = new Date();
  let from = $state(toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  let to = $state(toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)));

  let loadedForOrg = $state<string | null>(null);

  $effect(() => {
    const orgId = $currentOrg?.id;
    if (!orgId || loadedForOrg === orgId) return;

    loadedForOrg = orgId;
    void revenueApi.loadReport(from, to);
  });

  function applyFilter() {
    void revenueApi.loadReport(from, to);
  }

  function formatMoney(amountCents: number, currency: string): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountCents / 100);
  }

  function csvCell(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  function exportCsv() {
    const report = revenueApi.report;
    if (!report) return;

    const rows: string[][] = [
      [
        t.get('revenue_share.course'),
        t.get('revenue_share.revenue'),
        t.get('revenue_share.party'),
        t.get('revenue_share.percent'),
        t.get('revenue_share.amount')
      ]
    ];

    for (const course of report.courses) {
      for (const share of course.shares) {
        rows.push([
          course.title,
          (course.revenueCents / 100).toFixed(2),
          share.label,
          String(share.percent),
          (share.amountCents / 100).toFixed(2)
        ]);
      }
    }

    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue-share-${from}_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const report = $derived(revenueApi.report);
  const hasData = $derived(!!report && report.courses.length > 0);
</script>

<div class="flex flex-wrap items-end justify-between gap-3 pb-4">
  <div class="flex flex-wrap items-end gap-3">
    <Field.Field>
      <Field.Label for="revenue-from">{$t('revenue_share.filters.from')}</Field.Label>
      <Input id="revenue-from" type="date" bind:value={from} />
    </Field.Field>
    <Field.Field>
      <Field.Label for="revenue-to">{$t('revenue_share.filters.to')}</Field.Label>
      <Input id="revenue-to" type="date" bind:value={to} />
    </Field.Field>
    <Button variant="outline" onclick={applyFilter} loading={revenueApi.isLoading}>
      {$t('revenue_share.filters.apply')}
    </Button>
  </div>

  <Button onclick={exportCsv} disabled={!hasData}>
    <DownloadIcon size={16} />
    {$t('revenue_share.export_csv')}
  </Button>
</div>

{#if revenueApi.isLoading && !report}
  <div class="flex justify-center py-16">
    <Spinner class="size-10! text-blue-700!" />
  </div>
{:else if hasData && report}
  <div class="space-y-8">
    <section>
      <h3 class="mb-2 text-sm font-semibold">{$t('revenue_share.parties_heading')}</h3>
      <div class="w-full overflow-x-auto rounded-lg border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>{$t('revenue_share.party')}</Table.Head>
              <Table.Head class="text-right">{$t('revenue_share.amount')}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each report.parties as party (party.label)}
              <Table.Row>
                <Table.Cell class="font-medium">{party.label}</Table.Cell>
                <Table.Cell class="text-right">{formatMoney(party.amountCents, report.currency)}</Table.Cell>
              </Table.Row>
            {/each}
            <Table.Row>
              <Table.Cell class="font-semibold">{$t('revenue_share.total')}</Table.Cell>
              <Table.Cell class="text-right font-semibold">
                {formatMoney(report.totalCents, report.currency)}
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </div>
    </section>

    <section>
      <h3 class="mb-2 text-sm font-semibold">{$t('revenue_share.courses_heading')}</h3>
      <div class="w-full overflow-x-auto rounded-lg border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>{$t('revenue_share.course')}</Table.Head>
              <Table.Head class="text-right">{$t('revenue_share.revenue')}</Table.Head>
              <Table.Head>{$t('revenue_share.party')}</Table.Head>
              <Table.Head class="text-right">{$t('revenue_share.percent')}</Table.Head>
              <Table.Head class="text-right">{$t('revenue_share.amount')}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each report.courses as course (course.courseId)}
              {#each course.shares as share, shareIndex (share.label)}
                <Table.Row>
                  {#if shareIndex === 0}
                    <Table.Cell class="align-top font-medium" rowspan={course.shares.length}>
                      {course.title}
                    </Table.Cell>
                    <Table.Cell class="text-right align-top" rowspan={course.shares.length}>
                      {formatMoney(course.revenueCents, report.currency)}
                    </Table.Cell>
                  {/if}
                  <Table.Cell>{share.label}</Table.Cell>
                  <Table.Cell class="text-right">{share.percent}%</Table.Cell>
                  <Table.Cell class="text-right">{formatMoney(share.amountCents, report.currency)}</Table.Cell>
                </Table.Row>
              {/each}
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    </section>
  </div>
{:else}
  <Empty title={$t('revenue_share.empty')} icon={CoinsIcon} variant="page" />
{/if}
