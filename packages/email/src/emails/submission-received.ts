import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const submissionReceivedEmail = defineEmail({
  id: 'submissionReceived',
  subject: 'Nova submissão de exercício',
  schema: z.object({
    orgName: z.string().min(1),
    studentName: z.string().min(1),
    exerciseTitle: z.string().min(1),
    exerciseLink: z.string().min(1),
    submissionLink: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Olá,</p>
      <p>O aluno <strong>${fields.studentName}</strong> acabou de submeter um exercício <a href="${fields.exerciseLink}">${fields.exerciseTitle}</a>.</p>
      <p>Podes começar a avaliar carregando em "Abrir submissões".</p>
      <div>
        <a class="button" href="${fields.submissionLink}">Abrir submissões</a>
      </div>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
