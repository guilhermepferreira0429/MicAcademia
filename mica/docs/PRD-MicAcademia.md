# PRD — MicAcademia (fork ClassroomIO)

**Repositório:** github.com/guilhermepferreira0429/MicAcademia (fork de classroomio/classroomio, AGPL-3.0)
**Objetivo:** transformar o ClassroomIO open source na plataforma da MicAcademia — academia de formação Nautis + Microlopes, com aulas ao vivo elegíveis para financiamento IEFP, pagamentos portugueses, faturação via PHC, e gestão de formadores conforme entidade certificada DGERT (Microlopes).

---

## 0. Contexto e restrições que guiam este PRD

- Entidade formadora: Microlopes, certificada DGERT.
- Financiamento-alvo: Cheque-Formação + Digital (ou sucessor) — **confirmar estado atual antes de desenhar o modelo de negócio à volta disto**; motor de receita primário e resiliente é o canal B2B direto às empresas (obrigação legal das 40h de formação/ano).
- **Requisito não-negociável do IEFP**: formação tem de ter interação em tempo real. Conteúdo só gravado não é elegível.
- Estrutura societária: contrato de revenue-share 50/50 entre Nautis Tech e Microlopes.
- Propriedade de conteúdo: cursos são de Nautis+Microlopes mesmo quando produzidos por formadores externos pagos — cláusula de cedência de direitos em cada contrato de formador; sistema tem de suportar o registo desse estado.
- Licença do código: AGPL-3.0 — obrigação de expor código-fonte modificado por ser corrido como serviço de rede (secção 13).
- Modalidades de entrega: presencial, online síncrono, e misto — todas têm de gerar registo de presença válido.
- Motor de aula ao vivo: **LiveKit self-hosted**, não Cloudflare Calls — decisão tomada para consolidar um único motor de vídeo em tempo real com o que já está planeado para o módulo Connect do Synara, evitando duas dependências de infraestrutura diferentes.

---

## 1. Fases

### Fase 1 — MVP piloto (bloqueante para submeter o primeiro curso ao IEFP)
1.1 Pagamentos EasyPay
1.2 i18n PT completo
1.3 Aula ao vivo com LiveKit self-hosted + registo de presença online
1.4 Certificados em formato compatível com submissão SIGO
1.5 Cumprimento AGPL (link de código-fonte)
1.6 Branding institucional (MicAcademia)

### Fase 2 — Operação real
2.1 Faturação automática via PHC
2.2 Presença presencial (check-in) + registo unificado presencial/online
2.3 Gestão de formadores (CCP, contratos, cedência de IP)
2.4 Reporting de revenue-share 50/50

### Fase 3 — Escala
3.1 Multi-área de catálogo (23 cursos já definidos, cf. `MicAcademia-Catalogo-Cursos.md`)
3.2 Painel de submissões SIGO (tracker interno)
3.3 White-label / multi-tenant mais profundo, se necessário

---

## 2. Especificação por item

### 1.1 Pagamentos EasyPay
**Problema:** ClassroomIO assume fluxo de cobrança direta. EasyPay/Multibanco/MB WAY são pagamentos por referência, assíncronos, confirmados via webhook.

**Construir:**
- Novo *payment provider* `easypay` na camada de pagamentos.
- Estado `pending_payment` na inscrição — aluno inscreve-se, gera-se referência Multibanco ou pedido MB WAY, acesso bloqueado até confirmação.
- Endpoint webhook (`/api/webhooks/easypay`) que liberta o acesso.
- Suporte a Multibanco (referência) e MB WAY (pedido por telemóvel).
- Testar em sandbox EasyPay antes de produção.

**Aceitação:** aluno paga por referência Multibanco em sandbox, webhook chega, inscrição passa a `active`, acesso liberado automaticamente.

---

### 1.2 i18n PT
**Construir:**
- Confirmar/configurar framework de i18n existente no código.
- Traduzir strings visíveis a aluno e formador: dashboard, curso, inscrição, certificados, emails transacionais.
- PT-PT, não PT-BR.

**Aceitação:** aluno novo percorre inscrição → curso → certificado sem strings em inglês.

---

### 1.3 Aula ao vivo com LiveKit self-hosted
**Problema:** ClassroomIO não tem aula síncrona nativa. Decisão: construir sobre LiveKit self-hosted (não Cloudflare Calls), por reutilização de competência com o Synara/Connect e por já geres infraestrutura própria a este nível.

**Construir:**
- **Infraestrutura**: servidor LiveKit (Docker) + servidor TURN próprio, portas UDP abertas na rede (R550/R510). Este é o primeiro passo — nunca usaste LiveKit ainda, contar 1-2 dias de setup e teste antes de integrar com a app.
- **Lado servidor (app)**: endpoint que cria uma sala LiveKit por sessão, associada a `course_id`/`cohort_id`/`session_id`, e gera o access token (JWT) só para alunos inscritos nessa turma.
- **Lado cliente (app)**: embutir o LiveKit JS SDK na UI (SvelteKit) — não há componente oficial Svelte, construir wrapper fino à volta do SDK JS (framework-agnóstico).
- **Presença**: usar os **webhooks nativos do LiveKit** (`room_started`, `participant_joined`, `participant_left`, `room_finished`) para alimentar a tabela `attendance_log(session_id, user_id, joined_at, left_at)`.
- **Regra de negócio de presença válida**: soma de intervalos ≥ 90% da duração da sessão conta como "presente" (ajustável). Tratar reconexões (múltiplas entradas/saídas somam-se) e sessões que nunca fecham (timeout de inatividade).

