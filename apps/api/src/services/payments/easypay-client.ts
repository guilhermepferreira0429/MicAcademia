import { env } from '@cio/core/config/env';

import type { TEasypayMethod } from '@cio/utils/validation';

/**
 * Thin EasyPay API client — HTTP + payload shaping only. Orchestration (DB
 * writes, granting course access) lives in the service. Uses the EasyPay
 * `/2.0/single` flow, which fits MicAcademia's Phase-1 scope (Multibanco + MB
 * WAY): no hosted checkout page needed — Multibanco returns entity/reference,
 * MB WAY pushes a prompt to the payer's phone.
 *
 * Knowledge distilled from the production pservir/doceencanto integrations —
 * see docs/easypay-reference.md.
 */

const isProduction = env.EASYPAY_ENVIRONMENT === 'production';
const BASE_URL = isProduction ? 'https://api.prod.easypay.pt' : 'https://api.test.easypay.pt';

export function isEasypayConfigured(): boolean {
  return Boolean(env.EASYPAY_ACCOUNT_ID && env.EASYPAY_API_KEY);
}

/** Map our method to EasyPay's code. NOTE: MB WAY is 'mbw', not 'mbway'. */
function mapMethod(method: TEasypayMethod): 'mb' | 'mbw' {
  return method === 'mbway' ? 'mbw' : 'mb';
}

/** Strip accents and clamp — EasyPay rejects diacritics and over-long fields. */
function sanitize(value: string, max: number): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').substring(0, max);
}

/**
 * EasyPay wants the phone split into national number + indicative. Sending a
 * full international number (or one with spaces) returns HTTP 412. PT-focused
 * digit split (no external phone lib).
 */
function formatPhone(raw?: string | null): { phone: string; phone_indicative: string } | null {
  if (!raw) return null;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('351') && digits.length > 9) {
    return { phone: digits.slice(-9), phone_indicative: '+351' };
  }

  return { phone: digits.slice(-9), phone_indicative: '+351' };
}

/** EasyPay can't reach localhost / private LAN hosts — attaching such a URL makes it reject the checkout. */
function isReachableWebhookUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return false;
    if (/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname)) return false;

    return true;
  } catch {
    return false;
  }
}

/** Public notification URL to attach, or null when none is reachable (dev). */
function resolveNotificationUrl(): string | null {
  const base = env.EASYPAY_WEBHOOK_URL?.trim();
  if (!base || !isReachableWebhookUrl(base)) return null;

  const secret = env.EASYPAY_WEBHOOK_SECRET?.trim();
  if (!secret) return base;

  const separator = base.includes('?') ? '&' : '?';

  return `${base}${separator}token=${encodeURIComponent(secret)}`;
}

async function easypayRequest<T = any>(endpoint: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      AccountId: (env.EASYPAY_ACCOUNT_ID ?? '').trim(),
      ApiKey: (env.EASYPAY_API_KEY ?? '').trim()
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'follow'
  });

  const text = await response.text();

  if (!response.ok) {
    // A 412 (Precondition Failed) is always a rejected payload field — surface
    // the detail so it's diagnosable rather than an opaque status.
    let detail = '';
    try {
      const parsed = JSON.parse(text);
      const message = parsed?.message ?? parsed?.errors ?? parsed;
      detail = Array.isArray(message)
        ? message.join('; ')
        : typeof message === 'string'
          ? message
          : JSON.stringify(message);
    } catch {
      detail = (text || '').slice(0, 300);
    }

    throw new Error(`EasyPay API error: ${response.status}${detail ? ` - ${detail}` : ''}`);
  }

  return JSON.parse(text) as T;
}

export interface CreateSinglePaymentInput {
  method: TEasypayMethod;
  amountEuros: number;
  /** Our own key `MICA-ORD-<...>` (≤ 50 chars) — lets reconcile match by key. */
  orderKey: string;
  transactionKey: string;
  customerKey: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  fiscalNumber?: string | null;
  descriptive: string;
}

export interface EasypaySingleResponse {
  id: string;
  method?: {
    type?: string;
    url?: string;
    entity?: string;
    reference?: string;
    expiration_time?: string;
    status?: string;
  };
  payment_status?: string;
  status?: string;
  [key: string]: unknown;
}

/** Create a single payment (Multibanco reference or MB WAY push). */
export async function createSinglePayment(input: CreateSinglePaymentInput): Promise<EasypaySingleResponse> {
  const easypayMethod = mapMethod(input.method);
  const phone = formatPhone(input.customerPhone);

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const captureDate = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;

  const payload: Record<string, unknown> = {
    type: 'sale',
    currency: 'EUR',
    customer: {
      name: sanitize(input.customerName, 100),
      email: input.customerEmail,
      key: input.customerKey,
      language: 'PT',
      ...(phone && { phone: phone.phone, phone_indicative: phone.phone_indicative }),
      ...(input.fiscalNumber && { fiscal_number: input.fiscalNumber })
    },
    key: input.orderKey,
    value: Number(input.amountEuros.toFixed(2)),
    method: easypayMethod,
    capture: {
      capture_date: captureDate,
      transaction_key: input.transactionKey,
      descriptive: sanitize(input.descriptive, 50)
    }
  };

  // MB WAY requires a phone; fall back to a placeholder so EasyPay accepts it
  // (the real prompt still needs a valid number — validated upstream).
  if (easypayMethod === 'mbw' && !phone) {
    (payload.customer as Record<string, unknown>).phone = '900000000';
    (payload.customer as Record<string, unknown>).phone_indicative = '+351';
  }

  // Multibanco: pin a 48h reference validity. EasyPay wants 'YYYY-MM-DD HH:mm' (NOT ISO 8601).
  if (easypayMethod === 'mb') {
    const exp = new Date(Date.now() + 48 * 60 * 60 * 1000);
    payload.expiration_time = `${exp.getUTCFullYear()}-${pad(exp.getUTCMonth() + 1)}-${pad(exp.getUTCDate())} ${pad(exp.getUTCHours())}:${pad(exp.getUTCMinutes())}`;
  }

  const notificationUrl = resolveNotificationUrl();
  if (notificationUrl) {
    payload.notification_url = notificationUrl;
  }

  return easypayRequest<EasypaySingleResponse>('/2.0/single', 'POST', payload);
}

/** Fetch a single payment's live status (used by verify + reconcile). */
export async function getSinglePayment(id: string): Promise<EasypaySingleResponse> {
  return easypayRequest<EasypaySingleResponse>(`/2.0/single/${id}`, 'GET');
}

/** True when a status value from EasyPay means the payment is settled. */
export function isPaidStatus(status: string | undefined | null): boolean {
  const normalized = String(status ?? '').toLowerCase();

  return ['paid', 'success', 'authorised', 'captured', 'ok'].includes(normalized);
}

/** True when a status value from EasyPay means the payment failed/expired. */
export function isFailedStatus(status: string | undefined | null): boolean {
  const normalized = String(status ?? '').toLowerCase();

  return ['failed', 'error', 'declined', 'expired', 'cancelled', 'canceled'].includes(normalized);
}
