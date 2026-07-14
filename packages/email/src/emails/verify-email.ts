import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const verifyEmailEmail = defineEmail({
  id: 'verifyEmail',
  subject: 'Ação necessária: confirma o teu email',
  schema: z.object({
    link: z.url(),
    newEmail: z.email().optional(),
    userName: z.string().optional(),
    orgName: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const isEmailChange = !!fields.newEmail;
    const userName = fields.userName || 'olá';
    const hasOrgBranding = Boolean(fields.branding?.orgName);
    const welcomeLine = hasOrgBranding
      ? `Bem-vindo a ${fields.orgName}! Para deixar a tua conta pronta a usar, precisamos de verificar o teu email.`
      : 'Bem-vindo! Para deixar a tua conta pronta a usar, precisamos de verificar o teu email.';

    const content = isEmailChange
      ? `
    <p><strong>Olá ${userName} 👋</strong></p>
    <p>Solicitaste a alteração do teu endereço de email para <strong>${fields.newEmail}</strong>.</p>
    <p>Para aprovar esta alteração, clica no botão abaixo:</p>
    <div>
      <a class="button" href="${fields.link}">Aprovar alteração de email</a>
    </div>
    <p>Se não solicitaste esta alteração, ignora este email.</p>
  `
      : `
    <p><strong>Olá ${userName} 👋</strong></p>
    <p>${welcomeLine}</p>
    <p>Fazemos isto para garantir que não recebemos emails de utilizadores falsos no nosso registo. Para tirares o máximo partido do nosso produto, vamos precisar que verifiques o teu email clicando no botão <strong>Verificar</strong> abaixo.</p>
    <div>
      <a class="button" href="${fields.link}">Verificar</a>
    </div>
  `;

    return getDefaultTemplate(content, fields.branding);
  }
});
