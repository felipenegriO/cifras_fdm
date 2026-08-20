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
| API-010 | `POST /src/backend/editor/api.php` | Gestor + CSRF | música (inclui `transposicao_instrumento`, inteiro de −12 a 12) ou ações `copy`, `delete` | `ok`, `id` |
| API-020 | `POST /src/backend/editor/import.php` | Gestor + CSRF | `url` de origem permitida | `ok`, `title`, `artist`, `content`, `metadata`, `source` |
| API-021 | `POST /src/backend/users/preferencia-musica.php` | Autenticado + CSRF + banda atual | `musica_id` e `transposicao_instrumento`, ou `acao` = `remover` \| `manter` | `sucesso`, `preferencia` |

API-021 **não** altera `band_sync_state`: personalização é dado do usuário, e subir a revisão da banda invalidaria o cache offline de todos os integrantes. A `base` gravada vem sempre do cadastro lido no servidor — aceitá-la do cliente permitiria forjar um estado "sem conflito". Escritas feitas offline ficam numa fila local e sobem quando a conexão volta.

Em API-020, `metadata` traz `tom` (string ou nulo), `capo` (**inteiro de 1 a 12, ou nulo**, já normalizado a partir de textos como "Capotraste na 2ª casa") e `afinação`. O `content` volta como as **formas** escritas na origem: quem decide subir para o tom soante é o preview do editor, mediante confirmação.
| API-011 | `POST /src/backend/editor/salvar_playlists.php` | Gestor + CSRF | conjunto de playlists | `sucesso` |
| API-012 | `POST /src/backend/editor/salvar_roteiros.php` | Gestor + CSRF | roteiro e ação | `ok`, `id` |
| API-013 | `POST /api/live/host.php` | Autenticado + CSRF | `salaId` | `success`, `hostId` |
| API-014 | `GET /api/live/status.php` | Autenticado | `salaId` | estado Live |
| API-015 | `POST /api/live/update.php` | Gestor + CSRF | host, página, cifra e rolagem | estado atualizado |
| API-016 | `GET /api/sync/version.php` | Autenticado | Banda atual da sessão | `banda_id`, `content_revision` |
| API-017 | `GET /api/sync/data.php` | Autenticado | Banda atual da sessão | `banda_id`, `content_revision`, músicas, categorias, playlists, roteiros, `preferencias_musica` e plano |
| API-018 | `GET /api/sync/changes.php?since=<revisão>` | Autenticado | Banda atual da sessão e revisão conhecida | delta por entidade ou `full_sync_required` |
| API-018 | `POST /api/stripe/webhook.php` | Assinatura Stripe | evento Stripe bruto | `received` |
| API-019 | `POST /src/backend/download-yt-audio.php` | Autenticado | URL/ID do vídeo | sucesso ou erro e áudio |
| API-020 | `GET /src/backend/categorias/api.php` | Gestor | - | `ok`, `categorias` |
| API-021 | `POST /src/backend/categorias/api.php` | Gestor + CSRF | categoria ou ação `delete` | `ok`, `id` |
| API-022 | `GET /api/help/article.php?id=<id>` | Autenticado; ajuda ativa | identificador do artigo | `ok`, `article` |
| API-023 | `POST /api/help/event.php` | Autenticado + CSRF; ajuda ativa | `event`, `article` opcional | `204 No Content` |
| API-024 | `GET /api/auth/status.php` | Público | - | `ok`, `autenticado` |
| API-025 | `POST /api/account/logout-all.php` | Autenticado + CSRF | - | `ok`, `revogado` |
| API-026 | `GET/POST /api/bandas/convite.php` | Administrador (POST + CSRF) | `GET`: -; `POST`: `action` = `gerar` \| `revogar` | `GET`/ambos: `estado`; `POST gerar`: `caminho`, `banda_nome` |

## Login persistente ("lembrar-me")

O login sobrevive ao fechamento do navegador por meio de um cookie próprio,
separado do `PHPSESSID`:

- **Cookie `cifro_lembrar`** — formato `seletor:validador`, validade de 1 ano,
  `HttpOnly`, `SameSite=Lax`, `Secure` sob HTTPS. Emitido no login.
- **Tabela `auth_tokens`** — guarda apenas o SHA-256 do validador; o valor em
  claro só existe no cookie do usuário.
- **Rotação** — o validador é trocado a cada uso. O anterior continua aceito por
  60 segundos (`AuthTokenService::JANELA_CONCORRENCIA_SEGUNDOS`), porque o
  navegador dispara requisições concorrentes com o mesmo cookie; sem essa janela
  a segunda requisição pareceria um cookie clonado.
