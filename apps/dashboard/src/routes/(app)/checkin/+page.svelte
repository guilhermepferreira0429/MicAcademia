<script lang="ts">
  import { onMount } from 'svelte';

  import * as Card from '@cio/ui/base/card';
  import { Button } from '@cio/ui/base/button';
  import { Spinner } from '@cio/ui/base/spinner';
  import CheckCircleIcon from '@lucide/svelte/icons/circle-check-big';
  import LogOutIcon from '@lucide/svelte/icons/log-out';
  import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';

  import { page } from '$app/state';
  import { t } from '$lib/utils/functions/translations';
  import { attendanceApi } from '$features/attendance/api/attendance.svelte';
  import type { CheckinResult } from '$features/attendance/utils/types';

  type Status = 'idle' | 'loading' | 'checked_in' | 'checked_out' | 'error';

  let status = $state<Status>('idle');
  let result = $state<CheckinResult | null>(null);
  let errorKey = $state('attendance.checkin.error_generic');

  const courseId = $derived(page.url.searchParams.get('c') ?? '');
  const token = $derived(page.url.searchParams.get('token') ?? '');

  const durationLabel = $derived.by(() => {
    const seconds = result?.durationSeconds;
    if (typeof seconds !== 'number') return '';

    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  });

  async function submit() {
    if (!courseId || !token) {
      status = 'error';
      errorKey = 'attendance.checkin.error_invalid';
      return;
    }

    status = 'loading';
    result = null;
    errorKey = 'attendance.checkin.error_generic';

    const response = await attendanceApi.checkin(courseId, token);

    if (!response) {
      status = 'error';
      errorKey = attendanceApi.error?.toLowerCase().includes('expire')
        ? 'attendance.checkin.error_expired'
        : 'attendance.checkin.error_invalid';
      return;
    }

    result = response;
    status = response.action === 'checked_out' ? 'checked_out' : 'checked_in';
  }

  onMount(() => {
    void submit();
  });
</script>

<div class="flex min-h-[70vh] items-center justify-center p-4">
  <Card.Root class="w-full max-w-md">
    <Card.Header>
      <Card.Title>{$t('attendance.checkin.title')}</Card.Title>
      <Card.Description>{$t('attendance.checkin.description')}</Card.Description>
    </Card.Header>
    <Card.Content>
      {#if status === 'idle' || status === 'loading'}
        <div class="flex flex-col items-center gap-3 py-6">
          <Spinner class="size-8!" />
          <p class="ui:text-muted-foreground text-sm">{$t('attendance.checkin.working')}</p>
        </div>
      {:else if status === 'checked_in'}
        <div class="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircleIcon size={40} class="text-emerald-600" />
          <p class="text-lg font-semibold">{$t('attendance.checkin.checked_in')}</p>
          <p class="ui:text-muted-foreground text-sm">{$t('attendance.checkin.checked_in_hint')}</p>
        </div>
      {:else if status === 'checked_out'}
        <div class="flex flex-col items-center gap-3 py-6 text-center">
          <LogOutIcon size={40} class="text-blue-600" />
          <p class="text-lg font-semibold">{$t('attendance.checkin.checked_out')}</p>
          {#if durationLabel}
            <p class="text-sm">{$t('attendance.checkin.duration', { duration: durationLabel })}</p>
          {/if}
        </div>
      {:else}
        <div class="flex flex-col items-center gap-3 py-6 text-center">
          <AlertTriangleIcon size={40} class="text-amber-600" />
          <p class="text-lg font-semibold">{$t(errorKey)}</p>
          <p class="ui:text-muted-foreground text-sm">{$t('attendance.checkin.error_hint')}</p>
        </div>
      {/if}
    </Card.Content>
    {#if status === 'error'}
      <Card.Footer class="justify-center">
        <Button onclick={submit} loading={attendanceApi.isLoading}>{$t('attendance.checkin.retry')}</Button>
      </Card.Footer>
    {/if}
  </Card.Root>
</div>
