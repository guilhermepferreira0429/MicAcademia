import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const quizAssignedEmail = defineEmail({
  id: 'quizAssigned',
  subject: 'Tens um questionário para concluir',
  schema: z.object({
    orgName: z.string().min(1),
    courseName: z.string().min(1),
    exerciseTitle: z.string().min(1),
    quizUrl: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Olá,</p>
      <p>Foi-te atribuído um questionário — <strong>${fields.exerciseTitle}</strong> — em <strong>${fields.courseName}</strong> na <strong>${fields.orgName}</strong>.</p>
      <div>
        <a class="button" href="${fields.quizUrl}">Fazer o questionário</a>
      </div>
      <p>Cumprimentos,</p>
      <p>${fields.orgName}</p>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
