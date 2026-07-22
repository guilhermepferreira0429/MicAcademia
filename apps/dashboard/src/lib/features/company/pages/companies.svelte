<script lang="ts">
  import * as Table from '@cio/ui/base/table';
  import * as Dialog from '@cio/ui/base/dialog';
  import { Button } from '@cio/ui/base/button';
  import { Empty } from '@cio/ui/custom/empty';
  import { Spinner } from '@cio/ui/base/spinner';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
  import Building2Icon from '@lucide/svelte/icons/building-2';

  import { resolve } from '$app/paths';

  import { t } from '$lib/utils/functions/translations';
  import { currentOrg, currentOrgPath } from '$lib/utils/store/org';
  import { companyApi } from '$features/company/api/company.svelte';
  import type { Company } from '$features/company/utils/types';
  import CompanyModal from '$features/company/components/company-modal.svelte';

  let modalOpen = $state(false);
  let editingCompany = $state<Company | null>(null);

  let deleteDialogOpen = $state(false);
  let deleteCandidate = $state<Company | null>(null);
  let isDeleting = $state(false);

  $effect(() => {
    if (!$currentOrg?.id) return;

    void companyApi.list();
  });

  function openCreate() {
    editingCompany = null;
    modalOpen = true;
  }

  function openEdit(company: Company) {
    editingCompany = company;
    modalOpen = true;
  }

  function openDelete(company: Company) {
    deleteCandidate = company;
    deleteDialogOpen = true;
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;

    isDeleting = true;

    try {
      await companyApi.remove(deleteCandidate.id);
      deleteCandidate = null;
      deleteDialogOpen = false;
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="flex items-center justify-end pb-4">
  <Button onclick={openCreate}>
    <PlusIcon size={16} />
    {$t('company.add')}
  </Button>
</div>

{#if companyApi.isLoading && companyApi.companies.length === 0}
  <div class="flex justify-center py-16">
    <Spinner class="size-10! text-blue-700!" />
  </div>
{:else if companyApi.companies.length > 0}
  <div class="w-full overflow-x-auto rounded-lg border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>{$t('company.table.name')}</Table.Head>
          <Table.Head>{$t('company.table.nif')}</Table.Head>
          <Table.Head>{$t('company.table.email')}</Table.Head>
          <Table.Head>{$t('company.table.headcount')}</Table.Head>
          <Table.Head class="text-right">{$t('company.table.actions')}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each companyApi.companies as company (company.id)}
          <Table.Row>
            <Table.Cell>
              <a
                href={resolve(`${$currentOrgPath}/companies/${company.id}`, {})}
                class="ui:text-primary font-medium hover:underline"
              >
                {company.name}
              </a>
              {#if company.phone}
                <div class="ui:text-muted-foreground text-xs">{company.phone}</div>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {#if company.nif}
                {company.nif}
              {:else}
                <span class="ui:text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {#if company.email}
                {company.email}
              {:else}
                <span class="ui:text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {$t('company.table.people_count', { count: company.memberCount })}
            </Table.Cell>
            <Table.Cell class="text-right">
              <div class="flex justify-end gap-1">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={$t('company.open')}
                  href={resolve(`${$currentOrgPath}/companies/${company.id}`, {})}
                >
                  <ArrowRightIcon size={16} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={$t('company.edit')}
                  onclick={() => openEdit(company)}
                >
                  <PencilIcon size={16} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={$t('company.delete')}
                  class="text-red-500 hover:text-red-700"
                  onclick={() => openDelete(company)}
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
{:else}
  <Empty
    title={$t('company.empty.title')}
    description={$t('company.empty.description')}
    icon={Building2Icon}
    variant="page"
  />
{/if}

<CompanyModal bind:open={modalOpen} company={editingCompany} onclose={() => (modalOpen = false)} />

<Dialog.Root bind:open={deleteDialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{$t('company.delete_modal.title')}</Dialog.Title>
      <Dialog.Description>
        {$t('company.delete_modal.description', { name: deleteCandidate?.name ?? '' })}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => (deleteDialogOpen = false)}>
        {$t('company.form.cancel')}
      </Button>
      <Button variant="destructive" onclick={confirmDelete} loading={isDeleting} disabled={isDeleting}>
        {$t('company.delete')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
