<script lang="ts">
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import CircleIcon from '@lucide/svelte/icons/circle';
  import SquareIcon from '@lucide/svelte/icons/square';
  import PlayIcon from '@lucide/svelte/icons/play';
  import UploadIcon from '@lucide/svelte/icons/upload';

  import { t } from '$lib/utils/functions/translations';
  import { recordingsApi } from '../api/recordings.svelte';

  interface Props {
    courseId: string;
    lessonId: string;
  }

  let { courseId, lessonId }: Props = $props();

  let loadedFor = $state<string | null>(null);

  $effect(() => {
    if (!courseId || !lessonId || loadedFor === lessonId) return;

    loadedFor = lessonId;
    void recordingsApi.list(courseId, lessonId);
  });

  const recordings = $derived(recordingsApi.recordings);
  const active = $derived(recordings.find((recording) => recording.status === 'active') ?? null);

  function statusVariant(status: string) {
    if (status === 'complete') return 'success' as const;
    if (status === 'active') return 'destructive' as const;
    if (status === 'failed' || status === 'aborted') return 'outline' as const;

    return 'secondary' as const;
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return '—';

    const minutes = Math.floor(seconds / 60);

    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
  }

  function formatDate(value: string | null) {
    if (!value) return '—';

    return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  }
</script>

<section class="rounded-lg border p-4">
  <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
    <div>
      <h3 class="text-sm font-semibold">{$t('live_session.recordings.title')}</h3>
      <p class="ui:text-muted-foreground text-xs">{$t('live_session.recordings.description')}</p>
    </div>

    {#if recordingsApi.isConfigured}
      {#if active}
        <Button variant="secondary" size="sm" onclick={() => recordingsApi.stop(courseId, lessonId)}>
          <SquareIcon size={14} />
          {$t('live_session.recordings.stop')}
        </Button>
      {:else}
        <Button variant="secondary" size="sm" onclick={() => recordingsApi.start(courseId, lessonId)}>
          <CircleIcon size={14} class="text-red-500" />
          {$t('live_session.recordings.start')}
        </Button>
      {/if}
    {/if}
  </div>

  {#if !recordingsApi.isConfigured}
    <p class="ui:text-muted-foreground text-sm">{$t('live_session.recordings.not_configured')}</p>
  {:else if recordings.length === 0}
    <p class="ui:text-muted-foreground text-sm">{$t('live_session.recordings.empty')}</p>
  {:else}
    <ul class="divide-y">
      {#each recordings as recording (recording.id)}
        <li class="flex flex-wrap items-center justify-between gap-3 py-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <Badge variant={statusVariant(recording.status)}>
                {$t(`live_session.recordings.status.${recording.status}`)}
              </Badge>
              {#if recording.publishedAt}
                <Badge variant="outline">{$t('live_session.recordings.published')}</Badge>
              {/if}
            </div>
            <div class="ui:text-muted-foreground mt-1 text-xs">
              {formatDate(recording.startedAt)} · {formatDuration(recording.durationSeconds)}
            </div>
            {#if recording.error}
              <div class="mt-1 text-xs text-red-600">{recording.error}</div>
            {/if}
          </div>

          <div class="flex items-center gap-1">
            {#if recording.playbackUrl}
              <Button
                variant="secondary"
                size="icon"
                aria-label={$t('live_session.recordings.watch')}
                href={recording.playbackUrl}
                target="_blank"
              >
                <PlayIcon size={16} />
              </Button>
            {/if}
            {#if recording.status === 'complete' && !recording.publishedAt}
              <Button
                variant="secondary"
                size="icon"
                aria-label={$t('live_session.recordings.publish')}
                onclick={() => recordingsApi.publish(courseId, lessonId, recording.id)}
              >
                <UploadIcon size={16} />
              </Button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
