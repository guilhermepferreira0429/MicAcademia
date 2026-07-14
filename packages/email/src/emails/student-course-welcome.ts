import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const studentCourseWelcomeEmail = defineEmail({
  id: 'studentCourseWelcome',
  subject: (fields) => `Tens acesso ao curso ${fields.courseName}`,
  schema: z.object({
    orgName: z.string().min(1),
    courseName: z.string().min(1),
    loginUrl: z.string().min(1),
    customMessage: z.string().optional(),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const hasCustomMessage = !!fields.customMessage && fields.customMessage.trim().length > 0;

    const intro = hasCustomMessage
      ? fields.customMessage
      : `
      <p>Olá,</p>
      <p>Passaste a ter acesso a <strong>${fields.courseName}</strong> em <strong>${fields.orgName}</strong>.</p>
      <p>Se tiveres algum problema, contacta o teu ou a tua formador(a).</p>
      <p>Cumprimentos,</p>
      <p>${fields.orgName}</p>
    `;

    const content = `
      ${intro}
      <p><a href="${fields.loginUrl}">Inicia sessão no LMS</a> para abrir o curso e começar a aprender.</p>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
