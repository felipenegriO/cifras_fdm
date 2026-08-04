# Login/cadastro com Google — Design

Data: 2026-08-01.

## Objetivo

Permitir que usuários entrem no Cifrô ou criem conta usando "Continuar com
Google", além do fluxo atual de e-mail/senha (que continua existindo, sem
mudanças).

## Escopo

- Botão "Continuar com Google" nas telas `login.php` e `register.php`.
- Login: se o e-mail retornado pelo Google já existe na tabela `usuarios`,
  autentica nessa conta.
- Cadastro: se o e-mail não existe, cria conta + banda nova, mesmo fluxo do
  `RegisterController::handle()` atual (uma banda gratuita, usuário como
  administrador), exceto que a conta já nasce **ativa** (sem token de
  ativação por e-mail — o Google já validou o e-mail).
- Vinculação automática por e-mail: se um usuário com senha local usa o
  Google com o mesmo e-mail, loga direto nessa conta (sem exigir senha).
- Fora de escopo: desvincular conta Google, múltiplas contas Google por
  usuário, login com outros provedores (Facebook, Apple, etc).

## Arquitetura

Fluxo OAuth 2.0 Authorization Code, implementado com chamadas HTTP diretas
(sem lib `google/apiclient` — evita dependência Composer nova; usa o mesmo
padrão de `file_get_contents`/`stream_context_create` já usado em
`download-yt-audio.php`).

### Componentes novos

**`public/api/auth/google/start.php`**
Gera um `state` aleatório (32 bytes, `bin2hex`), grava em
`$_SESSION['google_oauth_state']`, redireciona (`header('Location: ...')`)
para `https://accounts.google.com/o/oauth2/v2/auth` com `client_id`,
`redirect_uri`, `response_type=code`, `scope=openid email profile`, `state`.

**`public/api/auth/google/callback.php`**
1. Valida `$_GET['state']` contra `$_SESSION['google_oauth_state']`; se não
   bater, erro 403 e redireciona para `/login.php?erro=google`.
2. Troca `$_GET['code']` por tokens via POST em
   `https://oauth2.googleapis.com/token`.
3. Valida o `id_token` (JWT) retornado: verifica assinatura contra as
   chaves públicas do Google (`https://www.googleapis.com/oauth2/v3/certs`,
   cacheadas em arquivo local por até 1h), `aud` (client id), `iss`
   (`accounts.google.com` ou `https://accounts.google.com`), `exp`.
4. Extrai `sub` (ID estável do Google), `email`, `email_verified`, `name`,
   `picture` do payload do `id_token`.
5. Rejeita se `email_verified` for `false`.
6. Delega para `GoogleAuthService` (novo, ver abaixo) a lógica de
   login-ou-cadastro.
7. Em sucesso, delega para o mesmo `AuthController::finalizeLogin()` já
   existente (monta sessão, escolhe banda, redireciona) — reaproveitado,
   não duplicado.

**`GoogleAuthService`** (`public/src/Services/GoogleAuthService.php`)
Classe de serviço pura na lógica de decisão, testável com PHPUnit
(dependências de rede injetáveis, como fiz em `YoutubeAudioDownloadService`):
- `exchangeCodeForIdToken(string $code): string` — chama o endpoint de
  token do Google.
- `verifyIdToken(string $idToken): array` — verifica assinatura/claims,
  retorna payload decodificado.
- `resolveOrCreateUser(array $googlePayload): array` — dado
  `sub`/`email`/`name`, busca usuário por `google_sub`, depois por `email`
  (linka `google_sub` se achar por e-mail), senão cria conta+banda nova
  (reaproveita `UserRepository`/`BandaRepository`, mesma lógica do
  `RegisterController`).

**`GoogleJwtVerifier`** (`public/src/Services/GoogleJwtVerifier.php`)
Verificador JWT mínimo (RS256) sem dependência externa: decodifica
header/payload base64url, busca a chave pública correspondente ao `kid` no
JWKS do Google (cacheado), verifica assinatura com `openssl_verify`.

### Banco de dados

Nova coluna em `usuarios`:

```sql
ALTER TABLE usuarios ADD COLUMN google_sub VARCHAR(255) DEFAULT NULL,
  ADD UNIQUE KEY uq_google_sub (google_sub);
```

`UserRepository` ganha `findByGoogleSub(string $sub): ?array` e
`linkGoogleSub(string $userId, string $sub): void`.

### Config

Novas chaves em `.env` / `.env.example`:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://cifro.online/api/auth/google/callback
```
Se `GOOGLE_CLIENT_ID` estiver vazio, o botão "Continuar com Google" fica
oculto nas views (mesmo padrão usado para o Stripe em `plano.php`, que já
esconde os cards quando não configurado).

### UI

Botão "Continuar com Google" (ícone + texto) acima do formulário de
e-mail/senha em `login.php` e `register.php`, com `href="/api/auth/google/start.php"`
(link simples, sem JS necessário).

## Tratamento de erros

- `state` inválido/ausente → volta pro login com mensagem genérica de erro
  (não vaza detalhe de CSRF).
- Token exchange falha (rede, código inválido/expirado) → mensagem "Não foi
  possível continuar com o Google. Tente novamente."
- `id_token` com assinatura inválida ou `email_verified=false` → mesma
  mensagem genérica, log interno com o motivo real.
- E-mail do Google já usado por conta bloqueada/inativa → segue as mesmas
  regras de `AuthService::authenticate()` já existentes (cifro_check_plano,
  etc.) — nenhuma lógica nova aqui.

## Testes

- `GoogleJwtVerifierTest`: assinatura válida/inválida, `exp` vencido, `aud`
  errado, `iss` errado — tokens de teste assinados com chave RSA gerada
  no próprio teste (sem chamar o Google de verdade).
- `GoogleAuthServiceTest`: `resolveOrCreateUser` cobrindo os 3 casos
  (usuário achado por `google_sub`, achado por e-mail e linkado, criado do
  zero) com `UserRepository`/`BandaRepository` mockados.
- Playwright: fluxo de callback mockado via `page.route()` interceptando as
  chamadas para `accounts.google.com`/`oauth2.googleapis.com` (não é
  possível testar o consent screen real do Google em CI).

## Fora de escopo desta spec

- Migração de dados/rollback do schema em produção (feito manualmente pelo
  usuário via script SQL, não automatizado).
- Botão de "logout do Google" separado (o logout existente do Cifrô já
  basta — só encerra a sessão local, não revoga o token do Google).
