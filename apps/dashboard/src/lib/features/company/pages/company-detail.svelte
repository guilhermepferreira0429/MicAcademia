<script lang="ts">
  import * as Table from '@cio/ui/base/table';
  import * as Tabs from '@cio/ui/base/tabs';
  import * as Dialog from '@cio/ui/base/dialog';
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import { Spinner } from '@cio/ui/base/spinner';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';

  import { resolve } from '$app/paths';

  import { t } from '$lib/utils/functions/translations';
  import { currentOrg, currentOrgPath } from '$lib/utils/store/org';
  import { coursesApi } from '$features/course/api';
  import { companyApi } from '$features/company/api/company.svelte';
  import CompanyModal from '$features/company/components/company-modal.svelte';
  import AddStaffModal from '$features/company/components/add-staff-modal.svelte';
  import BulkEnroll from '$features/company/components/bulk-enroll.svelte';
  import CompanyOrders from '$features/company/components/company-orders.svelte';
  import CompanyReport from '$features/company/pages/company-report.svelte';
  import AnnualTraining from '$features/company/pages/annual-training.svelte';
  import { roleBadgeVariant, roleLabelKey } from '$features/company/utils/company-utils';
  import type { CompanyMember } from '$features/company/utils/types';

  interface Props {
    companyId: string;
  }

  let { companyId }: Props = $props();

  let activeTab = $state('staff');
  let editModalOpen = $state(false);
  let addStaffOpen = $state(false);

  let removeDialogOpen = $state(false);
  let removeCandidate = $state<CompanyMember | null>(null);
  let isRemoving = $state(false);

  let loadedForCompany = $state<string | null>(null);

  $effect(() => {
    if (!$currentOrg?.id || !companyId || loadedForCompany === companyId) return;

    loadedForCompany = companyId;
    companyApi.lastEnrollResult = null;
    void companyApi.loadDetail(companyId);
    void companyApi.list();
    void coursesApi.getOrgCourses();
  });

  const detail = $derived(companyApi.detail?.company.id === companyId ? companyApi.detail : null);
  const company = $derived(detail?.company ?? null);
  const members = $derived(detail?.members ?? []);
  const enrollments = $derived(detail?.enrollments ?? []);
  const memberProfileIds = $derived(members.map((member) => member.profileId));
  const courseOptions = $derived(coursesApi.orgCourses.map((course) => ({ id: course.id, title: course.title })));

  function openRemove(member: CompanyMember) {
    removeCandidate = member;
    removeDialogOpen = true;
  }

  async function confirmRemove() {
    if (!removeCandidate) return;

    isRemoving = true;

    try {
      await companyApi.removeMember(companyId, removeCandidate.profileId);
      removeCandidate = null;
      removeDialogOpen = false;
    } finally {
      isRemoving = false;
    }
  }
</script>