**Aceitação:** sessão ao vivo com 5+ participantes no servidor LiveKit próprio gera registo de presença consistente, exportável, sobrevivendo a pelo menos um caso de reconexão a meio.

**Ordem de execução interna recomendada:**
1. Montar e testar LiveKit self-hosted isoladamente (sala simples, 2 participantes, sem ligação à app) — validar que TURN/STUN funciona atrás da tua rede antes de integrar seja o que for.
2. Só depois, integrar criação de sala + tokens no fluxo de curso.
3. Só depois, ligar os webhooks à tabela de presença.

---

### 1.4 Certificados compatíveis com SIGO
**Construir:**
- Template com campos exigidos: nome, NIF, ação de formação, carga horária, entidade formadora (Microlopes), datas, código UFCD se aplicável.
- Geração automática ao fim do curso, condicionada ao registo de presença (1.3) atingir o mínimo exigido.

**Aceitação:** certificado gerado tem todos os campos para submissão SIGO sem edição manual.

---

### 1.5 Cumprimento AGPL
**Construir:**
- Link "Código-fonte" visível (rodapé/página "Sobre") apontando para o fork modificado, atualizado a cada release.

**Aceitação:** qualquer aluno encontra e acede ao código-fonte da versão em produção a partir da própria plataforma.

---

### 1.6 Branding institucional — MicAcademia
**Construir:**
- Nome "MicAcademia", logótipo, cores.
- Confirmar domínio (verificar disponibilidade `micacademia.pt` e considerar `.academy`) e registo de marca no INPI antes de investir em identidade visual final.
- Confirmar no código que a customização de tema cobre o necessário sem licença Enterprise.

**Aceitação:** plataforma sem branding "ClassroomIO" visível ao aluno fora do link de código-fonte exigido pela AGPL.

---

### 2.1 Faturação automática via PHC
**Construir:**
- Webhook de pagamento confirmado (EasyPay) → chamada à API do PHC (reaproveitar integração já existente da Microlopes) → fatura-recibo emitida.
- Guardar referência da fatura associada à inscrição.

**Aceitação:** pagamento confirmado gera fatura no PHC sem intervenção manual.

---

### 2.2 Presença presencial + registo unificado
**Construir:**
- Check-in presencial (QR code por sessão ou marcação manual).
- Tabela de presença unificada combinando eventos presenciais e online (LiveKit) no mesmo modelo de dados.

**Aceitação:** curso misto produz registo de presença consolidado por aluno.

---

### 2.3 Gestão de formadores
**Construir:**
- Ficha de formador: CCP, área de especialização, estado do contrato, estado de cedência de IP.
- Associação formador ↔ curso(s).

**Aceitação:** admin vê de relance formadores com CCP válido e contrato assinado antes de um curso ir ao ar.

---

### 2.4 Reporting de revenue-share 50/50
**Construir:**
- Transações etiquetadas por curso.
- Relatório mensal com split 50/50, exportável.

**Aceitação:** relatório mensal sem cálculo manual.

---

### 3.1 Multi-área de catálogo
23 cursos já definidos (`MicAcademia-Catalogo-Cursos.md`) — estrutura de categorias no catálogo: IA/Informática, Redes, Gestão, Contabilidade, Logística, Jurídico, Compliance, Operações.

### 3.2 Painel de submissões SIGO
Tracker interno (sem API pública do IEFP): submetido, aprovado, pendente, pago.

### 3.3 White-label / multi-tenant mais profundo
Avaliar só se surgir necessidade de separar marcas.

---

## 3. Fora de scope (por agora)
- Automação de submissão ao SIGO (sem API pública).
- Integração com outros fundos além do canal B2B/cheque digital — avaliar pós-piloto.
- Multi-tenant real / agências — Fase 3 condicional.

---

## 4. Notas de arquitetura

- Stack herdada: SvelteKit + TailwindCSS, Node/TypeScript API, PostgreSQL + Redis, MinIO.
- **Nova dependência de infraestrutura**: servidor LiveKit + TURN, self-hosted (R550/R510).
- Novas tabelas: `attendance_log`, `payment_transactions` (multi-provider), `instructor_profile`, `revenue_share_ledger`.
- Deploy: self-host, a decidir R550 vs R510.

---

## 5. Ordem de execução sugerida

1. i18n PT (rápido, desbloqueia testes reais)
2. Pagamentos EasyPay
3. **LiveKit self-hosted — montar e testar isoladamente primeiro**, depois integrar com a app + presença online
4. Certificados SIGO-compatíveis
5. Cumprimento AGPL + branding
6. Faturação PHC
7. Presença presencial + registo unificado
8. Gestão de formadores
9. Reporting revenue-share
10. Fase 3 conforme necessidade
