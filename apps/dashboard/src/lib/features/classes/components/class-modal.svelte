<script lang="ts">
  import * as Dialog from '@cio/ui/base/dialog';
  import * as Field from '@cio/ui/base/field';
  import * as Select from '@cio/ui/base/select';
  import { Input } from '@cio/ui/base/input';
  import { Textarea } from '@cio/ui/base/textarea';
  import { Button } from '@cio/ui/base/button';

  import { t } from '$lib/utils/functions/translations';
  import { classesApi } from '$features/classes/api/classes.svelte';
  import {
    CLASS_MODES,
    CLASS_STATUSES,
    centsToEuros,
    classModeLabelKey,
    classStatusLabelKey,
    eurosToCents,
    fromDateTimeLocalInput,
    toDateTimeLocalInput
  } from '$features/classes/utils/class-utils';
  import type { CourseClass } from '$features/classes/utils/types';

  interface Props {
    open: boolean;
    courseId: string;
    courseClass?: CourseClass | null;
    onclose: () => void;
  }

  let { open = $bindable(), courseId, courseClass = null, onclose }: Props = $props();

  const isEditing = $derived(Boolean(courseClass));

  let fields = $state({
    name: '',
    startsOn: '',
    endsOn: '',
    enrollmentOpensAt: '',
    enrollmentClosesAt: '',
    /** Blank = unlimited seats. */
    seats: '',
    /** Blank = inherit the course price. */
    price: '',
    mode: 'online',
    location: '',
    schedule: '',
    status: 'draft',
    notes: ''
  });

  let isSubmitting = $state(false);

  function populateFrom(source: CourseClass | null) {
    fields.name = source?.name ?? '';
    fields.startsOn = source?.startsOn ?? '';
    fields.endsOn = source?.endsOn ?? '';
    fields.enrollmentOpensAt = toDateTimeLocalInput(source?.enrollmentOpensAt);
    fields.enrollmentClosesAt = toDateTimeLocalInput(source?.enrollmentClosesAt);
    fields.seats = source?.seats != null ? String(source.seats) : '';
    fields.price = centsToEuros(source?.priceCents);
    fields.mode = source?.mode ?? 'online';
    fields.location = source?.location ?? '';
    fields.schedule = source?.schedule ?? '';
    fields.status = source?.status ?? 'draft';
    fields.notes = source?.notes ?? '';
  }

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;

    if (isOpen) {
      classesApi.errors = {};
      populateFrom(courseClass);
      return;
    }

    onclose();
  }

  /** Blank means unlimited, so an empty field must clear the limit. */
  function parseSeats(): number | null {
    const trimmed = fields.seats.trim();
    if (!trimmed) return null;

    const seats = Number(trimmed);
    if (!Number.isFinite(seats) || seats <= 0) return null;

    return Math.round(seats);
  }

  function buildPayload() {
    return {
      name: fields.name.trim(),
      startsOn: fields.startsOn,
      endsOn: fields.endsOn,
      enrollmentOpensAt: fromDateTimeLocalInput(fields.enrollmentOpensAt),
      enrollmentClosesAt: fromDateTimeLocalInput(fields.enrollmentClosesAt),
      seats: parseSeats(),
      priceCents: eurosToCents(fields.price),
      mode: fields.mode as (typeof CLASS_MODES)[number],
      location: fields.location.trim(),
      schedule: fields.schedule.trim(),
      status: fields.status as (typeof CLASS_STATUSES)[number],
      notes: fields.notes.trim()
    };
  }

  async function handleSubmit() {
    isSubmitting = true;

    try {
      if (courseClass) {
        await classesApi.update(courseId, courseClass.id, buildPayload());
      } else {
        await classesApi.create(courseId, buildPayload());
      }

      if (classesApi.success) {
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
        {isEditing ? $t('classes.form.edit_title') : $t('classes.form.add_title')}
      </Dialog.Title>
      <Dialog.Description>{$t('classes.form.description')}</Dialog.Description>
    </Dialog.Header>

    <Field.Group>
      <Field.Set>
        <Field.Legend>{$t('classes.form.section_identification')}</Field.Legend>

        <Field.Field>
          <Field.Label for="class-name">{$t('classes.form.name')}</Field.Label>
          <Input id="class-name" placeholder={$t('classes.form.name_placeholder')} bind:value={fields.name} />
          {#if classesApi.errors.name}
            <Field.Error>{$t(classesApi.errors.name)}</Field.Error>
          {/if}
        </Field.Field>

        <div class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.Label for="class-starts-on">{$t('classes.form.starts_on')}</Field.Label>
            <Input id="class-starts-on" type="date" bind:value={fields.startsOn} />
            {#if classesApi.errors.startsOn}
              <Field.Error>{$t(classesApi.errors.startsOn)}</Field.Error>
            {/if}
          </Field.Field>

          <Field.Field>
            <Field.Label for="class-ends-on">{$t('classes.form.ends_on')}</Field.Label>
            <Input id="class-ends-on" type="date" bind:value={fields.endsOn} />
            {#if classesApi.errors.endsOn}
              <Field.Error>{$t(classesApi.errors.endsOn)}</Field.Error>
            {/if}
          </Field.Field>
        </div>

        <Field.Field>
          <Field.Label for="class-schedule">{$t('classes.form.schedule')}</Field.Label>
          <Input
            id="class-schedule"
            placeholder={$t('classes.form.schedule_placeholder')}
            bind:value={fields.schedule}
          />
          {#if classesApi.errors.schedule}
            <Field.Error>{$t(classesApi.errors.schedule)}</Field.Error>
          {/if}
        </Field.Field>

        <div class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.Label for="class-mode">{$t('classes.form.mode')}</Field.Label>
            <Select.Root type="single" bind:value={fields.mode}>
              <Select.Trigger id="class-mode" class="ui:w-full">
                {$t(classModeLabelKey(fields.mode))}
              </Select.Trigger>
              <Select.Content>
                {#each CLASS_MODES as mode (mode)}
                  <Select.Item value={mode}>{$t(classModeLabelKey(mode))}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>

          <Field.Field>
            <Field.Label for="class-location">{$t('classes.form.location')}</Field.Label>
            <Input
              id="class-location"
              placeholder={$t('classes.form.location_placeholder')}
              bind:value={fields.location}
            />
            {#if classesApi.errors.location}
              <Field.Error>{$t(classesApi.errors.location)}</Field.Error>
            {/if}
          </Field.Field>
        </div>
      </Field.Set>

      <Field.Separator />

      <Field.Set>
        <Field.Legend>{$t('classes.form.section_enrollment')}</Field.Legend>

        <div class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.Label for="class-seats">{$t('classes.form.seats')}</Field.Label>
            <Input
              id="class-seats"
              inputmode="numeric"
              placeholder={$t('classes.form.seats_placeholder')}
              bind:value={fields.seats}
            />
            <Field.Description>{$t('classes.form.seats_hint')}</Field.Description>
            {#if classesApi.errors.seats}
              <Field.Error>{$t(classesApi.errors.seats)}</Field.Error>
            {/if}
          </Field.Field>

          <Field.Field>
            <Field.Label for="class-price">{$t('classes.form.price')}</Field.Label>
            <Input id="class-price" inputmode="decimal" placeholder="0.00" bind:value={fields.price} />
            <Field.Description>{$t('classes.form.price_hint')}</Field.Description>
            {#if classesApi.errors.priceCents}
              <Field.Error>{$t(classesApi.errors.priceCents)}</Field.Error>
            {/if}
          </Field.Field>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.Label for="class-enrollment-opens">{$t('classes.form.enrollment_opens')}</Field.Label>
            <Input id="class-enrollment-opens" type="datetime-local" bind:value={fields.enrollmentOpensAt} />
            {#if classesApi.errors.enrollmentOpensAt}
              <Field.Error>{$t(classesApi.errors.enrollmentOpensAt)}</Field.Error>
            {/if}
          </Field.Field>

          <Field.Field>
            <Field.Label for="class-enrollment-closes">{$t('classes.form.enrollment_closes')}</Field.Label>
            <Input id="class-enrollment-closes" type="datetime-local" bind:value={fields.enrollmentClosesAt} />
            {#if classesApi.errors.enrollmentClosesAt}
              <Field.Error>{$t(classesApi.errors.enrollmentClosesAt)}</Field.Error>
            {/if}
          </Field.Field>
        </div>

        <Field.Field>
          <Field.Label for="class-status">{$t('classes.form.status')}</Field.Label>
          <Select.Root type="single" bind:value={fields.status}>
            <Select.Trigger id="class-status" class="ui:w-full">
              {$t(classStatusLabelKey(fields.status))}
            </Select.Trigger>
            <Select.Content>
              {#each CLASS_STATUSES as status (status)}
                <Select.Item value={status}>{$t(classStatusLabelKey(status))}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <Field.Description>{$t('classes.form.status_hint')}</Field.Description>
        </Field.Field>

        <Field.Field>
          <Field.Label for="class-notes">{$t('classes.form.notes')}</Field.Label>
          <Textarea id="class-notes" placeholder={$t('classes.form.notes_placeholder')} bind:value={fields.notes} />
          {#if classesApi.errors.notes}
            <Field.Error>{$t(classesApi.errors.notes)}</Field.Error>
          {/if}
        </Field.Field>
      </Field.Set>

      {#if classesApi.errors.general}
        <Field.Error>{$t(classesApi.errors.general)}</Field.Error>
      {/if}
    </Field.Group>

    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => handleOpenChange(false)}>
        {$t('classes.form.cancel')}
      </Button>
      <Button onclick={handleSubmit} loading={isSubmitting} disabled={isSubmitting}>
        {isEditing ? $t('classes.form.save') : $t('classes.form.create')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
