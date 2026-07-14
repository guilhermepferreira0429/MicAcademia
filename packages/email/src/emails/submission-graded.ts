import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const submissionGradedEmail = defineEmail({
  id: 'submissionGraded',
  subject: 'A tua submissão de exercício foi atualizada',
  schema: z.object({
    orgName: z.string().min(1),
    studentName: z.string().min(1),
    exerciseTitle: z.string().min(1),
    courseName: z.string().min(1),
    statusText: z.string().min(1),
    exerciseLink: z.string().min(1),
    score: z.string().optional(),
    lessonTitle: z.string().optional(),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    let content = `
      <p>Olá ${fields.studentName},</p>
      <p>O estado do exercício que submeteste sobre <strong>${fields.exerciseTitle}</strong> foi atualizado para <strong>${fields.statusText}</strong>.</p>
    `;

    if (fields.score) {
      content += `
        <p>A tua pontuação foi <strong>${fields.score}</strong>.</p>
        <div>
          <a class="button" href="${fields.exerciseLink}">Ver o teu resultado</a>
        </div>
      `;
    } else {
      content += `
        <div>
          <a class="button" href="${fields.exerciseLink}">Abrir exercício</a>
        </div>
      `;
    }

    if (fields.lessonTitle) {
      content += `
        <p>Este exercício é referente a <strong>${fields.lessonTitle}</strong> num curso que estás a frequentar intitulado <strong>${fields.courseName}</strong>.</p>
      `;
    } else {
      content += `
        <p>Este exercício faz parte de um curso que estás a frequentar intitulado <strong>${fields.courseName}</strong>.</p>
      `;
    }

    return getDefaultTemplate(content, fields.branding);
  }
});
