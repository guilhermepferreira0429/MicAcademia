<script lang="ts">
  import * as Table from '@cio/ui/base/table';
  import * as Dialog from '@cio/ui/base/dialog';
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import { Empty } from '@cio/ui/custom/empty';
  import { Spinner } from '@cio/ui/base/spinner';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import FileCheckIcon from '@lucide/svelte/icons/file-check';

  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { sigoApi } from '$features/sigo/api/sigo.svelte';
  import { coursesApi } from '$features/course/api';
  import type { SigoSubmission } from '$features/sigo/utils/types';
  import SigoModal from '$features/sigo/components/sigo-modal.svelte';
  import {
    SIGO_STATUSES,
    formatDate,
    formatEuros,
    isSigoStatus,
    relevantDate,
    sigoStatusBadgeClass,
    sigoStatusBadgeVariant,
    sigoStatusLabelKey
  } from '$features/sigo/utils/sigo-utils';
  import type { TSigoStatus } from '@cio/utils/validation/sigo/sigo';

  let modalOpen = $state(false);
  let editingSubmission = $state<SigoSubmission | null>(null);

  let deleteDialogOpen = $state(false);
  let deleteCandidate = $state<SigoSubmission | null>(null);
  let isDeleting = $state(false);

  let statusFilter = $state<TSigoStatus | 'all'>('all');

  const courseOptions = $derived(coursesApi.orgCourses.map((course) => ({ id: course.id, title: course.title })));

  const statusCounts = $derived.by(() => {
    const counts: Record<TSigoStatus, number> = {
      pending: 0,
      submitted: 0,
      approved: 0,
      paid: 0,
      rejected: 0
    };

    for (const submission of sigoApi.submissions) {
      if (isSigoStatus(submission.status)) {
        counts[submission.status] += 1;
      }
    }

    return counts;
  });

  /** Total funding actually received, i.e. the amounts of the paid submissions. */
  const paidTotalCents = $derived(
    sigoApi.submissions
      .filter((submission) => submission.status === 'paid')
      .reduce((total, submission) => total + (submission.amountCents ?? 0), 0)
  );

  const visibleSubmissions = $derived(
    statusFilter === 'all'
      ? sigoApi.submissions
      : sigoApi.submissions.filter((submission) => submission.status === statusFilter)
  );

  $effect(() => {
    if (!$currentOrg?.id) return;

    void sigoApi.list();
    void coursesApi.getOrgCourses();
  });

  function openCreate() {
    editingSubmission = null;
    modalOpen = true;
  }

  function openEdit(submission: SigoSubmission) {
    editingSubmission = submission;
    modalOpen = true;
  }

  function openDelete(submission: SigoSubmission) {
    deleteCandidate = submission;
    deleteDialogOpen = true;
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;

    isDeleting = true;

    try {
      await sigoApi.remove(deleteCandidate.id);
      deleteCandidate = null;
      deleteDialogOpen = false;
    } finally {
      isDeleting = false;
    }
  }

  /** Compact "training action · UFCD · hours" line built from the course's SIGO config. */
  function actionSummary(submission: SigoSubmission): string {
    const config = submission.courseSigo;
    if (!config) return '';

    const parts: string[] = [];
    if (config.trainingAction) parts.push(config.trainingAction);
    if (config.ufcdCode) parts.push(`${t.get('sigo.table.ufcd')} ${config.ufcdCode}`);
    if (config.totalHours) parts.push(`${config.totalHours}h`);

    return parts.join(' · ');
  }
</script>

