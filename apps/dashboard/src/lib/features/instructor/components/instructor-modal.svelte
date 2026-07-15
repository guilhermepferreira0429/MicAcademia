<script lang="ts">
  import * as Dialog from '@cio/ui/base/dialog';
  import * as Field from '@cio/ui/base/field';
  import * as Select from '@cio/ui/base/select';
  import { Input } from '@cio/ui/base/input';
  import { Textarea } from '@cio/ui/base/textarea';
  import { Button } from '@cio/ui/base/button';
  import { Badge } from '@cio/ui/base/badge';
  import XIcon from '@lucide/svelte/icons/x';

  import { t } from '$lib/utils/functions/translations';
  import { instructorApi } from '$features/instructor/api/instructor.svelte';
  import type { Instructor } from '$features/instructor/utils/types';
  import { toDateInputValue } from '$features/instructor/utils/instructor-utils';
  import type { TInstructorStatus } from '@cio/utils/validation/instructor/instructor';

  interface CourseOption {
    id: string;
    title: string;
  }

  interface Props {
    open: boolean;
    instructor?: Instructor | null;
    courses?: CourseOption[];
    onclose: () => void;
  }

  let { open = $bindable(), instructor = null, courses = [], onclose }: Props = $props();

  const isEditing = $derived(Boolean(instructor));

  const STATUS_OPTIONS: TInstructorStatus[] = ['none', 'pending', 'signed'];

  // Status fields are plain strings so they can bind to the Select (which writes
  // back a raw string); they are cast to the status union in buildPayload().
  let fields = $state({
    fullname: '',
    email: '',
    ccpNumber: '',
    ccpValidUntil: '',
    specialization: '',
    contractStatus: 'none',
    ipCessionStatus: 'none',
    notes: ''
  });

  let isSubmitting = $state(false);
  let assigningCourseId = $state('');

  /** The live instructor record (kept fresh after list refreshes) for the course chips. */
  const liveInstructor = $derived(instructor ? (instructorApi.findById(instructor.id) ?? instructor) : null);

  const assignedCourseIds = $derived(new Set(liveInstructor?.courses.map((course) => course.courseId) ?? []));
  const availableCourses = $derived(courses.filter((course) => !assignedCourseIds.has(course.id)));

  function populateFrom(source: Instructor | null) {
    fields.fullname = source?.fullname ?? '';
    fields.email = source?.email ?? '';
    fields.ccpNumber = source?.ccpNumber ?? '';
    fields.ccpValidUntil = toDateInputValue(source?.ccpValidUntil);
    fields.specialization = source?.specialization ?? '';
    fields.contractStatus = source?.contractStatus ?? 'none';
    fields.ipCessionStatus = source?.ipCessionStatus ?? 'none';
    fields.notes = source?.notes ?? '';
  }

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;

    if (isOpen) {
      instructorApi.errors = {};
      populateFrom(instructor);
      assigningCourseId = '';
      return;
    }

    onclose();
  }

  function buildPayload() {
    return {
      fullname: fields.fullname.trim(),
      email: fields.email.trim(),
      ccpNumber: fields.ccpNumber.trim(),
      ccpValidUntil: fields.ccpValidUntil,
      specialization: fields.specialization.trim(),
      contractStatus: fields.contractStatus as TInstructorStatus,
      ipCessionStatus: fields.ipCessionStatus as TInstructorStatus,
      notes: fields.notes.trim()
    };
  }

  async function handleSubmit() {
    isSubmitting = true;

    try {
      if (instructor) {
        await instructorApi.update(instructor.id, buildPayload());
      } else {
        await instructorApi.create(buildPayload());
      }

      if (instructorApi.success) {
        handleOpenChange(false);
      }
    } finally {
      isSubmitting = false;
    }
  }

  async function handleAssignCourse(courseId: string) {
    if (!instructor || !courseId) return;

    await instructorApi.assignCourse(instructor.id, courseId);
    assigningCourseId = '';
  }

  async function handleUnassignCourse(courseId: string) {
    if (!instructor) return;

    await instructorApi.unassignCourse(instructor.id, courseId);
  }

  function statusLabel(status: string): string {
    return $t(`instructor.status.${status}`);
  }
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
  <Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>
        {isEditing ? $t('instructor.form.edit_title') : $t('instructor.form.add_title')}
      </Dialog.Title>
      <Dialog.Description>{$t('instructor.form.description')}</Dialog.Description>
    </Dialog.Header>

    <Field.Group>
      <Field.Set>
        <Field.Legend>{$t('instructor.form.section_details')}</Field.Legend>

        <Field.Field>
          <Field.Label>{$t('instructor.form.fullname')}</Field.Label>
          <Input placeholder={$t('instructor.form.fullname_placeholder')} bind:value={fields.fullname} />
          {#if instructorApi.errors.fullname}
            <Field.Error>{$t(instructorApi.errors.fullname)}</Field.Error>
          {/if}
        </Field.Field>

        <div class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.Label>{$t('instructor.form.email')}</Field.Label>
            <Input type="email" placeholder={$t('instructor.form.email_placeholder')} bind:value={fields.email} />
            {#if instructorApi.errors.email}
              <Field.Error>{$t(instructorApi.errors.email)}</Field.Error>
            {/if}
          </Field.Field>

          <Field.Field>
            <Field.Label>{$t('instructor.form.specialization')}</Field.Label>
            <Input placeholder={$t('instructor.form.specialization_placeholder')} bind:value={fields.specialization} />
          </Field.Field>
        </div>
      </Field.Set>

      <Field.Separator />

      <Field.Set>
        <Field.Legend>{$t('instructor.form.section_compliance')}</Field.Legend>

        <div class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.Label>{$t('instructor.form.ccp_number')}</Field.Label>
            <Input placeholder={$t('instructor.form.ccp_number_placeholder')} bind:value={fields.ccpNumber} />
          </Field.Field>

          <Field.Field>
            <Field.Label>{$t('instructor.form.ccp_valid_until')}</Field.Label>
            <Input type="date" bind:value={fields.ccpValidUntil} />
          </Field.Field>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <Field.Field>
            <Field.Label>{$t('instructor.form.contract_status')}</Field.Label>
            <Select.Root type="single" bind:value={fields.contractStatus}>
              <Select.Trigger class="ui:w-full">
                {statusLabel(fields.contractStatus)}
              </Select.Trigger>
              <Select.Content>
                {#each STATUS_OPTIONS as status}
                  <Select.Item value={status}>{statusLabel(status)}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>

          <Field.Field>
            <Field.Label>{$t('instructor.form.ip_cession_status')}</Field.Label>
            <Select.Root type="single" bind:value={fields.ipCessionStatus}>
              <Select.Trigger class="ui:w-full">
                {statusLabel(fields.ipCessionStatus)}
              </Select.Trigger>
              <Select.Content>
                {#each STATUS_OPTIONS as status}
                  <Select.Item value={status}>{statusLabel(status)}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </Field.Field>
        </div>

        <Field.Field>
          <Field.Label>{$t('instructor.form.notes')}</Field.Label>
          <Textarea placeholder={$t('instructor.form.notes_placeholder')} bind:value={fields.notes} />
        </Field.Field>
      </Field.Set>

      {#if isEditing}
        <Field.Separator />

        <Field.Set>
          <Field.Legend>{$t('instructor.form.section_courses')}</Field.Legend>
          <Field.Description>{$t('instructor.form.courses_description')}</Field.Description>

          <div class="flex flex-wrap gap-2">
            {#if liveInstructor && liveInstructor.courses.length > 0}
              {#each liveInstructor.courses as course}
                <Badge variant="secondary" class="gap-1">
                  {course.title}
                  <button
                    type="button"
                    class="ml-1 rounded-full hover:opacity-70"
                    aria-label={$t('instructor.form.unassign_course')}
                    onclick={() => handleUnassignCourse(course.courseId)}
                  >
                    <XIcon size={12} />
                  </button>
                </Badge>
              {/each}
            {:else}
              <p class="ui:text-muted-foreground text-sm">{$t('instructor.form.no_courses')}</p>
            {/if}
          </div>

          {#if availableCourses.length > 0}
            <Field.Field>
              <Field.Label>{$t('instructor.form.assign_course')}</Field.Label>
              <Select.Root
                type="single"
                bind:value={assigningCourseId}
                onValueChange={(value) => value && handleAssignCourse(value)}
              >
                <Select.Trigger class="ui:w-full">
                  {$t('instructor.form.assign_course_placeholder')}
                </Select.Trigger>
                <Select.Content>
                  {#each availableCourses as course}
                    <Select.Item value={course.id}>{course.title}</Select.Item>
                  {/each}
                </Select.Content>
              </Select.Root>
            </Field.Field>
          {/if}
        </Field.Set>
      {/if}
    </Field.Group>

    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => handleOpenChange(false)}>
        {$t('instructor.form.cancel')}
      </Button>
      <Button onclick={handleSubmit} loading={isSubmitting} disabled={isSubmitting}>
        {isEditing ? $t('instructor.form.save') : $t('instructor.form.create')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
