<script lang="ts">
  import * as Page from '@cio/ui/base/page';
  import { SigoPage } from '$features/sigo/pages';
  import { t } from '$lib/utils/functions/translations';
</script>

<svelte:head>
  <title>SIGO - MicAcademia</title>
</svelte:head>

<Page.Root class="mx-auto w-full max-w-6xl">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('sigo.title')}</Page.Title>
      <Page.Subtitle>{$t('sigo.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      <SigoPage />
    {/snippet}
  </Page.Body>
</Page.Root>
