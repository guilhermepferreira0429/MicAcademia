import { AppError, ErrorCodes } from '@api/utils/errors';
import {
  getCourseWithRelations,
  listCourseInstructorsForDossier,
  listCourseStudentsForDossier,
  type DossierTrainerRow
} from '@cio/db/queries/course';
import { getLessonsByCourseId } from '@cio/db/queries/lesson';

import { getCourseAttendanceSummary } from '@api/services/attendance/in-person';

/**
 * Audit dossier for a training action (PRD-adjacent, requested by the academy).
 * DGERT/IEFP audits ask for the same pack every time: what the action was, who
 * taught it and with what credentials, the programme, who attended for how
 * long, and who was certified. This assembles it from data already in the
 * system, and flags what is still missing so gaps are found before an auditor
 * finds them.
 */

export interface DossierGap {
  /** Stable code the UI turns into a translated message. */
  code:
    | 'entity_missing'
    | 'hours_missing'
    | 'period_missing'
    | 'no_trainer'
    | 'trainer_no_ccp'
    | 'trainer_ccp_expired'
    | 'trainer_contract_unsigned'
    | 'students_without_nif'
    | 'no_attendance';
  /** Who/what the gap is about (a trainer name, a count). */
  subject?: string;
}

export interface AuditDossier {
  generatedAt: string;
  organizationName: string;
  action: {
    courseId: string;
    title: string;
    description: string | null;
    trainingEntity: string | null;
    trainingAction: string | null;
    ufcdCode: string | null;
    totalHours: number | null;
    startDate: string | null;
    endDate: string | null;
  };
  trainers: DossierTrainerRow[];
  syllabus: Array<{ lessonId: string; title: string; lessonAt: string | null }>;
  sessions: Array<{ lessonId: string; title: string; lessonAt: string | null; sessionSeconds: number }>;
  students: Array<{
    profileId: string | null;
    fullname: string | null;
    nif: string | null;
    certificateEarnedAt: string | null;
    attendedSeconds: number;
    perSession: Array<{ lessonId: string; seconds: number; percent: number; sources: string[] }>;
  }>;
  gaps: DossierGap[];
}

export async function buildCourseDossier(courseId: string): Promise<AuditDossier> {
  const course = await getCourseWithRelations(courseId);
  if (!course) {
    throw new AppError('Course not found', ErrorCodes.COURSE_NOT_FOUND, 404);
  }

  const [trainers, lessons, attendance, students] = await Promise.all([
    listCourseInstructorsForDossier(courseId),
    getLessonsByCourseId(courseId),
    getCourseAttendanceSummary(courseId),
    listCourseStudentsForDossier(courseId)
  ]);

  const sigo = course.certificate?.sigo ?? null;
  const attendanceByProfile = new Map(attendance.students.map((student) => [student.profileId, student]));

  const dossierStudents = students.map((student) => {
    const record = student.profileId ? attendanceByProfile.get(student.profileId) : undefined;

    return {
      profileId: student.profileId,
      fullname: student.fullname,
      nif: student.nif,
      certificateEarnedAt: student.certificateEarnedAt,
      attendedSeconds: record?.totalSeconds ?? 0,
      perSession: record?.perSession ?? []
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    organizationName: course.org?.name ?? '',
    action: {
      courseId,
      title: course.title,
      description: course.description ?? null,
      trainingEntity: sigo?.trainingEntity ?? null,
      trainingAction: sigo?.trainingAction ?? null,
      ufcdCode: sigo?.ufcdCode ?? null,
      totalHours: sigo?.totalHours ?? null,
      startDate: sigo?.startDate ?? null,
      endDate: sigo?.endDate ?? null
    },
    trainers,
    syllabus: lessons.map((lesson) => ({
      lessonId: lesson.id,
      title: lesson.title,
      lessonAt: lesson.lessonAt ?? null
    })),
    sessions: attendance.sessions,
    students: dossierStudents,
    gaps: findGaps({ sigo, trainers, students: dossierStudents, sessionCount: attendance.sessions.length })
  };
}

function findGaps(input: {
  sigo: { trainingEntity?: string; totalHours?: number; startDate?: string; endDate?: string } | null;
  trainers: DossierTrainerRow[];
  students: Array<{ nif: string | null }>;
  sessionCount: number;
}): DossierGap[] {
  const gaps: DossierGap[] = [];

  if (!input.sigo?.trainingEntity) gaps.push({ code: 'entity_missing' });
  if (!input.sigo?.totalHours) gaps.push({ code: 'hours_missing' });
  if (!input.sigo?.startDate || !input.sigo?.endDate) gaps.push({ code: 'period_missing' });

  if (input.trainers.length === 0) {
    gaps.push({ code: 'no_trainer' });
  }

  const today = Date.now();
  for (const trainer of input.trainers) {
    if (!trainer.ccpNumber) {
      gaps.push({ code: 'trainer_no_ccp', subject: trainer.fullname });
    } else if (trainer.ccpValidUntil && Date.parse(trainer.ccpValidUntil) < today) {
      gaps.push({ code: 'trainer_ccp_expired', subject: trainer.fullname });
    }

    if (trainer.contractStatus !== 'signed') {
      gaps.push({ code: 'trainer_contract_unsigned', subject: trainer.fullname });
    }
  }

  const withoutNif = input.students.filter((student) => !student.nif).length;
  if (withoutNif > 0) {
    gaps.push({ code: 'students_without_nif', subject: String(withoutNif) });
  }

  if (input.sessionCount === 0) {
    gaps.push({ code: 'no_attendance' });
  }

  return gaps;
}
