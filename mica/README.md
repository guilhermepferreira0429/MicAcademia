# mica/ — o servidor

Tudo o que a MicAcademia precisa para correr num servidor está nesta pasta.
**Pré-produção e produção usam este mesmo compose**; o que as distingue é o
`.env` — domínios e se o EasyPay aponta para sandbox ou para o real.

```
mica/
├── docker-compose.yaml   toda a plataforma: app, base de dados, aulas ao vivo, TLS
├── .env.example          copiar para .env e preencher (é o único sítio com segredos)
├── Caddyfile             TLS automático e encaminhamento dos três domínios
├── livekit/livekit.yaml  servidor das aulas ao vivo (sem segredos)
└── backup.sh             cópia de segurança da base de dados
```

## O que sobe

| Serviço | O que é |
| --- | --- |
| `api` | API Hono (porta interna 3081) — corre as migrações no arranque |
| `dashboard` | a academia em si, SvelteKit (3082) |
| `jobs` | workers: vídeo, transcrição, emails, reconciliação de pagamentos |
| `postgres` / `redis` | dados e filas — sem porta exposta no host |
| `livekit` + `livekit-redis` + `egress` | aulas ao vivo e a sua gravação |
| `caddy` | certificados automáticos e encaminhamento |

## Primeira instalação

**1. DNS** — três nomes a apontar para o servidor. O Caddy pede os certificados
logo no arranque, por isso isto tem de estar feito antes.

| Nome | Serve |
| --- | --- |
| `academia.microlopes.pt` | a academia |
| `api.academia.microlopes.pt` | API e webhooks (EasyPay, LiveKit) |
| `live.academia.microlopes.pt` | sinalização das aulas ao vivo |

**2. Firewall** — além do 80/443:

| Porta | Para quê |
| --- | --- |
| `50000-50200/udp` | vídeo e áudio das aulas |
| `3478/udp` | TURN, para quem está atrás de firewall corporativa |
| `7881/tcp` | alternativa quando o UDP está bloqueado |

O vídeo **não passa pelo Caddy** — vai direto a estas portas. Fechadas, a aula
liga mas ninguém se vê nem se ouve.

**3. Configuração**

```bash
cd mica
cp .env.example .env
chmod 600 .env
```

Preencher, com atenção a três pontos:

- `PRIVATE_SERVER_KEY`, `BETTER_AUTH_SECRET` e o segredo do LiveKit geram-se com
  `openssl rand -hex 32`.
- **O segredo do LiveKit aparece três vezes** — `LIVEKIT_API_SECRET`,
  `LIVEKIT_KEYS` e dentro do `EGRESS_CONFIG_BODY`. Se divergirem, o gravador não
  arranca e as aulas ficam sem gravação.
- O `EGRESS_CONFIG_BODY` é YAML numa linha só (um ficheiro de ambiente não
  aceita multilinha). Não lhe metas aspas à volta.

**4. Domínio do TURN** — em `livekit/livekit.yaml`, pôr `turn.domain` igual ao
`MICA_LIVEKIT_DOMAIN`. É um nome de máquina, não é segredo, por isso está no
repositório.

**5. Arrancar**

```bash
docker compose up -d --build
```

O primeiro arranque demora — o dashboard é uma build pesada. As migrações
correm sozinhas: são idempotentes, só aplicam o que falta, e ficam protegidas
por um lock, portanto reiniciar não estraga nada.

## Operação do dia a dia

```bash
docker compose ps                  # estado
docker compose logs -f api         # seguir um serviço
docker compose restart jobs        # reiniciar um worker
docker compose up -d --scale jobs=2   # mais capacidade de processamento de vídeo
```

**Atualizar depois de um `git pull`:**

```bash
cd mica
docker compose up -d --build
```

**Cópia de segurança:**

```bash
./backup.sh                        # escreve em ./backups/
```

O volume `postgres-data` é o que não pode perder-se. Os vídeos e as gravações
vivem no armazenamento de objetos, que é responsabilidade do fornecedor.

Restaurar:

```bash
gunzip -c backups/micacademia-2026-07-23.sql.gz | \
  docker compose exec -T postgres psql -U micacademia -d micacademia
```

## Depois de estar de pé

- **EasyPay** — registar `https://api.<dominio>/webhooks/easypay` no backoffice.
  Sem isso os pagamentos ficam pendentes até o cron de reconciliação os apanhar.
- **Aula de teste** — criar uma lição ao vivo, entrar com duas contas e
  confirmar três coisas: veem-se, a assiduidade aparece no relatório, e a
  gravação surge na lição minutos depois de a sala fechar.

## Dimensionamento

- Cada gravação em curso é um Chrome: ~2 CPUs por turma a gravar em simultâneo.
- Uma aula de 3h a 720p ocupa 1,5–2 GB. Vinte e três cursos com várias edições
  por ano somam depressa — definir retenção antes de encher o bucket.
