import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const studentProvePaymentEmail = defineEmail({
  id: 'studentProvePayment',
  subject: 'Falta apenas um passo',
  schema: z.object({
    courseName: z.string().min(1),
    teacherEmail: z.email(),
    studentFullname: z.string().min(1),
    orgName: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Olá ${fields.studentFullname},</p>
      <p>Estás a um passo de te juntares a: <strong>${fields.courseName}</strong></p>
      <p>Envia o teu comprovativo de pagamento para: <strong>${fields.teacherEmail}</strong>, para poderes juntar-te ao curso.</p>
      <p>Falamos em breve e vemo-nos nas aulas.</p>
      <p>${fields.orgName}</p>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
