import * as z from 'zod';

import { defineEmail } from '../send';
import { getDefaultTemplate } from '../templates';
import { ZEmailBranding } from '../core/branding';

export const newsfeedPostEmail = defineEmail({
  id: 'newsfeedPost',
  subject: 'Nova publicação no curso',
  schema: z.object({
    courseTitle: z.string().min(1),
    teacherName: z.string().min(1),
    content: z.string().min(1),
    postLink: z.url(),
    orgName: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>${fields.teacherName} fez uma publicação num curso que estás a frequentar: ${fields.courseTitle}.</p>
      <div style="font-style: italic; margin-top: 10px;">${fields.content}</div>
      <div>
        <a class="button" href="${fields.postLink}">Ver publicação</a>
      </div>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});

export const newsfeedCommentEmail = defineEmail({
  id: 'newsfeedComment',
  subject: 'Comentário no mural de notícias',
  schema: z.object({
    courseTitle: z.string().min(1),
    comment: z.string().min(1),
    postLink: z.url(),
    orgName: z.string().min(1),
    branding: ZEmailBranding
  }),
  render: (fields) => {
    const content = `
      <p>Um aluno deixou um comentário na tua publicação do mural de notícias</p>
      <div style="font-style: italic; margin-top: 10px;">${fields.comment}</div>
      <div>
        <a class="button" href="${fields.postLink}">Ver comentário</a>
      </div>
    `;

    return getDefaultTemplate(content, fields.branding);
  }
});
