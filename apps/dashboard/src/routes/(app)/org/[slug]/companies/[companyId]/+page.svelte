<script lang="ts">
  import * as Page from '@cio/ui/base/page';
  import { page } from '$app/state';
  import { CompanyDetailPage } from '$features/company/pages';
  import { t } from '$lib/utils/functions/translations';

  const companyId = $derived(page.params.companyId as string);
</script>

<svelte:head>
  <title>Companies - MicAcademia</title>
</svelte:head>

<Page.Root class="mx-auto w-full max-w-6xl">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('company.detail.title')}</Page.Title>
      <Page.Subtitle>{$t('company.detail.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      <CompanyDetailPage {companyId} />
    {/snippet}
  </Page.Body>
</Page.Root>
