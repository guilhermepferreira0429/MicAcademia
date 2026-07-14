import { Hono } from '@api/utils/hono';
import { easypayWebhookRouter } from './easypay';

export const webhooksRouter = new Hono().route('/', easypayWebhookRouter);
