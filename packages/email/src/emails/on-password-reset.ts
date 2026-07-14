import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';

export const onPasswordResetEmail = defineEmail({
  id: 'onPasswordReset',
  subject: 'Palavra-passe redefinida com sucesso - ClassroomIO',
  schema: z.object({
    name: z.string().min(1)
  }),
  render: (fields) => {
    return getDefaultTemplate(`Olá ${fields.name},
    <p>A tua palavra-passe foi redefinida com sucesso.</p>
    `);
  }
});
