# Deploy da MicAcademia

Todo o stack corre em `docker-compose.prod.yaml`. **Nenhuma credencial está no
compose**: cada contentor da aplicação lê o mesmo ficheiro,
`deploy/mica.env`, que fica de fora do git. O Postgres e o Redis têm as
credenciais à vista no compose de propósito — não são publicados no host, só
existem dentro da rede do compose.

## Antes de arrancar

1. **DNS** — três nomes a apontar para o servidor (o Caddy pede os certificados
   ao arrancar, portanto isto tem de estar feito primeiro):

   | Nome | Serve |
   | --- | --- |
   | `academia.microlopes.pt` | a academia |
   | `api.academia.microlopes.pt` | API e webhooks (EasyPay, LiveKit) |
   | `live.academia.microlopes.pt` | sinalização das aulas ao vivo |

2. **Firewall** — além do 80/443:

   | Porta | Para quê |
   | --- | --- |
   | `50000-50200/udp` | vídeo e áudio das aulas |
   | `3478/udp` | TURN, para quem está atrás de firewall corporativa |
   | `7881/tcp` | recurso alternativo quando o UDP está bloqueado |

   O vídeo **não passa pelo Caddy**: vai direto a estas portas. Se ficarem
   fechadas, a aula liga mas ninguém se vê nem se ouve.

3. **Configuração**

   ```bash
   cp deploy/mica.env.example deploy/mica.env
   chmod 600 deploy/mica.env
   ```

   Preencher, com atenção a três pontos:

   - `PRIVATE_SERVER_KEY`, `BETTER_AUTH_SECRET` e o segredo do LiveKit geram-se
     com `openssl rand -hex 32`.
   - **O segredo do LiveKit aparece três vezes** — em `LIVEKIT_API_SECRET`, em
     `LIVEKIT_KEYS` e dentro do `EGRESS_CONFIG_BODY`. Se não forem iguais, o
     gravador não arranca e as aulas ficam sem gravação.
   - O `EGRESS_CONFIG_BODY` é YAML numa só linha porque um ficheiro de ambiente
     não aceita valores multilinha. Não lhe metas aspas à volta.

4. **Domínio do TURN** — editar `deploy/livekit/livekit.yaml` e pôr o
   `turn.domain` igual ao `MICA_LIVEKIT_DOMAIN`. É um nome de máquina, não é
   segredo, por isso está no repositório.

## Arrancar

```bash
docker compose -f docker-compose.prod.yaml up -d --build
```

O primeiro arranque demora — o dashboard é uma build pesada. As migrações da
base de dados correm sozinhas no arranque da API (`SKIP_DB_SETUP=true` desliga
isso).

Verificar:

```bash
docker compose -f docker-compose.prod.yaml ps
docker compose -f docker-compose.prod.yaml logs -f api
```

## Depois de estar de pé

- **EasyPay** — registar `https://api.academia.microlopes.pt/webhooks/easypay`
  no backoffice. Sem isso os pagamentos ficam pendentes até o cron de
  reconciliação os apanhar.
- **Aula de teste** — criar uma lição ao vivo, entrar com duas contas e
  confirmar três coisas: veem-se, a assiduidade aparece no relatório, e a
  gravação surge na lição minutos depois de a sala fechar.
- **Backups** — o volume `postgres-data` é o que não pode perder-se. O
  armazenamento de objetos (vídeos, gravações, certificados) é responsabilidade
  do fornecedor de S3/R2.

## Notas de dimensionamento

- Cada gravação em curso é um Chrome: conta com ~2 CPUs por turma a gravar em
  simultâneo. Duas turmas ao mesmo tempo = dois processos.
- Uma aula de 3h a 720p ocupa 1,5–2 GB. Vinte e três cursos com várias edições
  por ano somam depressa: definir uma política de retenção antes de encher o
  bucket.
- O `jobs` pode ser escalado à parte (`docker compose ... up -d --scale jobs=2`)
  se o processamento de vídeo ficar atrás.
