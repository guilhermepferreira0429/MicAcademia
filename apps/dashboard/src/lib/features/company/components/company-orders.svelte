<script lang="ts">
  import * as Table from '@cio/ui/base/table';
  import * as Select from '@cio/ui/base/select';
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import { Input } from '@cio/ui/base/input';
  import CheckIcon from '@lucide/svelte/icons/check';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import XIcon from '@lucide/svelte/icons/x';

  import { t } from '$lib/utils/functions/translations';
  import { companyApi } from '$features/company/api/company.svelte';
  import {
    COMPANY_ENROLLMENT_STATUSES,
    formatDate,
    formatEuros,
    orderStatusBadgeVariant,
    orderStatusLabelKey
  } from '$features/company/utils/company-utils';
  import type { CompanyEnrollment } from '$features/company/utils/types';
  import type { TCompanyEnrollmentStatus } from '@cio/utils/validation/company/company';

  interface Props {
    companyId: string;
    enrollments: CompanyEnrollment[];
  }

  let { companyId, enrollments }: Props = $props();

  let editingId = $state<string | null>(null);
  let draftStatus = $state<string>('pending');
  let draftReference = $state('');
  let isSaving = $state(false);

  function startEdit(order: CompanyEnrollment) {
    editingId = order.id;
    draftStatus = order.status;
    draftReference = order.invoiceReference ?? '';
  }

  function cancelEdit() {
    editingId = null;
  }

  async function saveEdit(order: CompanyEnrollment) {
    isSaving = true;

    try {
      await companyApi.updateEnrollment(companyId, order.id, {
        status: draftStatus as TCompanyEnrollmentStatus,
        invoiceReference: draftReference.trim()
      });

      if (companyApi.success) {
        editingId = null;
      }
    } finally {
      isSaving = false;
    }
  }
</script>

{#if enrollments.length === 0}
  <p class="ui:text-muted-foreground text-sm">{$t('company.orders.empty')}</p>
{:else}
  <div class="w-full overflow-x-auto rounded-lg border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>{$t('company.orders.course')}</Table.Head>
          <Table.Head>{$t('company.orders.seats')}</Table.Head>
          <Table.Head>{$t('company.orders.unit_price')}</Table.Head>
          <Table.Head>{$t('company.orders.total')}</Table.Head>
          <Table.Head>{$t('company.orders.status')}</Table.Head>
          <Table.Head>{$t('company.orders.invoice_reference')}</Table.Head>
          <Table.Head class="text-right">{$t('company.orders.actions')}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each enrollments as order (order.id)}
          <Table.Row>
            <Table.Cell>
              <div class="flex flex-col">
                <span class="font-medium">{order.courseTitle}</span>
                <span class="ui:text-muted-foreground text-xs">{formatDate(order.createdAt)}</span>
              </div>
            </Table.Cell>
            <Table.Cell>{order.seats}</Table.Cell>
            <Table.Cell>{formatEuros(order.unitPriceCents)}</Table.Cell>
            <Table.Cell class="font-medium">{formatEuros(order.totalCents)}</Table.Cell>
            <Table.Cell>
              {#if editingId === order.id}
                <Select.Root type="single" bind:value={draftStatus}>
                  <Select.Trigger class="ui:w-36">
                    {$t(orderStatusLabelKey(draftStatus))}
                  </Select.Trigger>
                  <Select.Content>
                    {#each COMPANY_ENROLLMENT_STATUSES as status (status)}
                      <Select.Item value={status}>{$t(orderStatusLabelKey(status))}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              {:else}
                <Badge variant={orderStatusBadgeVariant(order.status)}>
                  {$t(orderStatusLabelKey(order.status))}
                </Badge>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {#if editingId === order.id}
                <Input
                  class="w-44"
                  placeholder={$t('company.orders.invoice_reference_placeholder')}
                  bind:value={draftReference}
                />
              {:else if order.invoiceReference}
                {order.invoiceReference}
              {:else}
                <span class="ui:text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell class="text-right">
              <div class="flex justify-end gap-1">
                {#if editingId === order.id}
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={$t('company.orders.save')}
                    loading={isSaving}
                    disabled={isSaving}
                    onclick={() => saveEdit(order)}
                  >
                    <CheckIcon size={16} />
                  </Button>
                  <Button variant="secondary" size="icon" aria-label={$t('company.form.cancel')} onclick={cancelEdit}>
                    <XIcon size={16} />
                  </Button>
                {:else}
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label={$t('company.orders.edit')}
                    onclick={() => startEdit(order)}
                  >
                    <PencilIcon size={16} />
                  </Button>
                {/if}
              </div>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
