import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCourseWithRelations,
  listCourseInstructorsForDossier,
  listCourseStudentsForDossier
} from '@cio/db/queries/course';
import { getLessonsByCourseId } from '@cio/db/queries/lesson';

import { getCourseAttendanceSummary } from '@api/services/attendance/in-person';
import { buildCourseDossier } from '@api/services/course/dossier';

/**
 * The dossier's job is to find what an auditor would find, before the auditor
 * does. A gap that goes undetected is the failure mode that costs money, so
 * each gap code gets a case.
 */

vi.mock('@cio/db/queries/course', () => ({
  getCourseWithRelations: vi.fn(),
  listCourseInstructorsForDossier: vi.fn(),
  listCourseStudentsForDossier: vi.fn()
}));

vi.mock('@cio/db/queries/lesson', () => ({ getLessonsByCourseId: vi.fn() }));

vi.mock('@api/services/attendance/in-person', () => ({ getCourseAttendanceSummary: vi.fn() }));

const mockedCourse = vi.mocked(getCourseWithRelations);
const mockedTrainers = vi.mocked(listCourseInstructorsForDossier);
const mockedStudents = vi.mocked(listCourseStudentsForDossier);
const mockedLessons = vi.mocked(getLessonsByCourseId);
const mockedAttendance = vi.mocked(getCourseAttendanceSummary);

const COURSE_ID = 'course-1';

/** A course with nothing missing — each test then breaks exactly one thing. */
function completeSetup() {
  mockedCourse.mockResolvedValue({
    id: COURSE_ID,
    title: 'Formação X',
    description: null,
    org: { id: 'org-1', name: 'Microlopes' },
    certificate: {
      sigo: {
        trainingEntity: 'Microlopes',
        trainingAction: 'Ação 1',
        ufcdCode: '0349',
        totalHours: 50,
        startDate: '2026-01-12',
        endDate: '2026-02-20'
      }
    }
  } as never);

  mockedTrainers.mockResolvedValue([
    {
      id: 'trainer-1',
      fullname: 'Ana Formadora',
      ccpNumber: 'CCP-123',
      ccpValidUntil: '2030-01-01',
      contractStatus: 'signed',
      ipCessionStatus: 'signed',
      specialization: null,
      email: null
    }
  ] as never);

  mockedStudents.mockResolvedValue([
    { profileId: 'p1', fullname: 'João', nif: '123456789', certificateEarnedAt: '2026-02-21T10:00:00.000Z' }
  ] as never);

  mockedLessons.mockResolvedValue([{ id: 'l1', title: 'Sessão 1', lessonAt: '2026-01-12T19:00:00.000Z' }] as never);

  mockedAttendance.mockResolvedValue({
    sessions: [{ lessonId: 'l1', title: 'Sessão 1', lessonAt: '2026-01-12T19:00:00.000Z', sessionSeconds: 10_800 }],
    students: [{ profileId: 'p1', totalSeconds: 10_800, perSession: [] }]
  } as never);
}

/** The gap codes reported for a course, for terse assertions. */
async function gapCodes(): Promise<string[]> {
  const dossier = await buildCourseDossier(COURSE_ID);

  return dossier.gaps.map((gap) => gap.code);
}

describe('buildCourseDossier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeSetup();
  });

  it('reports no gaps when everything is in place', async () => {
    expect(await gapCodes()).toEqual([]);
  });

  it('assembles the pack an auditor asks for', async () => {
    const dossier = await buildCourseDossier(COURSE_ID);

    expect(dossier.organizationName).toBe('Microlopes');
    expect(dossier.action).toMatchObject({ ufcdCode: '0349', totalHours: 50 });
    expect(dossier.syllabus).toHaveLength(1);
    expect(dossier.students[0]).toMatchObject({ fullname: 'João', attendedSeconds: 10_800 });
  });

  it('flags the SIGO identification fields that are missing', async () => {
    mockedCourse.mockResolvedValue({
      id: COURSE_ID,
      title: 'Formação X',
      org: { id: 'org-1', name: 'Microlopes' },
      certificate: {}
    } as never);

    expect(await gapCodes()).toEqual(expect.arrayContaining(['entity_missing', 'hours_missing', 'period_missing']));
  });

  it('flags a period that is only half filled in', async () => {
    mockedCourse.mockResolvedValue({
      id: COURSE_ID,
      title: 'Formação X',
      org: { id: 'org-1', name: 'Microlopes' },
      certificate: { sigo: { trainingEntity: 'Microlopes', totalHours: 50, startDate: '2026-01-12' } }
    } as never);

    expect(await gapCodes()).toContain('period_missing');
  });

  it('flags an action with no trainer', async () => {
    mockedTrainers.mockResolvedValue([]);

    expect(await gapCodes()).toContain('no_trainer');
  });

  it('flags a trainer without a CCP', async () => {
    mockedTrainers.mockResolvedValue([
      { id: 't1', fullname: 'Ana', ccpNumber: null, ccpValidUntil: null, contractStatus: 'signed' }
    ] as never);

    const dossier = await buildCourseDossier(COURSE_ID);

    expect(dossier.gaps).toContainEqual({ code: 'trainer_no_ccp', subject: 'Ana' });
  });

  it('flags a CCP that has expired', async () => {
    mockedTrainers.mockResolvedValue([
      { id: 't1', fullname: 'Ana', ccpNumber: 'CCP-1', ccpValidUntil: '2020-01-01', contractStatus: 'signed' }
    ] as never);

    const dossier = await buildCourseDossier(COURSE_ID);

    expect(dossier.gaps).toContainEqual({ code: 'trainer_ccp_expired', subject: 'Ana' });
  });

  it('flags an unsigned trainer contract', async () => {
    mockedTrainers.mockResolvedValue([
      { id: 't1', fullname: 'Ana', ccpNumber: 'CCP-1', ccpValidUntil: '2030-01-01', contractStatus: 'pending' }
    ] as never);

    const dossier = await buildCourseDossier(COURSE_ID);

    expect(dossier.gaps).toContainEqual({ code: 'trainer_contract_unsigned', subject: 'Ana' });
  });

  it('counts the students missing a NIF', async () => {
    mockedStudents.mockResolvedValue([
      { profileId: 'p1', fullname: 'João', nif: null, certificateEarnedAt: null },
      { profileId: 'p2', fullname: 'Maria', nif: null, certificateEarnedAt: null },
      { profileId: 'p3', fullname: 'Rui', nif: '123456789', certificateEarnedAt: null }
    ] as never);

    const dossier = await buildCourseDossier(COURSE_ID);

    expect(dossier.gaps).toContainEqual({ code: 'students_without_nif', subject: '2' });
  });

  it('flags an action with no attendance recorded', async () => {
    mockedAttendance.mockResolvedValue({ sessions: [], students: [] } as never);

    expect(await gapCodes()).toContain('no_attendance');
  });

  it('refuses to build a dossier for a course that does not exist', async () => {
    mockedCourse.mockResolvedValue(null as never);

    await expect(buildCourseDossier(COURSE_ID)).rejects.toThrow(/not found/i);
  });
});
