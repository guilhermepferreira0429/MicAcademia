<script lang="ts">
  import { Button } from '@cio/ui/base/button';
  import { Input } from '@cio/ui/base/input';
  import * as Field from '@cio/ui/base/field';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import Trash2Icon from '@lucide/svelte/icons/trash-2';

  import { t } from '$lib/utils/functions/translations';
  import { courseApi } from '$features/course/api';

  type Share = { label: string; percent: number; instructorId?: string };

  type Props = {
    /** Called whenever the shares change so the parent can flag unsaved changes. */
    onchange?: () => void;
  };

  let { onchange }: Props = $props();

  /** Default house split, used to seed the editor when a course has no config yet. */
  const DEFAULT_SHARES: Share[] = [
    { label: 'Nautis', percent: 50 },
    { label: 'Microlopes', percent: 50 }
  ];

  // When the course has no saved config, present the default split. It is only
  // persisted once the admin actually edits a row (keeping untouched courses clean).
  const shares = $derived<Share[]>(
    courseApi.course?.revenueShare?.shares?.length ? courseApi.course.revenueShare.shares : DEFAULT_SHARES
  );

  const total = $derived(shares.reduce((sum, share) => sum + (Number(share.percent) || 0), 0));
  const isBalanced = $derived(shares.length === 0 || Math.round(total) === 100);

  function commit(next: Share[]) {
    if (!courseApi.course) return;

    courseApi.course.revenueShare = { shares: next };
    onchange?.();
  }

  function addBeneficiary() {
    commit([...shares.map((share) => ({ ...share })), { label: '', percent: 0 }]);
  }

  function removeBeneficiary(index: number) {
    commit(shares.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateLabel(index: number, value: string) {
    commit(shares.map((share, currentIndex) => (currentIndex === index ? { ...share, label: value } : share)));
  }

  function updatePercent(index: number, value: string) {
    const parsed = Number(value);
    const percent = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
    commit(shares.map((share, currentIndex) => (currentIndex === index ? { ...share, percent } : share)));
  }
</script>

<Field.Set>
  <Field.Legend>{$t('revenue_share.editor.legend')}</Field.Legend>
  <Field.Description>{$t('revenue_share.editor.description')}</Field.Description>

  <Field.Group>
    {#each shares as share, index (index)}
      <div class="flex items-end gap-2">
        <Field.Field class="flex-1">
          <Field.Label for={`revenue-share-label-${index}`}>{$t('revenue_share.editor.label')}</Field.Label>
          <Input
            id={`revenue-share-label-${index}`}
            class="w-full"
            placeholder={$t('revenue_share.editor.label_placeholder')}
            value={share.label}
            oninput={(event) => updateLabel(index, (event.currentTarget as HTMLInputElement).value)}
          />
        </Field.Field>

        <Field.Field class="w-28">
          <Field.Label for={`revenue-share-percent-${index}`}>{$t('revenue_share.editor.percent')}</Field.Label>
          <Input
            id={`revenue-share-percent-${index}`}
            type="number"
            min={0}
            max={100}
            class="w-full"
            value={String(share.percent)}
            oninput={(event) => updatePercent(index, (event.currentTarget as HTMLInputElement).value)}
          />
        </Field.Field>

        <Button
          variant="secondary"
          size="icon"
          class="mb-1 text-red-500 hover:text-red-700"
          aria-label={$t('revenue_share.editor.remove')}
          onclick={() => removeBeneficiary(index)}
        >
          <Trash2Icon size={16} />
        </Button>
      </div>
    {/each}
  </Field.Group>

  <div class="flex items-center justify-between pt-1">
    <Button variant="outline" size="sm" onclick={addBeneficiary}>
      <PlusIcon size={16} />
      {$t('revenue_share.editor.add')}
    </Button>

    <div class="text-sm">
      <span class="ui:text-muted-foreground">{$t('revenue_share.editor.total')}:</span>
      <span class={isBalanced ? 'font-medium' : 'font-medium text-red-500'}>{total}%</span>
    </div>
  </div>

  {#if !isBalanced}
    <Field.Error>{$t('revenue_share.editor.sum_warning')}</Field.Error>
  {/if}
</Field.Set>