<div class="flex flex-wrap items-center justify-between gap-3 pb-4">
  <div class="flex flex-wrap items-center gap-2">
    {#each SIGO_STATUSES as status (status)}
      <div class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5">
        <span class="ui:text-muted-foreground text-xs">{$t(sigoStatusLabelKey(status))}</span>
        <span class="text-sm font-semibold">{statusCounts[status]}</span>
      </div>
    {/each}
    <div class="flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5">
      <span class="ui:text-muted-foreground text-xs">{$t('sigo.summary.paid_total')}</span>
      <span class="text-sm font-semibold text-emerald-700">{formatEuros(paidTotalCents)}</span>
    </div>
  </div>

  <Button onclick={openCreate}>
    <PlusIcon size={16} />
    {$t('sigo.add')}
  </Button>
</div>

<div class="flex flex-wrap items-center gap-2 pb-4">
  <span class="ui:text-muted-foreground text-xs">{$t('sigo.filters.status')}</span>
  <Button variant={statusFilter === 'all' ? 'default' : 'secondary'} size="sm" onclick={() => (statusFilter = 'all')}>
    {$t('sigo.filters.all')}
  </Button>
  {#each SIGO_STATUSES as status (status)}
    <Button
      variant={statusFilter === status ? 'default' : 'secondary'}
      size="sm"
      onclick={() => (statusFilter = status)}
    >
      {$t(sigoStatusLabelKey(status))}
    </Button>
  {/each}
</div>

{#if sigoApi.isLoading && sigoApi.submissions.length === 0}
  <div class="flex justify-center py-16">
    <Spinner class="size-10! text-blue-700!" />
  </div>
{:else if sigoApi.submissions.length === 0}
  <Empty
    title={$t('sigo.empty.title')}
    description={$t('sigo.empty.description')}
    icon={FileCheckIcon}
    variant="page"
  />
{:else if visibleSubmissions.length === 0}
  <Empty title={$t('sigo.empty.filtered')} icon={FileCheckIcon} variant="page" />
{:else}
  <div class="w-full overflow-x-auto rounded-lg border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>{$t('sigo.table.course')}</Table.Head>
          <Table.Head>{$t('sigo.table.training_action')}</Table.Head>
          <Table.Head>{$t('sigo.table.reference')}</Table.Head>
          <Table.Head>{$t('sigo.table.status')}</Table.Head>
          <Table.Head>{$t('sigo.table.date')}</Table.Head>
          <Table.Head class="text-right">{$t('sigo.table.amount')}</Table.Head>
          <Table.Head class="text-right">{$t('sigo.table.actions')}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each visibleSubmissions as submission (submission.id)}
          {@const summary = actionSummary(submission)}
          {@const date = relevantDate(submission)}
          <Table.Row>
            <Table.Cell class="font-medium">{submission.courseTitle}</Table.Cell>
            <Table.Cell>
              {#if summary}
                <span class="text-xs">{summary}</span>
              {:else}
                <span class="ui:text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {#if submission.reference}
                {submission.reference}
              {:else}
                <span class="ui:text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <Badge
                variant={sigoStatusBadgeVariant(submission.status)}
                class={sigoStatusBadgeClass(submission.status)}
              >
                {$t(sigoStatusLabelKey(submission.status))}
              </Badge>
            </Table.Cell>
            <Table.Cell>
              {#if date}
                {formatDate(date)}
              {:else}
                <span class="ui:text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell class="text-right">
              {#if submission.amountCents !== null}
                {formatEuros(submission.amountCents)}
              {:else}
                <span class="ui:text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell class="text-right">
              <div class="flex justify-end gap-1">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={$t('sigo.edit')}
                  onclick={() => openEdit(submission)}
                >
                  <PencilIcon size={16} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={$t('sigo.delete')}
                  class="text-red-500 hover:text-red-700"
                  onclick={() => openDelete(submission)}
                >
                  <Trash2Icon size={16} />
                </Button>
              </div>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}

<SigoModal
  bind:open={modalOpen}
  submission={editingSubmission}
  courses={courseOptions}
  onclose={() => (modalOpen = false)}
/>

<Dialog.Root bind:open={deleteDialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{$t('sigo.delete_modal.title')}</Dialog.Title>
      <Dialog.Description>
        {$t('sigo.delete_modal.description', { course: deleteCandidate?.courseTitle ?? '' })}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => (deleteDialogOpen = false)}>
        {$t('sigo.form.cancel')}
      </Button>
      <Button variant="destructive" onclick={confirmDelete} loading={isDeleting} disabled={isDeleting}>
        {$t('sigo.delete')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
