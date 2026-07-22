<script lang="ts">
  import * as Table from '@cio/ui/base/table';
  import { Badge } from '@cio/ui/base/badge';
  import { Button } from '@cio/ui/base/button';
  import { Spinner } from '@cio/ui/base/spinner';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import PrinterIcon from '@lucide/svelte/icons/printer';
  import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';

  import { t } from '$lib/utils/functions/translations';
  import { dossierApi } from '$features/dossier/api/dossier.svelte';
  import {
    attendancePercent,
    downloadDossierCsv,
    formatDossierDate,
    formatDossierHours,
    gapMessageKey,
    gapMessageParams,
    toDossierDecimalHours,
    trainerStatusBadgeVariant,
    trainerStatusLabelKey
  } from '$features/dossier/utils/dossier-utils';

  interface Props {
    courseId: string;
  }

  let { courseId }: Props = $props();

  let loadedForCourse = $state<string | null>(null);

  $effect(() => {
    if (!courseId || loadedForCourse === courseId) return;

    loadedForCourse = courseId;
    void dossierApi.load(courseId);
  });

  const dossier = $derived(dossierApi.dossier?.action.courseId === courseId ? dossierApi.dossier : null);
  const gaps = $derived(dossier?.gaps ?? []);

  /** The whole action in seconds, used as the denominator of each attendance rate. */
  const totalSessionSeconds = $derived(
    dossier?.sessions.reduce((total, session) => total + session.sessionSeconds, 0) ?? 0
  );

  function printDossier() {
    window.print();
  }

  function exportAttendanceCsv() {
    if (!dossier) return;

    const rows: string[][] = [
      [
        t.get('dossier.attendance.student'),
        t.get('dossier.attendance.nif'),
        t.get('dossier.attendance.hours'),
        t.get('dossier.attendance.percent'),
        t.get('dossier.attendance.certificate')
      ]
    ];

    for (const student of dossier.students) {
      rows.push([
        student.fullname ?? '',
        student.nif ?? '',
        toDossierDecimalHours(student.attendedSeconds),
        String(attendancePercent(student.attendedSeconds, totalSessionSeconds)),
        student.certificateEarnedAt ? formatDossierDate(student.certificateEarnedAt, '') : ''
      ]);
    }

    downloadDossierCsv(`dossier-${courseId}-attendance.csv`, rows);
  }
</script>

