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
  import UsersIcon from '@lucide/svelte/icons/users';
  import CalendarRangeIcon from '@lucide/svelte/icons/calendar-range';

  import { t } from '$lib/utils/functions/translations';
  import { classesApi } from '$features/classes/api/classes.svelte';
  import {
    classModeLabelKey,
    classStatusBadgeVariant,
    classStatusLabelKey,
    formatClassDate,
    formatClassPrice,
    seatLabel,
    seatPercent
  } from '$features/classes/utils/class-utils';
  import type { CourseClass } from '$features/classes/utils/types';
  import ClassModal from '$features/classes/components/class-modal.svelte';

  interface Props {
    courseId: string;
  }

  let { courseId }: Props = $props();

  let modalOpen = $state(false);
  let editingClass = $state<CourseClass | null>(null);

  let deleteDialogOpen = $state(false);
  let deleteCandidate = $state<CourseClass | null>(null);
  let isDeleting = $state(false);

  let loadedForCourse = $state<string | null>(null);

  $effect(() => {
    if (!courseId || loadedForCourse === courseId) return;

    loadedForCourse = courseId;
    void classesApi.list(courseId);
  });

  function openCreate() {
    editingClass = null;
    modalOpen = true;
  }

  function openEdit(courseClass: CourseClass) {
    editingClass = courseClass;
    modalOpen = true;
  }

  function openDelete(courseClass: CourseClass) {
    deleteCandidate = courseClass;
    deleteDialogOpen = true;
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;

    isDeleting = true;

    try {
      await classesApi.remove(courseId, deleteCandidate.id);
      deleteCandidate = null;
      deleteDialogOpen = false;
    } finally {
      isDeleting = false;
    }
  }

  /** The roster is loaded on demand; clicking the open class again closes it. */
  function toggleStudents(courseClass: CourseClass) {
    if (classesApi.studentsClassId === courseClass.id) {
      classesApi.studentsClassId = null;
      return;
    }

    void classesApi.loadStudents(courseId, courseClass.id);
  }
</script>

<div class="flex items-center justify-end pb-4">
  <Button onclick={openCreate}>
    <PlusIcon size={16} />
    {$t('classes.add')}
  </Button>
</div>

{#if classesApi.isLoading && classesApi.classes.length === 0}
  <div class="flex justify-center py-16">
    <Spinner class="size-10! text-blue-700!" />
  </div>
{:else if classesApi.classes.length > 0}
  <div class="w-full overflow-x-auto rounded-lg border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>{$t('classes.table.name')}</Table.Head>
          <Table.Head>{$t('classes.table.period')}</Table.Head>
          <Table.Head>{$t('classes.table.seats')}</Table.Head>
          <Table.Head>{$t('classes.table.price')}</Table.Head>
          <Table.Head>{$t('classes.table.status')}</Table.Head>
          <Table.Head class="text-right">{$t('classes.table.actions')}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each classesApi.classes as courseClass (courseClass.id)}
          <Table.Row>
            <Table.Cell>
              <div class="font-medium">{courseClass.name}</div>
              <div class="ui:text-muted-foreground text-xs">
                {$t(classModeLabelKey(courseClass.mode))}
                {#if courseClass.location}
                  · {courseClass.location}
                {/if}
                {#if courseClass.schedule}
                  · {courseClass.schedule}
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell>
              <div class="text-sm">
                {formatClassDate(courseClass.startsOn)} – {formatClassDate(courseClass.endsOn)}
              </div>
              {#if courseClass.enrollmentClosesAt}
                <div class="ui:text-muted-foreground text-xs">
                  {$t('classes.table.enrollment_until', {
                    date: formatClassDate(courseClass.enrollmentClosesAt)
                  })}
                </div>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <div class="text-sm font-medium">{seatLabel(courseClass)}</div>
              {#if courseClass.seats != null}
                <div class="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    class="h-full rounded-full {courseClass.isFull ? 'bg-red-500' : 'bg-blue-600'}"
                    style="width: {seatPercent(courseClass)}%"
                  ></div>
                </div>
              {/if}
            </Table.Cell>
            <Table.Cell>
              {#if courseClass.priceCents != null}
                {formatClassPrice(courseClass.priceCents)}
              {:else}
                <span class="ui:text-muted-foreground text-sm">{$t('classes.table.course_price')}</span>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <div class="flex flex-wrap items-center gap-1">
                <Badge variant={classStatusBadgeVariant(courseClass.status)}>
                  {$t(classStatusLabelKey(courseClass.status))}
                </Badge>
                {#if courseClass.isFull}
                  <Badge variant="destructive">{$t('classes.table.full')}</Badge>
                {:else if courseClass.status === 'open' && !courseClass.windowOpen}
                  <Badge variant="outline">{$t('classes.table.window_closed')}</Badge>
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell class="text-right">
              <div class="flex justify-end gap-1">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={$t('classes.students.title')}
                  onclick={() => toggleStudents(courseClass)}
                >
                  <UsersIcon size={16} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={$t('classes.edit')}
                  onclick={() => openEdit(courseClass)}
                >
                  <PencilIcon size={16} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={$t('classes.delete')}
                  class="text-red-500 hover:text-red-700"
                  onclick={() => openDelete(courseClass)}
                >
                  <Trash2Icon size={16} />
                </Button>
              </div>
            </Table.Cell>
          </Table.Row>

          {#if classesApi.studentsClassId === courseClass.id}
            <Table.Row>
              <Table.Cell colspan={6} class="bg-gray-50 dark:bg-gray-900/40">
                <h4 class="mb-2 text-sm font-semibold">
                  {$t('classes.students.title')} · {courseClass.name}
                </h4>
                {#if classesApi.students.length > 0}
                  <ul class="space-y-1">
                    {#each classesApi.students as student (student.id)}
                      <li class="flex items-center justify-between gap-4 text-sm">
                        <span>
                          {student.fullname ?? student.email}
                          <Badge variant={student.status === 'confirmed' ? 'success' : 'outline'} class="ml-2">
                            {$t(`classes.seat_status.${student.status}`)}
                          </Badge>
                        </span>
                        {#if student.status !== 'cancelled'}
                          <Button
                            variant="secondary"
                            size="sm"
                            onclick={() => classesApi.removeStudent(courseId, courseClass.id, student.profileId)}
                          >
                            {$t('classes.students.remove')}
                          </Button>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                {:else}
                  <p class="ui:text-muted-foreground text-sm">{$t('classes.students.empty')}</p>
                {/if}
              </Table.Cell>
            </Table.Row>
          {/if}
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{:else}
  <Empty
    title={$t('classes.empty.title')}
    description={$t('classes.empty.description')}
    icon={CalendarRangeIcon}
    variant="page"
  />
{/if}

<ClassModal bind:open={modalOpen} {courseId} courseClass={editingClass} onclose={() => (modalOpen = false)} />

<Dialog.Root bind:open={deleteDialogOpen}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>{$t('classes.delete_modal.title')}</Dialog.Title>
      <Dialog.Description>
        {$t('classes.delete_modal.description', { name: deleteCandidate?.name ?? '' })}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={() => (deleteDialogOpen = false)}>
        {$t('classes.form.cancel')}
      </Button>
      <Button variant="destructive" onclick={confirmDelete} loading={isDeleting} disabled={isDeleting}>
        {$t('classes.delete')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
