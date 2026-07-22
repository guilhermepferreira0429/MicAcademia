<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Room, RoomEvent, Track } from 'livekit-client';
  import type { LocalTrackPublication, Participant, RemoteTrack, RemoteTrackPublication } from 'livekit-client';

  import { Button } from '@cio/ui/base/button';
  import MicIcon from '@lucide/svelte/icons/mic';
  import MicOffIcon from '@lucide/svelte/icons/mic-off';
  import VideoIcon from '@lucide/svelte/icons/video';
  import VideoOffIcon from '@lucide/svelte/icons/video-off';
  import PhoneOffIcon from '@lucide/svelte/icons/phone-off';

  import { t } from '$lib/utils/functions/translations';
  import { liveSessionApi } from '../api/live-session.svelte';

  interface Props {
    courseId: string;
    lessonId: string;
  }

  let { courseId, lessonId }: Props = $props();

  type Tile = { identity: string; name: string; isLocal: boolean };

  let status = $state<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  let errorMessage = $state('');
  let tiles = $state<Tile[]>([]);
  let micEnabled = $state(true);
  let camEnabled = $state(true);

  // Plain (non-reactive) handles — these are external objects, not UI state.
  let room: Room | null = null;
  const containers = new Map<string, HTMLElement>();
  const pending = new Map<string, Track[]>();

  function addTile(identity: string, name: string, isLocal: boolean) {
    if (tiles.some((tile) => tile.identity === identity)) return;

    tiles = [...tiles, { identity, name: name || identity, isLocal }];
  }

  function removeTile(identity: string) {
    tiles = tiles.filter((tile) => tile.identity !== identity);
    containers.delete(identity);
    pending.delete(identity);
  }

  function attachTrack(track: Track, identity: string, isLocal: boolean) {
    const container = containers.get(identity);
    if (!container) {
      pending.set(identity, [...(pending.get(identity) ?? []), track]);
      return;
    }

    const element = track.attach();
    // Never play your own audio back — that's an echo loop.
    if (isLocal) element.muted = true;
    if (track.kind === Track.Kind.Video) {
      element.classList.add('h-full', 'w-full', 'object-cover');
    }
    container.appendChild(element);
  }

  /** Svelte action: binds a tile's container and flushes any tracks that arrived first. */
  function tileContainer(node: HTMLElement, identity: string) {
    containers.set(identity, node);

    const queued = pending.get(identity);
    if (queued?.length) {
      pending.delete(identity);
      const isLocal = tiles.find((tile) => tile.identity === identity)?.isLocal ?? false;
      for (const track of queued) attachTrack(track, identity, isLocal);
    }

    return {
      destroy() {
        containers.delete(identity);
      }
    };
  }

  async function join() {
    status = 'connecting';
    errorMessage = '';

    const session = await liveSessionApi.getToken(courseId, lessonId);
    if (!session) {
      errorMessage = $t('live_session.error_token');
      status = 'error';
      return;
    }

    const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
    room = nextRoom;

    nextRoom
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: Participant) => {
        attachTrack(track, participant.identity, false);
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((element) => element.remove());
      })
      .on(RoomEvent.LocalTrackPublished, (publication: LocalTrackPublication) => {
        if (publication.track) attachTrack(publication.track, nextRoom.localParticipant.identity, true);
      })
      .on(RoomEvent.ParticipantConnected, (participant: Participant) => {
        addTile(participant.identity, participant.name ?? '', false);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
        removeTile(participant.identity);
      })
      .on(RoomEvent.Disconnected, () => {
        status = 'idle';
        tiles = [];
      });

    try {
      await nextRoom.connect(session.url, session.token);

      addTile(nextRoom.localParticipant.identity, $t('live_session.you'), true);
      for (const participant of nextRoom.remoteParticipants.values()) {
        addTile(participant.identity, participant.name ?? '', false);
      }

      await nextRoom.localParticipant.enableCameraAndMicrophone();
      micEnabled = true;
      camEnabled = true;
      status = 'connected';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : $t('live_session.error_connect');
      status = 'error';
      room = null;
    }
  }

  async function leave() {
    await room?.disconnect();
    room = null;
    tiles = [];
    status = 'idle';
  }

  async function toggleMic() {
    if (!room) return;

    micEnabled = !micEnabled;
    await room.localParticipant.setMicrophoneEnabled(micEnabled);
  }

  async function toggleCam() {
    if (!room) return;

    camEnabled = !camEnabled;
    await room.localParticipant.setCameraEnabled(camEnabled);
  }

  onDestroy(() => {
    void room?.disconnect();
    room = null;
  });
</script>

<div class="flex w-full flex-col gap-4">
  {#if status === 'idle'}
    <div class="flex flex-col items-center gap-3 py-10">
      <p class="ui:text-muted-foreground text-sm">{$t('live_session.not_joined')}</p>
      <Button onclick={join}>{$t('live_session.join')}</Button>
    </div>
  {:else if status === 'connecting'}
    <p class="ui:text-muted-foreground py-10 text-center text-sm">{$t('live_session.connecting')}</p>
  {:else if status === 'error'}
    <div class="flex flex-col items-center gap-3 py-10">
      <p class="text-sm text-red-500">{errorMessage || $t('live_session.error_connect')}</p>
      <Button variant="secondary" onclick={join}>{$t('live_session.retry')}</Button>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each tiles as tile (tile.identity)}
        <div class="relative aspect-video overflow-hidden rounded-lg bg-black">
          <div class="h-full w-full" use:tileContainer={tile.identity}></div>
          <span class="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
            {tile.name}
          </span>
        </div>
      {/each}
    </div>

    <div class="flex items-center justify-center gap-2">
      <Button variant="secondary" size="icon" aria-label={$t('live_session.toggle_mic')} onclick={toggleMic}>
        {#if micEnabled}<MicIcon size={16} />{:else}<MicOffIcon size={16} />{/if}
      </Button>
      <Button variant="secondary" size="icon" aria-label={$t('live_session.toggle_camera')} onclick={toggleCam}>
        {#if camEnabled}<VideoIcon size={16} />{:else}<VideoOffIcon size={16} />{/if}
      </Button>
      <Button variant="destructive" onclick={leave}>
        <PhoneOffIcon size={16} />
        {$t('live_session.leave')}
      </Button>
    </div>
  {/if}
</div>
