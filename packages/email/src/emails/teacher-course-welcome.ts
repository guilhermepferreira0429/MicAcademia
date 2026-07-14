import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const teacherCourseWelcomeEmail = defineEmail({
  id: 'teacherCourseWelcome',
  subject: 'Recebeste um convite para um curso!',
  schema: z.object({
    name: z.string().min(1),
    orgName: z.string().min(1),
    courseName: z.string().min(1),
    inviteLink: z.url(),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Olá ${fields.name},</p>
      <p>Recebeste acesso para lecionar um curso por parte de ${fields.orgName}</p>
      <p>O curso tem o título: ${fields.courseName}</p>
      <div>
        <a class="button" href="${fields.inviteLink}">Abrir painel</a>
      </div>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
