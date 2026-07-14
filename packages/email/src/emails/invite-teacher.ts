import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';
import { escapeHtml } from '../utils/functions/email-helpers';

export const inviteTeacherEmail = defineEmail({
  id: 'inviteTeacher',
  subject: 'Tens um convite para te juntares a uma organização na ClassroomIO',
  schema: z.object({
    email: z.string().email(),
    orgName: z.string().min(1),
    orgSiteName: z.string().min(1),
    roleName: z.string().min(1),
    inviterName: z.string().min(1).optional(),
    expiresAt: z.string().min(1),
    inviteLink: z.url(),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const orgName = escapeHtml(fields.orgName);
    const roleName = escapeHtml(fields.roleName);
    const inviterName = fields.inviterName ? escapeHtml(fields.inviterName) : undefined;
    const inviteLink = escapeHtml(fields.inviteLink);
    const expiresAt = escapeHtml(fields.expiresAt);

    const invitationLine = inviterName
      ? `<p><strong>${inviterName}</strong> convidou-te para te juntares a <strong>${orgName}</strong> na ClassroomIO como ${roleName}.</p>`
      : `<p>Tens um convite para te juntares a <strong>${orgName}</strong> na ClassroomIO como ${roleName}.</p>`;

    const content = `
      <p>Olá,</p>
      ${invitationLine}
      <p>Este convite expira a ${expiresAt} (UTC).</p>
      <div>
        <a class="button" href="${inviteLink}">Aceitar convite</a>
      </div>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
