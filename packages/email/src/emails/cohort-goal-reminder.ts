import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const cohortGoalReminderEmail = defineEmail({
  id: 'cohortGoalReminder',
  subject: 'Lembrete: um objetivo do grupo está a chegar ao prazo',
  schema: z.object({
    orgName: z.string().min(1),
    cohortName: z.string().min(1),
    goalTitle: z.string().min(1),
    daysUntilDue: z.number().int(),
    completedCount: z.number().int(),
    requiredCount: z.number().int(),
    loginUrl: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const dueLine =
      fields.daysUntilDue <= 0
        ? `<p>Este objetivo está agora <strong>em atraso</strong>.</p>`
        : fields.daysUntilDue === 1
          ? `<p>Este objetivo termina <strong>amanhã</strong>.</p>`
          : `<p>Este objetivo termina dentro de <strong>${fields.daysUntilDue} dias</strong>.</p>`;

    const progress = `${fields.completedCount} de ${fields.requiredCount} cursos concluídos`;

    const content = `
      <p>Olá,</p>
      <p>Este é um lembrete de que o objetivo <strong>${fields.goalTitle}</strong> no teu grupo <strong>${fields.cohortName}</strong> em ${fields.orgName} precisa da tua atenção.</p>
      ${dueLine}
      <p>O teu progresso até agora: <strong>${progress}</strong>.</p>
      <p><a href="${fields.loginUrl}">Abre o LMS</a> para continuares.</p>
      <p>Até já,</p>
      <p>${fields.orgName}</p>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
