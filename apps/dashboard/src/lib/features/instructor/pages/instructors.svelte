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
  import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';

  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { instructorApi } from '$features/instructor/api/instructor.svelte';
  import { coursesApi } from '$features/course/api';
  import type { Instructor } from '$features/instructor/utils/types';
  import InstructorModal from '$features/instructor/components/instructor-modal.svelte';
  import {
    ccpBadgeVariant,
    ccpStatusLabelKey,
    formatDate,
    statusBadgeVariant,
    statusLabelKey
  } from '$features/instructor/utils/instructor-utils';

  let modalOpen = $state(false);
  let editingInstructor = $state<Instructor | null>(null);

  let deleteDialogOpen = $state(false);
  let deleteCandidate = $state<Instructor | null>(null);
  let isDeleting = $state(false);

  const courseOptions = $derived(coursesApi.orgCourses.map((course) => ({ id: course.id, title: course.title })));

  $effect(() => {
    if (!$currentOrg?.id) return;

    void instructorApi.list();
    void coursesApi.getOrgCourses();
  });

  function openCreate() {
    editingInstructor = null;
    modalOpen = true;
  }

  function openEdit(instructor: Instructor) {
    editingInstructor = instructor;
    modalOpen = true;
  }

  function openDelete(instructor: Instructor) {
    deleteCandidate = instructor;
    deleteDialogOpen = true;
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;

    isDeleting = true;

    try {
      await instructorApi.remove(deleteCandidate.id);
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
    {$t('instructor.add')}
  </Button>
</div>

{#if instructorApi.isLoading && instructorApi.instructors.length === 0}
  <div class="flex justify-center py-16">
    <Spinner class="size-10! text-blue-700!" />
  </div>
{:else if instructorApi.instructors.length > 0}
  <div class="w-full overflow-x-auto rounded-lg border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>{$t('instructor.table.name')}</Table.Head>
          <Table.Head>{$t('instructor.table.specialization')}</Table.Head>
          <Table.Head>{$t('instructor.table.ccp')}</Table.Head>
          <Table.Head>{$t('instructor.table.contract')}</Table.Head>
          <Table.Head>{$t('instructor.table.ip_cession')}</Table.Head>
          <Table.Head>{$t('instructor.table.courses')}</Table.Head>
          <Table.Head class="text-right">{$t('instructor.table.actions')}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each instructorApi.instructors as instructor (instructor.id)}
          <Table.Row>
            <Table.Cell>
              <div class="flex flex-col">
                <span class="font-medium">{instructor.fullname}</span>
                {#if instructor.email}
                  <span class="ui:text-muted-foreground text-xs">{instructor.email}</span>
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              {#if instructor.specialization}
                {instructor.specialization}
              {:else}
                <span class="ui:text-muted-foreground">—</span>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <div class="flex flex-col gap-1">
                <Badge variant={ccpBadgeVariant(instructor.ccpValidUntil)}>
                  {$t(ccpStatusLabelKey(instructor.ccpValidUntil))}
                </Badge>
                {#if instructor.ccpNumber || instructor.ccpValidUntil}
                  <span class="ui:text-muted-foreground text-xs">
                    {instructor.ccpNumber ?? ''}{#if instructor.ccpNumber && instructor.ccpValidUntil}
                      ·
                    {/if}{formatDate(instructor.ccpValidUntil)}
                  </span>
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              <Badge variant={statusBadgeVariant(instructor.contractStatus)}>
                {$t(statusLabelKey(instructor.contractStatus))}
              </Badge>
            </Table.Cell>
            <Table.Cell>
              <Badge variant={statusBadgeVariant(instructor.ipCessionStatus)}>
                {$t(statusLabelKey(instructor.ipCessionStatus))}
              </Badge>
            </Table.Cell>
            <Table.Cell>
              {#if instructor.courses.length > 0}
                <div class="flex max-w-xs flex-wrap gap-1">
                  {#each instructor.courses as course (course.courseId)}
                    <Badge variant="outline">{course.title}</Badge>
                  {/each}
                </div>
              {:else}
                <span class="ui:text-muted-foreground text-xs">{$t('instructor.table.no_courses')}</span>
              {/if}
            </Table.Cell>
            <Table.Cell class="text-right">
              <div class="flex justify-end gap-1">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={$t('instructor.edit')}
                  onclick={() => openEdit(instructor)}
                >
                  <PencilIcon size={16} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={$t('instructor.delete')}
                  class="text-red-500 hover:text-red-700"
                  onclick={() => openDelete(instructor)}
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
    title={$t('instructor.empty.title')}
    description={$t('instructor.empty.description')}
    icon={GraduationCapIcon}
    variant="page"
  />
{/if}

<InstructorModal
  bind:open={modalOpen}
  instructor={editingInstructor}
  courses={courseOptions}
  onclose={() => (modalOpen = false)}
/>

<Dialog.Root bind:open={deleteDialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{$t('instructor.delete_modal.title')}</Dialog.Title>
      <Dialog.Description>
        {$t('instructor.delete_modal.description', { name: deleteCandidate?.fullname ?? '' })}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => (deleteDialogOpen = false)}>
        {$t('instructor.form.cancel')}
      </Button>
      <Button variant="destructive" onclick={confirmDelete} loading={isDeleting} disabled={isDeleting}>
        {$t('instructor.delete')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
