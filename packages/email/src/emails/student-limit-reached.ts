import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';

export const studentLimitReachedEmail = defineEmail({
  id: 'studentLimitReached',
  subject: 'Atingiste o limite de estudantes do plano Gratuito',
  schema: z.object({
    orgName: z.string().min(1),
    studentCount: z.number(),
    studentLimit: z.number(),
    upgradeUrl: z.url()
  }),
  render: (fields) => {
    const content = `
      <p>Olá,</p>
      <p><strong>${fields.orgName}</strong> atingiu o limite de ${fields.studentLimit} estudantes do plano Gratuito. A partir de agora, os novos estudantes não podem inscrever-se, aceitar convites nem ser adicionados até fazeres o upgrade.</p>
      <div>
        <a class="button" href="${fields.upgradeUrl}">Fazer upgrade do plano</a>
      </div>
    `;

    return getDefaultTemplate(content);
  }
});
