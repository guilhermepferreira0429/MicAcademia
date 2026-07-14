import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const studentCourseCompletionEmail = defineEmail({
  id: 'studentCourseCompletion',
  subject: 'Parabéns — concluíste os requisitos do curso',
  schema: z.object({
    orgName: z.string().min(1),
    courseName: z.string().min(1),
    studentName: z.string().min(1),
    certificateUrl: z.string().url(),
    customMessage: z.string().nullable().optional(),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const customBlock =
      fields.customMessage && fields.customMessage.trim().length > 0
        ? `<div style="margin:16px 0;padding:12px;border-left:3px solid #6366f1;background:#f8fafc;">${fields.customMessage}</div>`
        : '';

    const content = `
      <p>Olá ${fields.studentName},</p>
      <p>Parabéns! Cumpriste os requisitos de conclusão de <strong>${fields.courseName}</strong>.</p>
      ${customBlock}
      <p><a href="${fields.certificateUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:#fff;text-decoration:none;border-radius:6px;">Ver o teu certificado</a></p>
      <p>Se o botão não funcionar, copia e cola este link no teu navegador:<br/><span style="word-break:break-all;">${fields.certificateUrl}</span></p>
      <p>Cumprimentos,<br/>${fields.orgName}</p>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