{#if dossierApi.isLoading && !dossier}
  <div class="flex justify-center py-16">
    <Spinner class="size-10! text-blue-700!" />
  </div>
{:else if dossier}
  <div class="flex flex-wrap items-center justify-end gap-2 pb-4 print:hidden">
    <Button variant="outline" onclick={exportAttendanceCsv}>
      <DownloadIcon size={16} />
      {$t('dossier.export_csv')}
    </Button>
    <Button onclick={printDossier}>
      <PrinterIcon size={16} />
      {$t('dossier.print')}
    </Button>
  </div>

  {#if gaps.length > 0}
    <section
      class="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20 print:hidden"
    >
      <div class="flex items-center gap-2 text-amber-900 dark:text-amber-100">
        <TriangleAlertIcon size={18} />
        <h3 class="text-sm font-semibold">{$t('dossier.gaps.title', { count: gaps.length })}</h3>
      </div>
      <p class="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">{$t('dossier.gaps.description')}</p>
      <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
        {#each gaps as gap, index (`${gap.code}-${gap.subject ?? ''}-${index}`)}
          <li>{$t(gapMessageKey(gap), gapMessageParams(gap))}</li>
        {/each}
      </ul>
    </section>
  {/if}

  <article class="space-y-8 print:space-y-6 print:text-black">
    <header class="border-b pb-4">
      <p class="ui:text-muted-foreground text-xs tracking-wide uppercase">{$t('dossier.document_title')}</p>
      <h1 class="mt-1 text-2xl font-semibold">{dossier.action.title}</h1>
      <p class="ui:text-muted-foreground mt-1 text-sm">
        {dossier.organizationName} · {$t('dossier.generated_at', {
          date: formatDossierDate(dossier.generatedAt)
        })}
      </p>
    </header>

    <section class="print:break-inside-avoid">
      <h2 class="mb-3 text-lg font-semibold">{$t('dossier.action.title')}</h2>
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="ui:text-muted-foreground text-xs">{$t('dossier.action.entity')}</dt>
          <dd class="font-medium">{dossier.action.trainingEntity ?? '—'}</dd>
        </div>
        <div>
          <dt class="ui:text-muted-foreground text-xs">{$t('dossier.action.action')}</dt>
          <dd class="font-medium">{dossier.action.trainingAction ?? '—'}</dd>
        </div>
        <div>
          <dt class="ui:text-muted-foreground text-xs">{$t('dossier.action.ufcd')}</dt>
          <dd class="font-medium">{dossier.action.ufcdCode ?? '—'}</dd>
        </div>
        <div>
          <dt class="ui:text-muted-foreground text-xs">{$t('dossier.action.total_hours')}</dt>
          <dd class="font-medium">
            {#if dossier.action.totalHours}
              {$t('dossier.action.hours_value', { hours: dossier.action.totalHours })}
            {:else}
              —
            {/if}
          </dd>
        </div>
        <div>
          <dt class="ui:text-muted-foreground text-xs">{$t('dossier.action.period')}</dt>
          <dd class="font-medium">
            {formatDossierDate(dossier.action.startDate)} — {formatDossierDate(dossier.action.endDate)}
          </dd>
        </div>
        <div>
          <dt class="ui:text-muted-foreground text-xs">{$t('dossier.action.organization')}</dt>
          <dd class="font-medium">{dossier.organizationName || '—'}</dd>
        </div>
      </dl>

      {#if dossier.action.description}
        <p class="ui:text-muted-foreground mt-3 text-sm">{dossier.action.description}</p>
      {/if}
    </section>

    <section class="print:break-inside-avoid">
      <h2 class="mb-3 text-lg font-semibold">{$t('dossier.trainers.title')}</h2>
      {#if dossier.trainers.length === 0}
        <p class="ui:text-muted-foreground text-sm">{$t('dossier.trainers.empty')}</p>
      {:else}
        <div class="w-full overflow-x-auto rounded-lg border print:overflow-visible">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{$t('dossier.trainers.name')}</Table.Head>
                <Table.Head>{$t('dossier.trainers.ccp')}</Table.Head>
                <Table.Head>{$t('dossier.trainers.specialization')}</Table.Head>
                <Table.Head>{$t('dossier.trainers.contract')}</Table.Head>
                <Table.Head>{$t('dossier.trainers.ip_cession')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each dossier.trainers as trainer (trainer.email ?? trainer.fullname)}
                <Table.Row>
                  <Table.Cell class="font-medium">
                    <span class="block">{trainer.fullname}</span>
                    <span class="ui:text-muted-foreground block text-xs">{trainer.email ?? ''}</span>
                  </Table.Cell>
                  <Table.Cell>
                    {#if trainer.ccpNumber}
                      <span class="block">{trainer.ccpNumber}</span>
                      <span class="ui:text-muted-foreground block text-xs">
                        {$t('dossier.trainers.valid_until', {
                          date: formatDossierDate(trainer.ccpValidUntil)
                        })}
                      </span>
                    {:else}
                      <span class="ui:text-muted-foreground">—</span>
                    {/if}
                  </Table.Cell>
                  <Table.Cell>{trainer.specialization ?? '—'}</Table.Cell>
                  <Table.Cell>
                    <Badge variant={trainerStatusBadgeVariant(trainer.contractStatus)}>
                      {$t(trainerStatusLabelKey(trainer.contractStatus))}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={trainerStatusBadgeVariant(trainer.ipCessionStatus)}>
                      {$t(trainerStatusLabelKey(trainer.ipCessionStatus))}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {/if}
    </section>

    <section class="print:break-inside-avoid">
      <h2 class="mb-3 text-lg font-semibold">{$t('dossier.syllabus.title')}</h2>
      {#if dossier.syllabus.length === 0}
        <p class="ui:text-muted-foreground text-sm">{$t('dossier.syllabus.empty')}</p>
      {:else}
        <ol class="list-decimal space-y-1 rounded-lg border p-4 pl-8 text-sm">
          {#each dossier.syllabus as item (item.lessonId)}
            <li>
              <span class="font-medium">{item.title}</span>
              {#if item.lessonAt}
                <span class="ui:text-muted-foreground"> · {formatDossierDate(item.lessonAt)}</span>
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    </section>

    <section class="print:break-inside-avoid">
      <h2 class="mb-3 text-lg font-semibold">{$t('dossier.sessions.title')}</h2>
      {#if dossier.sessions.length === 0}
        <p class="ui:text-muted-foreground text-sm">{$t('dossier.sessions.empty')}</p>
      {:else}
        <div class="w-full overflow-x-auto rounded-lg border print:overflow-visible">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{$t('dossier.sessions.session')}</Table.Head>
                <Table.Head>{$t('dossier.sessions.date')}</Table.Head>
                <Table.Head>{$t('dossier.sessions.duration')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each dossier.sessions as session (session.lessonId)}
                <Table.Row>
                  <Table.Cell class="font-medium">{session.title}</Table.Cell>
                  <Table.Cell>{formatDossierDate(session.lessonAt)}</Table.Cell>
                  <Table.Cell>{formatDossierHours(session.sessionSeconds)}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {/if}
    </section>

    <section>
      <h2 class="mb-3 text-lg font-semibold">{$t('dossier.attendance.title')}</h2>
      {#if dossier.students.length === 0}
        <p class="ui:text-muted-foreground text-sm">{$t('dossier.attendance.empty')}</p>
      {:else}
        <div class="w-full overflow-x-auto rounded-lg border print:overflow-visible">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>{$t('dossier.attendance.student')}</Table.Head>
                <Table.Head>{$t('dossier.attendance.nif')}</Table.Head>
                <Table.Head>{$t('dossier.attendance.hours')}</Table.Head>
                <Table.Head>{$t('dossier.attendance.percent')}</Table.Head>
                <Table.Head>{$t('dossier.attendance.certificate')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each dossier.students as student (student.profileId ?? student.fullname)}
                <Table.Row>
                  <Table.Cell class="font-medium">{student.fullname ?? '—'}</Table.Cell>
                  <Table.Cell>
                    {#if student.nif}
                      {student.nif}
                    {:else}
                      <span class="ui:text-muted-foreground">{$t('dossier.attendance.nif_missing')}</span>
                    {/if}
                  </Table.Cell>
                  <Table.Cell>{formatDossierHours(student.attendedSeconds)}</Table.Cell>
                  <Table.Cell>{attendancePercent(student.attendedSeconds, totalSessionSeconds)}%</Table.Cell>
                  <Table.Cell>
                    {#if student.certificateEarnedAt}
                      {formatDossierDate(student.certificateEarnedAt)}
                    {:else}
                      <span class="ui:text-muted-foreground">{$t('dossier.attendance.no_certificate')}</span>
                    {/if}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {/if}
    </section>

    <footer class="ui:text-muted-foreground hidden border-t pt-4 text-xs print:block">
      {$t('dossier.print_footer', { organization: dossier.organizationName })}
    </footer>
  </article>
{:else}
  <p class="ui:text-muted-foreground py-8 text-center text-sm">{$t('dossier.not_found')}</p>
{/if}
