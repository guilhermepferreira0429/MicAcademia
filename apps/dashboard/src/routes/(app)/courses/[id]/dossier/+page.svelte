<script lang="ts">
  import * as Page from '@cio/ui/base/page';

  import { DossierPage } from '$features/dossier/pages';
  import { dossierApi } from '$features/dossier/api/dossier.svelte';
  import { RefreshPageData } from '$features/ui';
  import { t } from '$lib/utils/functions/translations';

  let { data } = $props();

  async function refreshDossier() {
    await dossierApi.load(data.courseId);
  }
</script>

<Page.Root class="mx-auto flex md:max-w-5xl print:max-w-none">
  <Page.Header class="print:hidden">
    <Page.HeaderContent>
      <Page.Title>
        {$t('course.navItems.nav_dossier')}
      </Page.Title>
    </Page.HeaderContent>
    <Page.Action>
      <RefreshPageData onRefresh={refreshDossier} />
    </Page.Action>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      <DossierPage courseId={data.courseId} />
    {/snippet}
  </Page.Body>
</Page.Root>

<style>
  /* The printed dossier is the document an auditor keeps, so the app chrome
     (sidebars, top bars) must not end up on the paper. */
  @media print {
    :global([data-slot='sidebar']),
    :global([data-slot='sidebar-container']),
    :global([data-slot='sidebar-gap']),
    :global([data-sidebar-trigger]) {
      display: none !important;
    }

    :global(body),
    :global([data-slot='sidebar-inset']) {
      background: #fff !important;
    }
  }
</style>
