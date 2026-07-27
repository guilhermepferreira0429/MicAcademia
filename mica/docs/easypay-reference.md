# EasyPay — referência de implementação (portada do pservir/doceencanto)

Notas destiladas da implementação EasyPay já testada em produção nos projetos `pservir` e `doceencanto` (NestJS + TypeORM). A MicAcademia é Hono + Drizzle — portamos a **lógica e o conhecimento do gateway**, reescrevendo nos padrões do repo (route → service → query).

## Configuração (env)
```
PAYMENT_PROVIDER=easypay            # easypay | (futuro: outros)
EASYPAY_ENVIRONMENT=sandbox         # sandbox | production
EASYPAY_ACCOUNT_ID=...
EASYPAY_API_KEY=...
EASYPAY_API_VERSION=2.0             # 2.0 (checkout hosted) | 1.0 (single)
EASYPAY_WEBHOOK_URL=                # URL pública do webhook (obrigatório p/ MB/MBWAY)
```
- Base URL: `sandbox` → `https://api.test.easypay.pt`, `production` → `https://api.prod.easypay.pt` (version-less; cada endpoint traz o prefixo `/2.0/...`).
- Auth: headers `AccountId` e `ApiKey` (trim aos valores).

## Métodos (códigos EasyPay)
- `cc` = cartão · `mb` = Multibanco · `mbw` = MB WAY (**atenção: "mbw", não "mbway"**) · `ap`/`gp` = Apple/Google Pay (exigem setup extra).
- PRD MicAcademia (Fase 1): apenas **Multibanco** e **MB WAY**.

## Dois fluxos
1. **Checkout 2.0** (`POST /2.0/checkout`): devolve `{id, session, config}`. A página hosted (`pay.{sandbox.}easypay.pt`) espera um `manifest` = base64url de `JSON{id,session,config}` (não só o session). URL final: `https://pay.{sandbox.}easypay.pt/?manifest=<encodeURIComponent(base64url)>`. Precisa de `expiration_time` (ISO 8601) senão devolve `config:null`.
2. **Single 1.0** (`POST /2.0/single`): fallback quando a conta não tem Checkout 2.0 hosted. Devolve `method.url` (cartão/MBWAY hosted form) ou entity/reference direto (Multibanco — pagar no ATM). `expiration_time` do Multibanco em formato `'YYYY-MM-DD HH:mm'` (NÃO ISO).

## Payload — pontos que partem se errados
- `transaction_key` e `key` (order) limitados a **50 chars** (usar orderNumber curto + sufixo de timestamp, não UUID).
- Nome do cliente e descrição: remover acentos (`normalize('NFD')` + strip diacríticos), truncar.
- Telefone: **dois campos** `phone` (nacional, só dígitos) + `phone_indicative` (ex: `+351`). Número internacional completo ou com espaços → HTTP 412. Normalizar com libphonenumber-js, fallback só-dígitos.
- MB WAY: telefone obrigatório.
- `notification_url`: só anexar se for **publicamente acessível** (rejeitar localhost/IPs privados) — senão o EasyPay pode devolver `config:null` e partir o checkout. Em dev local, o webhook não chega (usar túnel/ngrok ou polling via verify).

## Webhook (`/webhook/easypay`)
- Campo autoritativo: `payment_status` (algumas notificações usam `status`) — **ler ambos**.
- Mapear: `paid|success|authorised|captured` → PAGO (cartão reporta authorised/captured, não paid — sem estes casos o cartão fica preso em pendente); `failed|error|declined` → FALHADO; `expired`; `pending`.
- Encontrar a inscrição por `transactionId` (o `id` da notificação) **ou** por `key` (padrão `PREFIX-ORD-<orderNumber>-<ts>` → extrair orderNumber). O retry/órfã faz o `id` não casar.
- Idempotente: se já está pago, não repetir efeitos.
- Efeitos ao confirmar: libertar acesso, email de confirmação, (Fase 2) fatura PHC.

## Verify (polling pós-redirect)
- `GET /verify-easypay?orderNumber=...` pergunta o estado AO VIVO ao EasyPay (GET ao pagamento) e reconcilia se pago. O frontend faz polling nesta rota na página de confirmação (essencial p/ MB WAY/Multibanco que não têm página hosted).

## Reconciliação (rede de segurança — CRÍTICO)
Webhooks perdem-se. Duas crons no pservir:
1. **A cada 5 min**: inscrições PENDENTES/FALHADAS das últimas 72h-7d com transação EasyPay → `verify` ao vivo; se pago lá mas não cá, corrige.
2. **A cada 30 min**: lista `GET /2.0/single?created_at=interval(...)` dos pagamentos pagos das últimas 72h, casa pela `key`, corrige órfãs (apanha o caso do `id` apontar para a transação errada do retry). **Cap de valor** (valor pago tem de bater com o total) antes de marcar paga.
- Na MicAcademia isto encaixa nos workers BullMQ (`apps/jobs`) em vez de `@nestjs/schedule`.

## Pré-retry
Antes de criar nova sessão para uma inscrição com transação anterior: fazer `verify` ao vivo primeiro. Se já paga (webhook perdido), marcar paga e bloquear nova tentativa — evita órfãs e o cenário "pagou mas aparece falhada".

## Ficheiros de referência (pservir)
- `code/api/src/modules/payments/payments.service.ts` — toda a lógica (Stripe + EasyPay)
- `.../payments.controller.ts` — rotas (create-session, webhook/easypay, verify-easypay, status)
- `.../dto/create-payment.dto.ts` — DTOs (PaymentMethod enum, EasypayWebhookDto)
