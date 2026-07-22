import { classroomio, type InferResponseType } from '$lib/utils/services/api';

// Audit dossier for a training action (the pack DGERT/IEFP asks for)
export type DossierRequest = (typeof classroomio.course)[':courseId']['dossier']['$get'];
export type DossierResponse = InferResponseType<DossierRequest> | null;
export type DossierSuccess = Extract<InferResponseType<DossierRequest>, { success: true }>;
export type Dossier = DossierSuccess['data'];

/** Identification of the training action (entity, UFCD, hours, period). */
export type DossierAction = Dossier['action'];

/** One trainer with the credentials an auditor checks. */
export type DossierTrainer = Dossier['trainers'][number];

/** One lesson of the programme. */
export type DossierSyllabusItem = Dossier['syllabus'][number];

/** One delivered session, with its scheduled duration. */
export type DossierSession = Dossier['sessions'][number];

/** One row of the attendance sheet. */
export type DossierStudent = Dossier['students'][number];

/** Something still missing from the dossier, flagged before the auditor finds it. */
export type DossierGap = Dossier['gaps'][number];
