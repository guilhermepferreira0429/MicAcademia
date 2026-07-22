<script lang="ts">
  import { onDestroy } from 'svelte';
  import QRCode from 'qrcode';

  import { browser } from '$app/environment';
  import * as Card from '@cio/ui/base/card';
  import { Button } from '@cio/ui/base/button';
  import { CopyButton } from '@cio/ui/base/copy-button';
  import QrCodeIcon from '@lucide/svelte/icons/qr-code';

  import { t } from '$lib/utils/functions/translations';
  import { attendanceApi } from '$features/attendance/api/attendance.svelte';

  interface Props {
    courseId: string;
    lessonId: string;
  }

  let { courseId, lessonId }: Props = $props();

  /** Refresh this long before the token expires so a scan is never a dead code. */
  const REFRESH_LEAD_MS = 60_000;

  let token = $state('');
  let expiresAt = $state('');
  let isActive = $state(false);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  const checkinUrl = $derived(
    browser && token
      ? `${window.location.origin}/checkin?c=${encodeURIComponent(courseId)}&token=${encodeURIComponent(token)}`
      : ''
  );

  const expiresAtLabel = $derived.by(() => {
    if (!expiresAt) return '';

    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
  });

  // Keeps the rendered canvas in sync with whatever token is currently live.
  $effect(() => {
    const url = checkinUrl;
    const element = canvas;

    if (!element || !url) return;

    void QRCode.toCanvas(element, url, { width: 220, margin: 1 });
  });

  function clearRefreshTimer() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = undefined;
    }
  }

  function scheduleRefresh(expiry: string) {
    clearRefreshTimer();

    const expiryMs = new Date(expiry).getTime();
    if (Number.isNaN(expiryMs)) return;

    const delay = Math.max(5_000, expiryMs - Date.now() - REFRESH_LEAD_MS);
    refreshTimer = setTimeout(() => {
      void requestCode();
    }, delay);
  }

  async function requestCode() {
    const code = await attendanceApi.createCheckinCode(courseId, lessonId);
    if (!code) {
      clearRefreshTimer();
      return;
    }

    token = code.token;
    expiresAt = code.expiresAt;
    isActive = true;
    scheduleRefresh(code.expiresAt);
  }

  function start() {
    token = '';
    expiresAt = '';
    void requestCode();
  }

  function stop() {
    clearRefreshTimer();
    token = '';
    expiresAt = '';
    isActive = false;
  }

  onDestroy(clearRefreshTimer);
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2 text-base">
      <QrCodeIcon size={18} />
      {$t('attendance.qr.title')}
    </Card.Title>
    <Card.Description>{$t('attendance.qr.description')}</Card.Description>
    <Card.Action>
      {#if isActive}
        <Button variant="outline" onclick={stop}>{$t('attendance.qr.stop')}</Button>
      {:else}
        <Button onclick={start} loading={attendanceApi.isLoading}>{$t('attendance.qr.start')}</Button>
      {/if}
    </Card.Action>
  </Card.Header>

  {#if isActive}
    <Card.Content>
      <div class="flex flex-col items-center gap-3">
        {#if checkinUrl}
          <canvas bind:this={canvas} aria-label={$t('attendance.qr.scan_to_check_in')} class="rounded-md bg-white p-2"
          ></canvas>
        {/if}

        <p class="text-sm font-medium">{$t('attendance.qr.scan_to_check_in')}</p>

        {#if expiresAtLabel}
          <p class="ui:text-muted-foreground text-xs">
            {$t('attendance.qr.expires_at', { time: expiresAtLabel })}
          </p>
        {/if}

        <div class="flex w-full max-w-full items-center justify-center gap-2">
          <span class="ui:text-muted-foreground truncate text-xs" title={checkinUrl}>{checkinUrl}</span>
          <CopyButton text={checkinUrl} variant="secondary" />
        </div>
        <p class="ui:text-muted-foreground text-center text-xs">{$t('attendance.qr.link_fallback')}</p>
      </div>
    </Card.Content>
  {/if}
</Card.Root>
