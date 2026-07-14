import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const studentOrgInviteEmail = defineEmail({
  id: 'studentOrgInvite',
  subject: 'Recebeste um convite para participar como estudante',
  schema: z.object({
    email: z.string().email(),
    orgName: z.string().min(1),
    inviteLink: z.url(),
    expiresAt: z.string().min(1),
    courseNames: z.string().optional(),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const courseLine = fields.courseNames ? `<p>Foi-te dado acesso a: <strong>${fields.courseNames}</strong>.</p>` : '';

    const content = `
      <p>Olá,</p>
      <p>Recebeste um convite para participar em <strong>${fields.orgName}</strong> como estudante.</p>
      ${courseLine}
      <p>Este convite expira a ${fields.expiresAt} (UTC).</p>
      <div>
        <a class="button" href="${fields.inviteLink}">Aceitar convite</a>
      </div>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
