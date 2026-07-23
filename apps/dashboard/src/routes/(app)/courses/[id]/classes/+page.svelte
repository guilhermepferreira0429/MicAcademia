<script lang="ts">
  import * as Page from '@cio/ui/base/page';

  import { ClassesPage } from '$features/classes/pages';
  import { classesApi } from '$features/classes/api/classes.svelte';
  import { RefreshPageData } from '$features/ui';
  import { t } from '$lib/utils/functions/translations';

  let { data } = $props();

  async function refreshClasses() {
    await classesApi.list(data.courseId);
  }
</script>

<Page.Root>
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>
        {$t('course.navItems.nav_classes')}
      </Page.Title>
    </Page.HeaderContent>
    <Page.Action>
      <RefreshPageData onRefresh={refreshClasses} />
    </Page.Action>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      <ClassesPage courseId={data.courseId} />
    {/snippet}
  </Page.Body>
</Page.Root>
