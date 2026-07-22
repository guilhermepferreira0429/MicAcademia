<script lang="ts">
  import * as Page from '@cio/ui/base/page';
  import { CompaniesPage } from '$features/company/pages';
  import { t } from '$lib/utils/functions/translations';
</script>

<svelte:head>
  <title>Companies - MicAcademia</title>
</svelte:head>

<Page.Root class="mx-auto w-full max-w-6xl">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('company.title')}</Page.Title>
      <Page.Subtitle>{$t('company.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      <CompaniesPage />
    {/snippet}
  </Page.Body>
</Page.Root>