- **Detecção de roubo** — um validador que não bate nem com o atual nem com o
  anterior dentro da janela revoga *todos* os tokens do usuário.
- **Revogação** — `POST /api/account/logout-all.php` (botão "Sair de todos os
  aparelhos" em `config.php`), `logout.php` (só o aparelho atual), a troca de
  senha (todos) e qualquer tentativa de entrar com conta desativada ou vencida.
- **Barreiras de conta** — o token não é atalho: `AuthService::motivoParaRecusarConta()`
  aplica as mesmas regras do login por senha (ativo, validade, externo sem
  validade). Conta recusada tem os tokens revogados na hora.
- **Expiração** — a coluna `expira_em` vale no servidor, não só no cookie. Tokens
  vencidos não autenticam e são varridos na emissão seguinte.
- **Prefixo `__Host-`** — sob HTTPS o cookie se chama `__Host-cifro_lembrar`, o que
  impede um subdomínio de plantar um cookie de mesmo nome. Os dois nomes são
  aceitos na leitura para não deslogar quem já tinha o cookie antigo.
- **Sair exige POST + CSRF** — `GET /logout.php` mostra uma confirmação em vez de
  deslogar, para que um link de terceiro não force o logout (que hoje custaria
  redigitar a senha).
- **Token CSRF renovado** — quando a sessão é recriada pelo token, o CSRF que a aba
  guardou fica velho; `cifro-csrf.js` detecta o 403, busca um token novo e repete
  o POST uma vez, em vez de exigir reload manual.

`GET /api/auth/status.php` existe para o cliente distinguir "sem sessão" de "sem
rede": responde sempre 200 e nunca redireciona. Quando a sessão caiu mas há
conteúdo offline salvo, o app mostra um aviso e mantém as cifras na tela em vez
de mandar o músico para o login no meio de um culto.

## Convite de banda por link (API-026)

`GET/POST /api/bandas/convite.php` exige `require_band_role('administrador')` nos dois métodos; o `POST` exige também `require_csrf()`. Três formatos de resposta:

- **`GET`** — estado atual, sem side effect: `{ "ok": true, "sucesso": true, "estado": { "ativo": bool, "validade"?: "17/08 às 19h32", "usos"?: n } }`. `estado.ativo` é `false` quando não há convite vivo.
- **`POST { "action": "gerar" }`** — `{ "ok": true, "sucesso": true, "caminho": "/convite.php?t=...", "banda_nome": "...", "estado": {...} }`. `caminho` é relativo — quem monta a URL absoluta é o JavaScript com `window.location.origin`, para o link apontar para o host que o administrador está usando de fato, e não para o `APP_URL` do servidor.
- **`POST { "action": "revogar" }`** — `{ "ok": true, "sucesso": true, "estado": { "ativo": false } }`. Derruba todos os convites vivos da banda de uma vez.

Erros:

- **403 `plano_limit`** — só em `action: 'gerar'`, via `cifro_require_plan_limit('users', ...)`: a banda já está no teto de usuários do plano. Barrado na geração para o administrador descobrir o limite antes de compartilhar o link, e reconferido no aceite (ver [Segurança](seguranca-e-permissoes.md)) para fechar a corrida de quem clica durante a janela de 24h.
- **422** — `action` ausente ou diferente de `gerar`/`revogar`.
- **403** (CSRF ou perfil) e **405** (método fora de `GET`/`POST`) seguem as convenções gerais abaixo.

O aceite em si não passa por este endpoint: é `POST /convite.php` (página, não API), com CSRF e o token do formulário — nunca `GET`, para que prefetch de navegador e pré-visualização de link (o WhatsApp abre todo link que passa por ele) não vinculem ninguém à banda.

## Convenções de erro

- 400: JSON ou payload inválido.
- 401: autenticação ausente ou sessão expirada.
- 403: CSRF, permissão ou limite de plano.
- 405: método não permitido.
- 422: validação semântica.
- 500: falha interna ou configuração ausente.

Há contratos legados misturando `ok`/`error` e `sucesso`/`mensagem`; consumidores devem respeitar o formato de cada endpoint até uma migração versionada.

## Observabilidade do Google OAuth

Toda saída com `login.php?erro=google` grava um registro em `app_error_logs` com a referência `api/auth/google/callback.php`. `detalhes` contém `exception`, `message`, `reason` e `request_id`, além de indicadores sem os valores de `state`, `code`, token ou segredo. Falhas de state, código ausente e cancelamento são registradas como `warning`; troca de token, validação e criação de sessão são registradas como `error`.
