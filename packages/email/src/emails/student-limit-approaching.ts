import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';

export const studentLimitApproachingEmail = defineEmail({
  id: 'studentLimitApproaching',
  subject: 'Estás a aproximar-te do limite de alunos do plano Free',
  schema: z.object({
    orgName: z.string().min(1),
    studentCount: z.number(),
    studentLimit: z.number(),
    upgradeUrl: z.url()
  }),
  render: (fields) => {
    const content = `
      <p>Olá,</p>
      <p><strong>${fields.orgName}</strong> tem agora ${fields.studentCount} dos ${fields.studentLimit} alunos incluídos no plano Free — cerca de metade do limite. Assim que o atingires, não será possível inscrever novos alunos, aceitar convites ou adicioná-los até fazeres o upgrade.</p>
      <div>
        <a class="button" href="${fields.upgradeUrl}">Fazer upgrade do plano</a>
      </div>
    `;

    return getDefaultTemplate(content);
  }
});
