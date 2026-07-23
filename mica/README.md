# mica/ — o servidor

Tudo o que a MicAcademia precisa para correr num servidor está nesta pasta.
**Copias só esta pasta para o servidor** — não é preciso lá ter o código: as
imagens da aplicação são publicadas pelo CI e o servidor limita-se a puxá-las.

**Pré-produção e produção usam este mesmo compose**; o que as distingue é o
`.env` — domínios, versão das imagens, e se o EasyPay aponta para sandbox ou
para o real.

```
mica/
├── docker-compose.yaml   toda a plataforma: app, base de dados, aulas ao vivo, TLS
├── .env.example          copiar para .env e preencher (é o único sítio com segredos)
├── Caddyfile             TLS automático e encaminhamento dos três domínios
├── build-push.sh         compila as imagens aqui e envia-as para o registo
└── backup.sh             cópia de segurança da base de dados
```

O `build-push.sh` corre na tua máquina; no servidor só precisas dos outros
ficheiros.

O servidor de aulas ao vivo e o gravador não têm ficheiro de configuração: o
compose passa-lhes o YAML inteiro numa variável, com os valores a virem do
`.env`. Assim cada segredo é escrito uma vez só.

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

Copiar esta pasta para o servidor (`scp -r mica/ servidor:/srv/micacademia/`),
e lá dentro:

```bash
cp .env.example .env
chmod 600 .env
```

`PRIVATE_SERVER_KEY`, `BETTER_AUTH_SECRET` e `LIVEKIT_API_SECRET` geram-se com
`openssl rand -hex 32`. Os valores não levam aspas: o ficheiro é lido pelo
Docker, não por uma shell, e tudo o que está depois do `=` conta como valor.

`MICA_VERSION` escolhe a build. Em produção põe uma versão fixa (`1.0.0`) para
que um deploy seja um ato deliberado; em pré-produção `latest` acompanha o
`main`, que é o objetivo.

**4. Acesso às imagens** — se o pacote no GHCR estiver privado, autenticar uma
vez no servidor com um token do GitHub com permissão `read:packages`:

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u <utilizador> --password-stdin
```

**5. Arrancar**

```bash
docker compose pull
docker compose up -d
```

Não há build no servidor — só descarga das imagens. As migrações correm
sozinhas no arranque da API: são idempotentes, só aplicam o que falta, e ficam
protegidas por um lock, portanto reiniciar não estraga nada.

## Operação do dia a dia

```bash
docker compose ps                  # estado
docker compose logs -f api         # seguir um serviço
docker compose restart jobs        # reiniciar um worker
docker compose up -d --scale jobs=2   # mais capacidade de processamento de vídeo
```

**Atualizar para uma versão nova:**

```bash
# em produção: mudar MICA_VERSION no .env para a versão a instalar
docker compose pull
docker compose up -d
```

Só os contentores cuja imagem mudou são recriados. Para voltar atrás, repõe-se
o `MICA_VERSION` anterior e repete-se — as imagens antigas continuam no registo.
Uma ressalva: **reverter a aplicação não reverte a base de dados**, e as
migrações já aplicadas ficam. Uma versão anterior só arranca bem se o esquema
continuar a servi-la.

## Publicar uma versão nova

Na tua máquina, com o repositório:

```bash
cd mica
./build-push.sh 1.0.0      # ou sem argumento, para usar o MICA_VERSION do .env
```

Compila as três imagens, marca-as também como `latest` e envia tudo para o
registo. Depois, no servidor, é o `pull` + `up -d` de cima.

O `.env` local precisa do `MICA_IMAGE_PREFIX` (o script lê o mesmo ficheiro que
o servidor usa, para o nome ser exatamente o que o compose espera puxar) e de um
`docker login` feito uma vez no registo.

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
