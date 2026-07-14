import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';

export const forgotPasswordEmail = defineEmail({
  id: 'forgotPassword',
  subject: 'Notificação de reposição de palavra-passe - ClassroomIO',
  schema: z.object({
    email: z.email(),
    name: z.string().min(1),
    link: z.url()
  }),
  render: (fields) => {
    const content = `Olá ${fields.name},
    <p>Estás a receber este email porque pediste a reposição da palavra-passe da tua conta ClassroomIO.</p>
    <p>Clica no botão abaixo para repor a tua palavra-passe:</p>

    <div>
      <a class="button" href="${fields.link}">Repor a minha palavra-passe</a>
    </div>

    <p>PS: Se não foste tu a fazer este pedido, responde a este email ou escreve para help@classroomio.com para que possamos investigar uma possível tentativa de acesso indevido à tua conta.</p>
    `;

    return getDefaultTemplate(content);
  }
});
