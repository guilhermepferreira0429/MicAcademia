<script lang="ts">
  import { AttendancePage } from '$features/course/pages';
  import { AttendanceReportPage } from '$features/attendance/pages';
  import { courseApi } from '$features/course/api';
  import { attendanceApi } from '$features/attendance/api/attendance.svelte';
  import { RefreshPageData } from '$features/ui';
  import * as Page from '@cio/ui/base/page';
  import * as UnderlineTabs from '@cio/ui/custom/underline-tabs';
  import { t } from '$lib/utils/functions/translations';
  import { profile } from '$lib/utils/store/user';
  import { isOrgStudent } from '$lib/utils/store/app';

  let { data } = $props();

  let currentTab = $state('checklist');

  async function refreshAttendance() {
    await courseApi.refreshCourse(data.courseId, $profile.id);

    if (!$isOrgStudent) {
      await attendanceApi.loadSummary(data.courseId);
    }
  }
</script>

<Page.Root class="mx-auto flex md:max-w-3xl lg:max-w-4xl">
  <Page.Header>
    <Page.HeaderContent>
      <Page.Title>
        {$t('course.navItem.attendance.title')}
      </Page.Title>
    </Page.HeaderContent>
    <Page.Action>
      <RefreshPageData onRefresh={refreshAttendance} />
    </Page.Action>
  </Page.Header>
  <Page.Body>
    {#snippet child()}
      {#if $isOrgStudent}
        <AttendancePage courseId={data.courseId} />
      {:else}
        <UnderlineTabs.Root bind:value={currentTab}>
          <UnderlineTabs.List>
            <UnderlineTabs.Trigger value="checklist">
              {$t('attendance.tabs.checklist')}
            </UnderlineTabs.Trigger>
            <UnderlineTabs.Trigger value="record">
              {$t('attendance.tabs.record')}
            </UnderlineTabs.Trigger>
          </UnderlineTabs.List>

          <UnderlineTabs.Content value="checklist" class="mt-4">
            <AttendancePage courseId={data.courseId} />
          </UnderlineTabs.Content>

          <UnderlineTabs.Content value="record" class="mt-4">
            <AttendanceReportPage courseId={data.courseId} />
          </UnderlineTabs.Content>
        </UnderlineTabs.Root>
      {/if}
    {/snippet}
  </Page.Body>
</Page.Root>
