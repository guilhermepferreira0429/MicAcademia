export const CERTIFICATE_TEMPLATE_IDS = ['classique', 'brutalist', 'noir', 'poster', 'minimal', 'sigo'] as const;
export type CertificateTemplateId = (typeof CERTIFICATE_TEMPLATE_IDS)[number];

/**
 * SIGO (Portuguese IEFP) course-level certification config, persisted per course
 * in the certificate design. Feeds the legal fields on the 'sigo' template.
 */
export interface CertificateSigoConfig {
  /** DGERT-certified training entity (defaults to "Microlopes"). */
  trainingEntity?: string;
  /** Name/code of the training action (ação de formação). */
  trainingAction?: string;
  /** UFCD code, when applicable. */
  ufcdCode?: string;
  /** Total training hours (carga horária). */
  totalHours?: number;
  /** Training period start (ISO date). */
  startDate?: string;
  /** Training period end (ISO date). */
  endDate?: string;
}

export interface CertificateSignatory {
  name: string;
  role: string;
  enabled: boolean;
  signatureUrl?: string;
}

export interface CertificateDesign {
  templateId: CertificateTemplateId;
  accentColor: string;
  subtitle?: string;
  descriptionOverride?: string;
  signatories: [CertificateSignatory, CertificateSignatory];
  idFormat?: string;
}

export interface CertificateRenderData {
  recipientName: string;
  courseName: string;
  courseDescription: string;
  orgName: string;
  orgLogoUrl?: string;
  date: string;
  certificateId: string;
  // SIGO (Portuguese IEFP) legal fields — optional; rendered by the 'sigo' template.
  /** Recipient's tax number (NIF). */
  nif?: string;
  /** DGERT-certified training entity (e.g. "Microlopes"). */
  trainingEntity?: string;
  /** Training action name/code (ação de formação). */
  trainingAction?: string;
  /** UFCD code, when applicable. */
  ufcdCode?: string;
  /** Total training hours (carga horária). */
  totalHours?: number;
  /** Formatted training period start. */
  startDate?: string;
  /** Formatted training period end. */
  endDate?: string;
}

export interface CertificateRenderResult {
  html: string;
  styles: string;
}

export interface CertificateTemplateMeta {
  id: CertificateTemplateId;
  label: string;
  description: string;
}
