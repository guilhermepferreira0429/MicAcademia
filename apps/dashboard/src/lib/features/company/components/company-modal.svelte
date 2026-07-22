<script lang="ts">
  import * as Dialog from '@cio/ui/base/dialog';
  import * as Field from '@cio/ui/base/field';
  import { Input } from '@cio/ui/base/input';
  import { Textarea } from '@cio/ui/base/textarea';
  import { Button } from '@cio/ui/base/button';

  import { t } from '$lib/utils/functions/translations';
  import { companyApi } from '$features/company/api/company.svelte';
  import type { CompanyRecord } from '$features/company/utils/types';

  interface Props {
    open: boolean;
    company?: CompanyRecord | null;
    onclose: () => void;
  }

  let { open = $bindable(), company = null, onclose }: Props = $props();

  const isEditing = $derived(Boolean(company));

  let fields = $state({
    name: '',
    nif: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    /** Blank means "use the 40h legal default". */
    annualTrainingHours: ''
  });

  let isSubmitting = $state(false);

  function populateFrom(source: CompanyRecord | null) {
    fields.name = source?.name ?? '';
    fields.nif = source?.nif ?? '';
    fields.email = source?.email ?? '';
    fields.phone = source?.phone ?? '';
    fields.address = source?.address ?? '';
    fields.notes = source?.notes ?? '';
    fields.annualTrainingHours = source?.annualTrainingHours ? String(source.annualTrainingHours) : '';
  }

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;

    if (isOpen) {
      companyApi.errors = {};
      populateFrom(company);
      return;
    }

    onclose();
  }

  /** Blank keeps the legal default, so an empty field must clear the override. */
  function parseAnnualTrainingHours(): number | null {
    const trimmed = fields.annualTrainingHours.trim();
    if (!trimmed) return null;

    const hours = Number(trimmed);
    if (!Number.isFinite(hours) || hours <= 0) return null;

    return Math.round(hours);
  }

  function buildPayload() {
    const annualTrainingHours = parseAnnualTrainingHours();

    return {
      name: fields.name.trim(),
      nif: fields.nif.trim(),
      email: fields.email.trim(),
      phone: fields.phone.trim(),
      address: fields.address.trim(),
      notes: fields.notes.trim(),
      annualTrainingHours
    };
  }

  async function handleSubmit() {
    isSubmitting = true;

    try {
      if (company) {
        await companyApi.update(company.id, buildPayload());
      } else {
        await companyApi.create(buildPayload());
      }

      if (companyApi.success) {
        handleOpenChange(false);
      }
    } finally {
      isSubmitting = false;
    }
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>
        {isEditing ? $t('company.form.edit_title') : $t('company.form.add_title')}
      </Dialog.Title>
      <Dialog.Description>{$t('company.form.description')}</Dialog.Description>
    </Dialog.Header>

    <Field.Group>
      <Field.Set>
        <Field.Legend>{$t('company.form.section_identification')}</Field.Legend>

        <Field.Field>
          <Field.Label for="company-name">{$t('company.form.name')}</Field.Label>
          <Input id="company-name" placeholder={$t('company.form.name_placeholder')} bind:value={fields.name} />
          {#if companyApi.errors.name}
            <Field.Error>{$t(companyApi.errors.name)}</Field.Error>
          {/if}
        </Field.Field>

        <div class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.Label for="company-nif">{$t('company.form.nif')}</Field.Label>
            <Input id="company-nif" placeholder={$t('company.form.nif_placeholder')} bind:value={fields.nif} />
            <Field.Description>{$t('company.form.nif_hint')}</Field.Description>
            {#if companyApi.errors.nif}
              <Field.Error>{$t(companyApi.errors.nif)}</Field.Error>
            {/if}
          </Field.Field>

          <Field.Field>
            <Field.Label for="company-email">{$t('company.form.email')}</Field.Label>
            <Input
              id="company-email"
              type="email"
              placeholder={$t('company.form.email_placeholder')}
              bind:value={fields.email}
            />
            {#if companyApi.errors.email}
              <Field.Error>{$t(companyApi.errors.email)}</Field.Error>
            {/if}
          </Field.Field>
        </div>

        <Field.Field>
          <Field.Label for="company-annual-training-hours">{$t('company.form.annual_training_hours')}</Field.Label>
          <Input
            id="company-annual-training-hours"
            inputmode="numeric"
            placeholder={$t('company.form.annual_training_hours_placeholder')}
            bind:value={fields.annualTrainingHours}
          />
          <Field.Description>{$t('company.form.annual_training_hours_hint')}</Field.Description>
          {#if companyApi.errors.annualTrainingHours}
            <Field.Error>{$t(companyApi.errors.annualTrainingHours)}</Field.Error>
          {/if}
        </Field.Field>
      </Field.Set>

      <Field.Separator />

      <Field.Set>
        <Field.Legend>{$t('company.form.section_contact')}</Field.Legend>

        <div class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.Label for="company-phone">{$t('company.form.phone')}</Field.Label>
            <Input id="company-phone" placeholder={$t('company.form.phone_placeholder')} bind:value={fields.phone} />
            {#if companyApi.errors.phone}
              <Field.Error>{$t(companyApi.errors.phone)}</Field.Error>
            {/if}
          </Field.Field>

          <Field.Field>
            <Field.Label for="company-address">{$t('company.form.address')}</Field.Label>
            <Input
              id="company-address"
              placeholder={$t('company.form.address_placeholder')}
              bind:value={fields.address}
            />
            {#if companyApi.errors.address}
              <Field.Error>{$t(companyApi.errors.address)}</Field.Error>
            {/if}
          </Field.Field>
        </div>

        <Field.Field>
          <Field.Label for="company-notes">{$t('company.form.notes')}</Field.Label>
          <Textarea id="company-notes" placeholder={$t('company.form.notes_placeholder')} bind:value={fields.notes} />
          {#if companyApi.errors.notes}
            <Field.Error>{$t(companyApi.errors.notes)}</Field.Error>
          {/if}
        </Field.Field>
      </Field.Set>

      {#if companyApi.errors.general}
        <Field.Error>{$t(companyApi.errors.general)}</Field.Error>
      {/if}
    </Field.Group>

    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => handleOpenChange(false)}>
        {$t('company.form.cancel')}
      </Button>
      <Button onclick={handleSubmit} loading={isSubmitting} disabled={isSubmitting}>
        {isEditing ? $t('company.form.save') : $t('company.form.create')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
