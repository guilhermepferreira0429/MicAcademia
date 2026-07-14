import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const teacherStudentJoinedEmail = defineEmail({
  id: 'teacherStudentJoined',
  subject: 'Tens um novo aluno 🎉!',
  schema: z.object({
    courseName: z.string().min(1),
    studentName: z.string().min(1),
    studentEmail: z.email(),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Olá, formador incrível,</p>
      <p>Parabéns 🎉, um novo aluno: <strong>${fields.studentName} (${fields.studentEmail})</strong> inscreveu-se num curso que estás a lecionar: ${fields.courseName}</p>
      <p>Esperamos que tenha uma ótima experiência a aprender com o melhor (TU).</p>
      <p>Se te deparares com algum problema, não hesites em contactar-nos. Adoraríamos tornar a tua experiência de ensino o mais simples possível.</p>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