<div class="flex flex-wrap items-start justify-between gap-3 pb-4">
  <div class="flex flex-col gap-1">
    <a
      href={resolve(`${$currentOrgPath}/companies`, {})}
      class="ui:text-muted-foreground flex items-center gap-1 text-sm hover:underline"
    >
      <ArrowLeftIcon size={14} />
      {$t('company.detail.back')}
    </a>
    {#if company}
      <h2 class="text-xl font-semibold">{company.name}</h2>
      <p class="ui:text-muted-foreground text-sm">
        {#if company.nif}
          {$t('company.table.nif')}: {company.nif}
        {/if}
        {#if company.email}
          · {company.email}
        {/if}
        {#if company.phone}
          · {company.phone}
        {/if}
      </p>
    {/if}
  </div>

  {#if company}
    <Button variant="outline" onclick={() => (editModalOpen = true)}>
      <PencilIcon size={16} />
      {$t('company.edit')}
    </Button>
  {/if}
</div>

{#if companyApi.isLoading && !detail}
  <div class="flex justify-center py-16">
    <Spinner class="size-10! text-blue-700!" />
  </div>
{:else if detail && company}
  <Tabs.Root bind:value={activeTab} class="w-full">
    <Tabs.List class="inline-flex w-auto">
      <Tabs.Trigger value="staff">{$t('company.tabs.staff')}</Tabs.Trigger>
      <Tabs.Trigger value="enroll">{$t('company.tabs.enroll')}</Tabs.Trigger>
      <Tabs.Trigger value="orders">{$t('company.tabs.orders')}</Tabs.Trigger>
      <Tabs.Trigger value="report">{$t('company.tabs.report')}</Tabs.Trigger>
      <Tabs.Trigger value="annual">{$t('company.tabs.annual')}</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="staff" class="mt-4">
      <div class="flex items-center justify-end pb-4">
        <Button onclick={() => (addStaffOpen = true)}>
          <PlusIcon size={16} />
          {$t('company.staff.add')}
        </Button>
      </div>

      {#if members.length === 0}
        <p class="ui:text-muted-foreground text-sm">{$t('company.staff.empty')}</p>
      {:else}
        <div class="w-full overflow-x-auto rounded-lg border">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{$t('company.staff.name')}</Table.Head>
                <Table.Head>{$t('company.staff.email')}</Table.Head>
                <Table.Head>{$t('company.staff.job_title')}</Table.Head>
                <Table.Head>{$t('company.staff.role')}</Table.Head>
                <Table.Head class="text-right">{$t('company.staff.actions')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each members as member (member.profileId)}
                <Table.Row>
                  <Table.Cell class="font-medium">{member.fullname ?? '—'}</Table.Cell>
                  <Table.Cell>{member.email ?? '—'}</Table.Cell>
                  <Table.Cell>
                    {#if member.jobTitle}
                      {member.jobTitle}
                    {:else}
                      <span class="ui:text-muted-foreground">—</span>
                    {/if}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={roleBadgeVariant(member.role)}>{$t(roleLabelKey(member.role))}</Badge>
                  </Table.Cell>
                  <Table.Cell class="text-right">
                    <Button
                      variant="secondary"
                      size="icon"
                      aria-label={$t('company.staff.remove')}
                      class="text-red-500 hover:text-red-700"
                      onclick={() => openRemove(member)}
                    >
                      <Trash2Icon size={16} />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {/if}
    </Tabs.Content>

    <Tabs.Content value="enroll" class="mt-4">
      <BulkEnroll {companyId} {members} courses={courseOptions} />
    </Tabs.Content>

    <Tabs.Content value="orders" class="mt-4">
      <CompanyOrders {companyId} {enrollments} />
    </Tabs.Content>

    <Tabs.Content value="report" class="mt-4">
      <CompanyReport {companyId} companyName={company.name} />
    </Tabs.Content>

    <Tabs.Content value="annual" class="mt-4">
      <AnnualTraining {companyId} companyName={company.name} />
    </Tabs.Content>
  </Tabs.Root>

  <CompanyModal bind:open={editModalOpen} {company} onclose={() => (editModalOpen = false)} />
  <AddStaffModal
    bind:open={addStaffOpen}
    {companyId}
    existingProfileIds={memberProfileIds}
    onclose={() => (addStaffOpen = false)}
  />
{:else}
  <p class="ui:text-muted-foreground py-8 text-center text-sm">{$t('company.detail.not_found')}</p>
{/if}

<Dialog.Root bind:open={removeDialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{$t('company.staff.remove_modal.title')}</Dialog.Title>
      <Dialog.Description>
        {$t('company.staff.remove_modal.description', {
          name: removeCandidate?.fullname ?? removeCandidate?.email ?? ''
        })}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => (removeDialogOpen = false)}>
        {$t('company.form.cancel')}
      </Button>
      <Button variant="destructive" onclick={confirmRemove} loading={isRemoving} disabled={isRemoving}>
        {$t('company.staff.remove')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
