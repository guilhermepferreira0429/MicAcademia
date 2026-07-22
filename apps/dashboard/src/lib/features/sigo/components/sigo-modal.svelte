<script lang="ts">
  import * as Dialog from '@cio/ui/base/dialog';
  import * as Field from '@cio/ui/base/field';
  import * as Select from '@cio/ui/base/select';
  import { Input } from '@cio/ui/base/input';
  import { Textarea } from '@cio/ui/base/textarea';
  import { Button } from '@cio/ui/base/button';

  import { t } from '$lib/utils/functions/translations';
  import { sigoApi } from '$features/sigo/api/sigo.svelte';
  import type { SigoSubmission } from '$features/sigo/utils/types';
  import { SIGO_STATUSES, centsToEuros, eurosToCents, toDateInputValue } from '$features/sigo/utils/sigo-utils';
  import type { TSigoStatus } from '@cio/utils/validation/sigo/sigo';

  interface CourseOption {
    id: string;
    title: string;
  }

  interface Props {
    open: boolean;
    submission?: SigoSubmission | null;
    courses?: CourseOption[];
    onclose: () => void;
  }

  let { open = $bindable(), submission = null, courses = [], onclose }: Props = $props();

  const isEditing = $derived(Boolean(submission));

  // `status` and `courseId` are plain strings so they can bind to the Select
  // (which writes back a raw string); they are narrowed in buildPayload().
  let fields = $state({
    courseId: '',
    status: 'pending',
    reference: '',
    submittedAt: '',
    approvedAt: '',
    paidAt: '',
    amount: '',
    notes: ''
  });

  let isSubmitting = $state(false);

  const selectedCourseTitle = $derived(
    courses.find((course) => course.id === fields.courseId)?.title ?? $t('sigo.form.course_placeholder')
  );

  function populateFrom(source: SigoSubmission | null) {
    fields.courseId = source?.courseId ?? '';
    fields.status = source?.status ?? 'pending';
    fields.reference = source?.reference ?? '';
    fields.submittedAt = toDateInputValue(source?.submittedAt);
    fields.approvedAt = toDateInputValue(source?.approvedAt);
    fields.paidAt = toDateInputValue(source?.paidAt);
    fields.amount = centsToEuros(source?.amountCents);
    fields.notes = source?.notes ?? '';
  }

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;

    if (isOpen) {
      sigoApi.errors = {};
      populateFrom(submission);
      return;
    }

    onclose();
  }

  function buildPayload() {
    const amountCents = eurosToCents(fields.amount);
    const payload: {
      status: TSigoStatus;
      reference: string;
      submittedAt: string;
      approvedAt: string;
      paidAt: string;
      notes: string;
      amountCents?: number;
    } = {
      status: fields.status as TSigoStatus,
      reference: fields.reference.trim(),
      submittedAt: fields.submittedAt,
      approvedAt: fields.approvedAt,
      paidAt: fields.paidAt,
      notes: fields.notes.trim()
    };

    // Blank amount leaves the stored value untouched — the API has no "clear" value for it.
    if (amountCents !== null) {
      payload.amountCents = amountCents;
    }

    return payload;
  }

  async function handleSubmit() {
    isSubmitting = true;

    try {
      if (submission) {
        await sigoApi.update(submission.id, buildPayload());
      } else {
        await sigoApi.create({ ...buildPayload(), courseId: fields.courseId });
      }

      if (sigoApi.success) {
        handleOpenChange(false);
      }
    } finally {
      isSubmitting = false;
    }
  }

  function statusLabel(status: string): string {
    return $t(`sigo.status.${status}`);
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>
        {isEditing ? $t('sigo.form.edit_title') : $t('sigo.form.add_title')}
      </Dialog.Title>
      <Dialog.Description>{$t('sigo.form.description')}</Dialog.Description>
    </Dialog.Header>

    <Field.Group>
      <Field.Set>
        <Field.Legend>{$t('sigo.form.section_submission')}</Field.Legend>

        {#if !isEditing}
          <Field.Field>
            <Field.Label>{$t('sigo.form.course')}</Field.Label>
            <Select.Root type="single" bind:value={fields.courseId}>
              <Select.Trigger class="ui:w-full">
                {selectedCourseTitle}
              </Select.Trigger>
              <Select.Content>
                {#each courses as course (course.id)}
                  <Select.Item value={course.id}>{course.title}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            {#if sigoApi.errors.courseId}
              <Field.Error>{$t(sigoApi.errors.courseId)}</Field.Error>
            {/if}
          </Field.Field>
        {:else}
          <Field.Field>
            <Field.Label>{$t('sigo.form.course')}</Field.Label>
            <p class="ui:text-muted-foreground text-sm">{submission?.courseTitle}</p>
          </Field.Field>
        {/if}

        <div class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.Label>{$t('sigo.form.status')}</Field.Label>
            <Select.Root type="single" bind:value={fields.status}>
              <Select.Trigger class="ui:w-full">
                {statusLabel(fields.status)}
              </Select.Trigger>
              <Select.Content>
                {#each SIGO_STATUSES as status (status)}
                  <Select.Item value={status}>{statusLabel(status)}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>

          <Field.Field>
            <Field.Label>{$t('sigo.form.reference')}</Field.Label>
            <Input placeholder={$t('sigo.form.reference_placeholder')} bind:value={fields.reference} />
            {#if sigoApi.errors.reference}
              <Field.Error>{$t(sigoApi.errors.reference)}</Field.Error>
            {/if}
          </Field.Field>
        </div>
      </Field.Set>

      <Field.Separator />

      <Field.Set>
        <Field.Legend>{$t('sigo.form.section_progress')}</Field.Legend>
        <Field.Description>{$t('sigo.form.dates_description')}</Field.Description>

        <div class="grid gap-4 sm:grid-cols-3">
          <Field.Field>
            <Field.Label>{$t('sigo.form.submitted_at')}</Field.Label>
            <Input type="date" bind:value={fields.submittedAt} />
          </Field.Field>

          <Field.Field>
            <Field.Label>{$t('sigo.form.approved_at')}</Field.Label>
            <Input type="date" bind:value={fields.approvedAt} />
          </Field.Field>

          <Field.Field>
            <Field.Label>{$t('sigo.form.paid_at')}</Field.Label>
            <Input type="date" bind:value={fields.paidAt} />
          </Field.Field>
        </div>

        <Field.Field>
          <Field.Label>{$t('sigo.form.amount')}</Field.Label>
          <!-- Text (not number) so the bound value stays a string and a comma decimal still parses. -->
          <Input type="text" inputmode="decimal" placeholder="0.00" bind:value={fields.amount} />
          <Field.Description>{$t('sigo.form.amount_description')}</Field.Description>
          {#if sigoApi.errors.amountCents}
            <Field.Error>{$t(sigoApi.errors.amountCents)}</Field.Error>
          {/if}
        </Field.Field>

        <Field.Field>
          <Field.Label>{$t('sigo.form.notes')}</Field.Label>
          <Textarea placeholder={$t('sigo.form.notes_placeholder')} bind:value={fields.notes} />
        </Field.Field>
      </Field.Set>
    </Field.Group>

    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => handleOpenChange(false)}>
        {$t('sigo.form.cancel')}
      </Button>
      <Button onclick={handleSubmit} loading={isSubmitting} disabled={isSubmitting || (!isEditing && !fields.courseId)}>
        {isEditing ? $t('sigo.form.save') : $t('sigo.form.create')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
