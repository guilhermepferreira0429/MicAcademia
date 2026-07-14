import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const sessionReminderEmail = defineEmail({
  id: 'sessionReminder',
  subject: 'Lembrete: a tua sessão em direto está a aproximar-se',
  schema: z.object({
    orgName: z.string().min(1),
    courseName: z.string().min(1),
    sessionTitle: z.string().min(1),
    sessionTimeLabel: z.string().min(1),
    whenLabel: z.string().min(1),
    joinUrl: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Olá,</p>
      <p>A tua sessão em direto <strong>${fields.sessionTitle}</strong> em <strong>${fields.courseName}</strong> começa <strong>${fields.whenLabel}</strong>.</p>
      <p><strong>Quando:</strong> ${fields.sessionTimeLabel}</p>
      <div>
        <a class="button" href="${fields.joinUrl}">Entrar na sessão</a>
      </div>
      <p>Até já,</p>
      <p>${fields.orgName}</p>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});

export const sessionUpdatedEmail = defineEmail({
  id: 'sessionUpdated',
  subject: 'Atualização: os detalhes da tua sessão em direto mudaram',
  schema: z.object({
    orgName: z.string().min(1),
    courseName: z.string().min(1),
    sessionTitle: z.string().min(1),
    sessionTimeLabel: z.string().min(1),
    joinUrl: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Olá,</p>
      <p>A sessão em direto <strong>${fields.sessionTitle}</strong> em <strong>${fields.courseName}</strong> foi atualizada.</p>
      <p><strong>Novo horário:</strong> ${fields.sessionTimeLabel}</p>
      <p>O convite de calendário em anexo vai atualizar o evento que já está no teu calendário.</p>
      <div>
        <a class="button" href="${fields.joinUrl}">Entrar na sessão</a>
      </div>
      <p>Cumprimentos,</p>
      <p>${fields.orgName}</p>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
