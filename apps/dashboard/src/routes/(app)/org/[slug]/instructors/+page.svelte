<script lang="ts">
  import * as Page from '@cio/ui/base/page';
  import { InstructorsPage } from '$features/instructor/pages';
  import { t } from '$lib/utils/functions/translations';
</script>

<svelte:head>
  <title>Instructors - MicAcademia</title>
</svelte:head>

<Page.Root class="mx-auto w-full max-w-6xl">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>{$t('instructor.title')}</Page.Title>
      <Page.Subtitle>{$t('instructor.subtitle')}</Page.Subtitle>
    </Page.HeaderContent>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      <InstructorsPage />
    {/snippet}
  </Page.Body>
</Page.Root>
