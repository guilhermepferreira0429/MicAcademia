import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const studentCohortWelcomeEmail = defineEmail({
  id: 'studentCohortWelcome',
  subject: 'Tens acesso a uma turma — inicia sessão para começar',
  schema: z.object({
    orgName: z.string().min(1),
    cohortName: z.string().min(1),
    loginUrl: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Olá,</p>
      <p>Passaste a ter acesso a <strong>${fields.cohortName}</strong> em <strong>${fields.orgName}</strong>.</p>
      <p><a href="${fields.loginUrl}">Inicia sessão no LMS</a> para abrir a turma e começar a aprender.</p>
      <p>Se tiveres algum problema, contacta o(s) teu(s) formador(es).</p>
      <p>Cumprimentos,</p>
      <p>${fields.orgName}</p>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
