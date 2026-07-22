<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';

  import * as Card from '@cio/ui/base/card';
  import * as Field from '@cio/ui/base/field';
  import { Input } from '@cio/ui/base/input';
  import { Button } from '@cio/ui/base/button';
  import { Empty } from '@cio/ui/custom/empty';
  import { Search } from '@cio/ui/custom/search';
  import CheckIcon from '@lucide/svelte/icons/check';
  import UserXIcon from '@lucide/svelte/icons/user-x';

  import { ROLE } from '@cio/utils/constants';
  import { t } from '$lib/utils/functions/translations';
  import { courseApi } from '$features/course/api';
  import { attendanceApi } from '$features/attendance/api/attendance.svelte';

  interface Props {
    courseId: string;
    lessonId: string;
  }

  let { courseId, lessonId }: Props = $props();

  let searchValue = $state('');
  let minutes = $state<string | number>('');
  let markedProfileIds = new SvelteSet<string>();
  let markingProfileId = $state<string | null>(null);

  const students = $derived(
    courseApi.group.people.filter((person) => !!person.profile && Number(person.roleId) === ROLE.STUDENT)
  );

  const filteredStudents = $derived(
    students.filter((student) => (student.profile?.fullname ?? '').toLowerCase().includes(searchValue.toLowerCase()))
  );

  async function markPresent(profileId: string) {
    markingProfileId = profileId;

    const rawMinutes = String(minutes ?? '').trim();
    const parsedMinutes = Number(rawMinutes);
    const result = await attendanceApi.markManual(
      courseId,
      lessonId,
      profileId,
      rawMinutes !== '' && Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : undefined
    );

    markingProfileId = null;

    if (result) {
      markedProfileIds.add(profileId);
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="text-base">{$t('attendance.manual.title')}</Card.Title>
    <Card.Description>{$t('attendance.manual.description')}</Card.Description>
  </Card.Header>
  <Card.Content>
    <div class="flex flex-wrap items-end justify-between gap-3 pb-3">
      <Field.Field>
        <Field.Label for="attendance-manual-minutes">{$t('attendance.manual.minutes')}</Field.Label>
        <Input
          id="attendance-manual-minutes"
          type="number"
          min="1"
          placeholder={$t('attendance.manual.minutes_placeholder')}
          bind:value={minutes}
        />
      </Field.Field>
      <Search placeholder={$t('attendance.manual.search_students')} bind:value={searchValue} />
    </div>

    {#if filteredStudents.length === 0}
      <Empty title={$t('attendance.manual.no_students')} icon={UserXIcon} />
    {:else}
      <ul class="divide-y rounded-md border">
        {#each filteredStudents as student (student.id)}
          {@const profileId = student.profile?.id ?? student.profileId}
          <li class="flex items-center justify-between gap-3 px-3 py-2">
            <span class="truncate text-sm">{student.profile?.fullname}</span>
            {#if profileId && markedProfileIds.has(profileId)}
              <span class="ui:text-muted-foreground flex items-center gap-1 text-xs">
                <CheckIcon size={14} />
                {$t('attendance.manual.marked')}
              </span>
            {:else}
              <Button
                variant="outline"
                size="sm"
                disabled={!profileId || markingProfileId === profileId}
                loading={markingProfileId === profileId}
                onclick={() => profileId && markPresent(profileId)}
              >
                {$t('attendance.manual.mark_present')}
              </Button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Card.Content>
</Card.Root>
