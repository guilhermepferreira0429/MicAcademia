<script lang="ts">
  import * as Dialog from '@cio/ui/base/dialog';
  import * as Field from '@cio/ui/base/field';
  import * as Select from '@cio/ui/base/select';
  import { Input } from '@cio/ui/base/input';
  import { Button } from '@cio/ui/base/button';
  import { Spinner } from '@cio/ui/base/spinner';
  import SearchIcon from '@lucide/svelte/icons/search';
  import CheckIcon from '@lucide/svelte/icons/check';

  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { orgApi } from '$features/org/api/org.svelte';
  import { companyApi } from '$features/company/api/company.svelte';
  import { COMPANY_MEMBER_ROLES, roleLabelKey } from '$features/company/utils/company-utils';
  import type { TCompanyMemberRole } from '@cio/utils/validation/company/company';

  interface Props {
    open: boolean;
    companyId: string;
    /** Profile ids already on the company's staff, so they are not offered twice. */
    existingProfileIds: string[];
    onclose: () => void;
  }

  let { open = $bindable(), companyId, existingProfileIds, onclose }: Props = $props();

  let search = $state('');
  let selectedProfileId = $state('');
  let role = $state<string>('employee');
  let jobTitle = $state('');
  let isSubmitting = $state(false);

  const existing = $derived(new Set(existingProfileIds));

  /**
   * The organization's people (the audience list), minus everyone already on
   * this company's staff. Only people with a profile can be enrolled.
   */
  const candidates = $derived(
    orgApi.audience.filter((member) => Boolean(member.profileId) && !existing.has(member.profileId!))
  );

  function loadPeople() {
    const orgId = $currentOrg?.id;
    if (!orgId) return;

    void orgApi.getOrgAudience(
      orgId,
      { page: 1, limit: 100, search: search.trim() || undefined },
      {
        abortPrevious: true
      }
    );
  }

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;

    if (isOpen) {
      companyApi.errors = {};
      search = '';
      selectedProfileId = '';
      role = 'employee';
      jobTitle = '';
      loadPeople();
      return;
    }

    onclose();
  }

  function handleSearch(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      loadPeople();
    }
  }

  async function handleSubmit() {
    if (!selectedProfileId) return;

    isSubmitting = true;

    try {
      await companyApi.addMember(companyId, {
        profileId: selectedProfileId,
        role: role as TCompanyMemberRole,
        jobTitle: jobTitle.trim()
      });

      if (companyApi.success) {
        handleOpenChange(false);
      }
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title>{$t('company.staff.add_title')}</Dialog.Title>
      <Dialog.Description>{$t('company.staff.add_description')}</Dialog.Description>
    </Dialog.Header>

    <Field.Group>
      <Field.Field>
        <Field.Label for="company-staff-search">{$t('company.staff.search')}</Field.Label>
        <div class="flex gap-2">
          <Input
            id="company-staff-search"
            placeholder={$t('company.staff.search_placeholder')}
            bind:value={search}
            onkeydown={handleSearch}
          />
          <Button variant="outline" size="icon" aria-label={$t('company.staff.search')} onclick={loadPeople}>
            <SearchIcon size={16} />
          </Button>
        </div>
      </Field.Field>

      <div class="max-h-64 overflow-y-auto rounded-lg border">
        {#if orgApi.isLoading && candidates.length === 0}
          <div class="flex justify-center py-8">
            <Spinner class="size-6!" />
          </div>
        {:else if candidates.length === 0}
          <p class="ui:text-muted-foreground p-4 text-sm">{$t('company.staff.no_candidates')}</p>
        {:else}
          <ul>
            {#each candidates as person (person.id)}
              <li>
                <button
                  type="button"
                  class="hover:bg-accent flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                  onclick={() => (selectedProfileId = person.profileId!)}
                >
                  <span class="flex flex-col">
                    <span class="font-medium">{person.name}</span>
                    <span class="ui:text-muted-foreground text-xs">{person.email}</span>
                  </span>
                  {#if selectedProfileId === person.profileId}
                    <CheckIcon size={16} />
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <Field.Field>
          <Field.Label for="company-staff-role">{$t('company.staff.role')}</Field.Label>
          <Select.Root type="single" bind:value={role}>
            <Select.Trigger id="company-staff-role" class="ui:w-full">
              {$t(roleLabelKey(role))}
            </Select.Trigger>
            <Select.Content>
              {#each COMPANY_MEMBER_ROLES as option (option)}
                <Select.Item value={option}>{$t(roleLabelKey(option))}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </Field.Field>

        <Field.Field>
          <Field.Label for="company-staff-job">{$t('company.staff.job_title')}</Field.Label>
          <Input id="company-staff-job" placeholder={$t('company.staff.job_title_placeholder')} bind:value={jobTitle} />
          {#if companyApi.errors.jobTitle}
            <Field.Error>{$t(companyApi.errors.jobTitle)}</Field.Error>
          {/if}
        </Field.Field>
      </div>

      {#if companyApi.errors.profileId}
        <Field.Error>{$t(companyApi.errors.profileId)}</Field.Error>
      {/if}
    </Field.Group>

    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => handleOpenChange(false)}>
        {$t('company.form.cancel')}
      </Button>
      <Button onclick={handleSubmit} loading={isSubmitting} disabled={isSubmitting || !selectedProfileId}>
        {$t('company.staff.add')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
