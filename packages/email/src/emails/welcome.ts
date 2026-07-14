import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';

export const welcomeEmail = defineEmail({
  id: 'welcome',
  subject: 'Bem-vindo ao ClassroomIO!',
  schema: z.object({
    name: z.string().min(1)
  }),
  render: (fields) => {
    const content = `
    <p>Olá ${fields.name},</p>
    <p>O meu nome é Best, sou o fundador do ClassroomIO. Vi que te registaste, tens alguma dúvida até agora?</p>
    <p>
     Gostavas de ver uma apresentação da plataforma numa demonstração do produto de 30 minutos? É gratuita e não vamos tentar vender-te nada, apenas queremos conhecer o teu caso de utilização e mostrar-te todas as funcionalidades e fluxos fixes que preparámos.
    </p>
    <p>
      Interessado? Basta reservar um horário de 30 minutos para a demonstração no nosso calendário!
    </p>
    <div>
      <a class="button" href="https://classroomio.com/demo">Reservar demonstração</a>
    </div>
    <p>
      PS: respondo pessoalmente a todos os emails. Não temos uma equipa de apoio subcontratada do outro lado do mundo.. ;-)
    </p>
  `;

    return getDefaultTemplate(content);
  }
});
