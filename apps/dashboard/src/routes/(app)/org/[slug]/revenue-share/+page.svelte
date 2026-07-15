<script lang="ts">
  import * as Page from '@cio/ui/base/page';
  import { RevenueSharePage } from '$features/revenue/pages';
  import { t } from '$lib/utils/functions/translations';
</script>

<svelte:head>
  <title>Revenue share - MicAcademia</title>
</svelte:head>

<Page.Root class="mx-auto w-full max-w-6xl">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('revenue_share.title')}</Page.Title>
      <Page.Subtitle>{$t('revenue_share.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      <RevenueSharePage />
    {/snippet}
  </Page.Body>
</Page.Root>
