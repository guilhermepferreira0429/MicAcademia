# Gravação das aulas ao vivo

A aula ao vivo grava-se sozinha. Ninguém tem de carregar em «gravar»: quando a
sala é criada, o pedido de gravação vai anexado a ela, e quando a aula termina o
ficheiro é carregado para o bucket de vídeos e publicado na lição — passando a
ser conteúdo on-demand para quem faltou.

## Como funciona

1. Um formando ou formador pede o token de entrada (`GET /course/:courseId/livekit/:lessonId/token`).
   A API cria a sala `mica-lesson-<lessonId>` **com uma cláusula de egress**.
2. O LiveKit arranca a gravação assim que a sala arranca.
3. O Egress compõe a sala (layout `speaker`, H.264 720p30) e carrega o MP4 para
   `recordings/<courseId>/<lessonId>/<sala>-<hora>.mp4` no bucket de vídeos.
4. O LiveKit chama `POST /webhooks/livekit` com `egress_started` / `egress_ended`.
   A API guarda o estado em `lesson_recording` e, no fim, **publica** a gravação
   em `lesson.videos` como vídeo do tipo `upload`.

Se o Egress não estiver a correr, a aula acontece na mesma — simplesmente não
fica gravada. Um gravador em baixo nunca impede uma aula.

## Ligar em desenvolvimento

O `docker-compose.livekit.yaml` traz três contentores: servidor, Redis e egress.

```bash
docker compose -f docker-compose.livekit.yaml up -d
```

Além disso a API precisa de armazenamento S3 configurado (`OBJECT_STORAGE_*`),
porque **é a API que envia as credenciais no pedido de gravação** — o
`docker/livekit/egress.yaml` não as tem. Sem isso, `isRecordingConfigured()`
devolve `false` e a gravação fica desligada (o painel na lição di-lo).

O Egress corre um Chrome para compor a sala: precisa de `SYS_ADMIN` e de
`shm_size: 1gb`, ambos já no compose.

## Controlo manual

O painel «Gravação da aula» na lição (só equipa do curso) mostra as gravações,
com botões para gravar/parar à mão — útil para uma aula que já ia a meio quando
alguém reparou que não estava a gravar — e para republicar uma gravação.

| Rota | O que faz |
| --- | --- |
| `GET /course/:id/livekit/:lessonId/recordings` | lista, com URL de leitura assinado |
| `POST .../recordings/start` | arranca a gravação de uma sala já a decorrer |
| `POST .../recordings/stop` | pára; o ficheiro chega pelo webhook |
| `POST .../recordings/:recordingId/publish` | volta a publicar na lição |

## Em produção

- O Egress tem de chegar ao servidor LiveKit e ao Redis, e o bucket S3 tem de
  ser alcançável a partir do contentor.
- Uma gravação de 3h a 720p ocupa na ordem dos 1,5–2 GB: contar com isso no
  armazenamento e na retenção.
- O Chrome do Egress é pesado (~2 CPUs por gravação em curso). Duas turmas ao
  mesmo tempo = dois processos.
