# Referência de API

Todas as respostas são JSON, salvo endpoints de página. `CSRF` significa header `X-CSRF-Token` ou campo `csrf_token`.

| ID | Método e rota | Acesso | Entrada principal | Saída principal |
|---|---|---|---|---|
| API-001 | `GET /api/csrf.php` | Autenticado | - | `csrf_token` |
| API-002 | `POST /api/bandas/criar.php` | Autenticado + CSRF | `nome` | `ok`, `id`, `nome` |
| API-003 | `POST /src/backend/bandas/selecionar.php` | Autenticado + CSRF | `bandaId` | `sucesso` |
| API-004 | `GET /src/backend/bandas/salvar_banda.php` | Master | - | lista de bandas |
| API-005 | `POST /src/backend/bandas/salvar_banda.php` | Master + CSRF | banda; ações `save`, `delete`, `toggle_plano` | `sucesso`, `id` |
| API-006 | `GET /src/backend/users/salvar_user.php` | Administrador | - | membros da banda |
| API-007 | `POST /src/backend/users/salvar_user.php` | Administrador + CSRF | usuário; ações `save`, `search`, `import`, `delete`, `resend_invite` | `sucesso`, `id` |
| API-008 | `POST /src/backend/users/salvar_config.php` | Autenticado + CSRF | objeto de configuração | `sucesso` |
| API-009 | `GET /src/backend/editor/api.php` | Gestor | - | músicas da banda |
| API-010 | `POST /src/backend/editor/api.php` | Gestor + CSRF | música ou ações `copy`, `delete` | `ok`, `id` |
| API-011 | `POST /src/backend/editor/salvar_playlists.php` | Gestor + CSRF | conjunto de playlists | `sucesso` |
| API-012 | `POST /src/backend/editor/salvar_roteiros.php` | Gestor + CSRF | roteiro e ação | `ok`, `id` |
| API-013 | `POST /api/live/host.php` | Autenticado + CSRF | `salaId` | `success`, `hostId` |
| API-014 | `GET /api/live/status.php` | Autenticado | `salaId` | estado Live |
| API-015 | `POST /api/live/update.php` | Gestor + CSRF | host, página, cifra e rolagem | estado atualizado |
| API-016 | `GET /api/sync/version.php` | Autenticado | Banda atual da sessão | `banda_id`, `content_revision` |
| API-017 | `GET /api/sync/data.php` | Autenticado | Banda atual da sessão | `banda_id`, `content_revision`, músicas, categorias, playlists, roteiros e plano |
| API-018 | `GET /api/sync/changes.php?since=<revisão>` | Autenticado | Banda atual da sessão e revisão conhecida | delta por entidade ou `full_sync_required` |
| API-018 | `POST /api/stripe/webhook.php` | Assinatura Stripe | evento Stripe bruto | `received` |
| API-019 | `POST /src/backend/download-yt-audio.php` | Autenticado | URL/ID do vídeo | sucesso ou erro e áudio |
| API-020 | `GET /src/backend/categorias/api.php` | Gestor | - | `ok`, `categorias` |
| API-021 | `POST /src/backend/categorias/api.php` | Gestor + CSRF | categoria ou ação `delete` | `ok`, `id` |

## Convenções de erro

- 400: JSON ou payload inválido.
- 401: autenticação ausente ou sessão expirada.
- 403: CSRF, permissão ou limite de plano.
- 405: método não permitido.
- 422: validação semântica.
- 500: falha interna ou configuração ausente.

Há contratos legados misturando `ok`/`error` e `sucesso`/`mensagem`; consumidores devem respeitar o formato de cada endpoint até uma migração versionada.
