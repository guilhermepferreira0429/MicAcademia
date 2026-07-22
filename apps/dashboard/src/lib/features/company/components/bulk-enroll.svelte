<script lang="ts">
  import * as Field from '@cio/ui/base/field';
  import * as Select from '@cio/ui/base/select';
  import { Alert, AlertDescription, AlertTitle } from '@cio/ui/base/alert';
  import { Button } from '@cio/ui/base/button';
  import { Checkbox } from '@cio/ui/base/checkbox';
  import { Input } from '@cio/ui/base/input';
  import { SvelteSet } from 'svelte/reactivity';
  import UsersIcon from '@lucide/svelte/icons/users';

  import { t } from '$lib/utils/functions/translations';
  import { companyApi } from '$features/company/api/company.svelte';
  import { eurosToCents } from '$features/company/utils/company-utils';
  import type { CompanyMember } from '$features/company/utils/types';

  interface CourseOption {
    id: string;
    title: string;
  }

  interface Props {
    companyId: string;
    members: CompanyMember[];
    courses: CourseOption[];
  }

  let { companyId, members, courses }: Props = $props();

  let courseId = $state('');
  let unitPrice = $state('');
  let isSubmitting = $state(false);

  const selected = new SvelteSet<string>();

  const selectedCourseTitle = $derived(courses.find((course) => course.id === courseId)?.title ?? '');
  const allSelected = $derived(members.length > 0 && selected.size === members.length);
  const result = $derived(companyApi.lastEnrollResult);

  function toggleMember(profileId: string) {
    if (selected.has(profileId)) {
      selected.delete(profileId);
    } else {
      selected.add(profileId);
    }
  }

  function toggleAll() {
    if (allSelected) {
      selected.clear();
      return;
    }

    for (const member of members) {
      selected.add(member.profileId);
    }
  }

  async function handleSubmit() {
    if (!courseId || selected.size === 0) return;

    const cents = eurosToCents(unitPrice);

    isSubmitting = true;

    try {
      await companyApi.bulkEnroll(companyId, {
        courseId,
        profileIds: [...selected],
        ...(cents === null ? {} : { unitPriceCents: cents })
      });

      if (companyApi.success) {
        selected.clear();
        unitPrice = '';
      }
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="space-y-4">
  <p class="ui:text-muted-foreground text-sm">{$t('company.enroll.description')}</p>

  <div class="grid gap-4 sm:grid-cols-2">
    <Field.Field>
      <Field.Label for="company-enroll-course">{$t('company.enroll.course')}</Field.Label>
      <Select.Root type="single" bind:value={courseId}>
        <Select.Trigger id="company-enroll-course" class="ui:w-full">
          {selectedCourseTitle || $t('company.enroll.course_placeholder')}
        </Select.Trigger>
        <Select.Content>
          {#each courses as course (course.id)}
            <Select.Item value={course.id}>{course.title}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      {#if companyApi.errors.courseId}
        <Field.Error>{$t(companyApi.errors.courseId)}</Field.Error>
      {/if}
    </Field.Field>

    <Field.Field>
      <Field.Label for="company-enroll-price">{$t('company.enroll.unit_price')}</Field.Label>
      <Input id="company-enroll-price" inputmode="decimal" placeholder="0.00" bind:value={unitPrice} />
      <Field.Description>{$t('company.enroll.unit_price_hint')}</Field.Description>
      {#if companyApi.errors.unitPriceCents}
        <Field.Error>{$t(companyApi.errors.unitPriceCents)}</Field.Error>
      {/if}
    </Field.Field>
  </div>

  {#if members.length === 0}
    <p class="ui:text-muted-foreground text-sm">{$t('company.enroll.no_staff')}</p>
  {:else}
    <div class="rounded-lg border">
      <div class="flex items-center justify-between border-b px-3 py-2">
        <label class="flex items-center gap-2 text-sm font-medium">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          {$t('company.enroll.select_all')}
        </label>
        <span class="ui:text-muted-foreground text-xs">
          {$t('company.enroll.selected_count', { count: selected.size })}
        </span>
      </div>
      <ul class="max-h-64 overflow-y-auto">
        {#each members as member (member.profileId)}
          <li>
            <label class="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-sm">
              <Checkbox
                checked={selected.has(member.profileId)}
                onCheckedChange={() => toggleMember(member.profileId)}
              />
              <span class="flex flex-col">
                <span class="font-medium">{member.fullname ?? member.email}</span>
                <span class="ui:text-muted-foreground text-xs">
                  {member.email}{#if member.jobTitle}
                    · {member.jobTitle}
                  {/if}
                </span>
              </span>
            </label>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="flex justify-end">
    <Button onclick={handleSubmit} loading={isSubmitting} disabled={isSubmitting || !courseId || selected.size === 0}>
      <UsersIcon size={16} />
      {$t('company.enroll.submit')}
    </Button>
  </div>

  {#if result}
    <Alert>
      <AlertTitle>{$t('company.enroll.result_title')}</AlertTitle>
      <AlertDescription>
        {$t('company.enroll.result_description', {
          enrolled: result.enrolled,
          alreadyEnrolled: result.alreadyEnrolled,
          failed: result.failed
        })}
      </AlertDescription>
    </Alert>
  {/if}
</div>
