import { Hono } from '@api/utils/hono';
import { easypayWebhookRouter } from './easypay';
import { livekitWebhookRouter } from './livekit';

export const webhooksRouter = new Hono().route('/', easypayWebhookRouter).route('/', livekitWebhookRouter);
