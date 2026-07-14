import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const studentCourseInviteEmail = defineEmail({
  id: 'studentCourseInvite',
  subject: 'Foste convidado a juntar-te a um curso',
  schema: z.object({
    orgName: z.string().min(1),
    courseName: z.string().min(1),
    inviteLink: z.string().url(),
    expiresAt: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Olá,</p>
      <p>Foste convidado a juntar-te a <strong>${fields.courseName}</strong> em ${fields.orgName}.</p>
      <p>Este convite expira em <strong>${fields.expiresAt}</strong>.</p>
      <div>
        <a class="button" href="${fields.inviteLink}">Juntar-me ao curso</a>
      </div>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
