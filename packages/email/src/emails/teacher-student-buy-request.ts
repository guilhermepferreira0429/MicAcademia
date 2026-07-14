import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const teacherStudentBuyRequestEmail = defineEmail({
  id: 'teacherStudentBuyRequest',
  subject: 'Pedido para entrar no curso!',
  schema: z.object({
    courseName: z.string().min(1),
    studentEmail: z.string().email(),
    studentFullname: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Olá, estimado tutor,</p>
      <p>Um novo aluno pediu para entrar num curso que estás a lecionar: "${fields.courseName}"</p>
      <p style="font-weight: bold;">Dados do aluno</p>
      <p>
        Nome: ${fields.studentFullname}<br />
        Email: ${fields.studentEmail}
      </p>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
