# Cifrô — Cifras

App SaaS para bandas gerenciarem cifras, roteiros (setlists) e apresentações ao vivo.
Multi-banda, multi-usuário, com plano gratuito limitado e planos pagos.

## Funcionalidades

- **Cifras** — editor e visualização de músicas com transposição de tom
- **Roteiros** — organização de setlists para shows
- **Modo Live** — o host controla a música atual e os demais membros acompanham em tempo real
- **Modo Ensaio** — áudio do YouTube ou upload local, waveform, loop A/B e mudança de pitch (ver [REHEARSAL_README.md](REHEARSAL_README.md))
- **Multi-banda** — usuários podem pertencer a várias bandas, com perfis (master / administrador / gestor / básico)
- **PWA offline** — service worker + manifest
- **Billing** — Stripe Payment Links + webhook (checkout, renovação, cancelamento)

## Stack

- **Backend**: PHP 8+ sem framework (Controllers / Repositories / Services em `public/src/`), MySQL via PDO
- **Frontend**: JS vanilla, CSS próprio
- **E-mail**: PHPMailer via SMTP (Hostinger)
- **Testes**: Playwright (E2E) + PHPUnit (unitários)

## Setup local

Pré-requisitos: PHP 8+ com pdo_mysql (ex.: XAMPP), MySQL, Node.js.

```bash
# 1. Dependências
composer install          # PHPMailer + PHPUnit (vendor/ na raiz)
npm install               # Playwright

# 2. Configuração
cp .env.example .env      # preencher DB_*, MAIL_*, STRIPE_*

# 3. Banco de dados
# criar o banco e executar public/create_tables.sql
# (ou usar scripts/setup/setup_db.php — NUNCA deixar em public/ em produção)

# 4. Servidor de desenvolvimento
npm run serve             # php -S localhost:8090 -t public
```

## Testes

```bash
npm run test:e2e          # suíte Playwright completa (sobe o servidor sozinho; precisa do MySQL ativo)
npx playwright test --project=cifro   # apenas a suíte principal
composer test             # PHPUnit
```

A suíte E2E usa `C:/xampp/php/php.exe` (ver `playwright.config.js`) e autentica uma vez
no projeto `setup`, salvando o estado em `tests/.auth/`.

## Estrutura

```
public/               # document root
  api/                # endpoints JSON (live, stripe, sync, bandas, csrf)
  src/
    Controllers/      # roteamento das páginas
    Repositories/     # acesso a dados (PDO, prepared statements)
    Services/         # Auth, Mail, Database, Validator, LiveState
    Views/            # templates PHP
    backend/          # endpoints legados + bootstrap (sessão, CSRF, headers)
  create_tables.sql   # schema MySQL
scripts/setup/        # scripts de migração/diagnóstico (NÃO fazer deploy destes)
tests/cifro/       # suíte E2E principal (23 specs)
tests/php/            # testes unitários PHPUnit
```

## Deploy (Hostinger)

### 1. Subir os arquivos

Via **File Manager do Hostinger** ou **FTP** (FileZilla etc.):

- Copie o conteúdo de `public/` para `public_html/` do seu domínio.
- Copie a pasta `vendor/` para **um nível acima** de `public_html/` (raiz do projeto no servidor) — o `MailService` espera `vendor/` nesse caminho.
- **Não sobe**: `node_modules/`, `tests/`, `docs/`, `coverage/`, `scripts/`, arquivos `.env` locais, `*.spec.js`, `playwright*`, `composer.phar`, arquivos de debug.

### 2. Configurar o `.env`

Crie o arquivo `.env` na **raiz do projeto no servidor** (fora de `public_html/`). Use `.env.example` como base e preencha:

```
DB_HOST=srv1576.hstgr.io
DB_USER=u925167420_cifroadmin
DB_PASS=<sua senha>
DB_NAME=u925167420_cifro

APP_ENV=production
APP_DEBUG=false
APP_URL=https://seudominio.com.br

ENCRYPTION_KEY=<chave aleatória de 32 chars>
CSRF_TOKEN_LIFETIME=300

MAIL_HOST=smtp.hostinger.com
MAIL_PORT=465
MAIL_USER=noreply@cifro.online
MAIL_PASS=<senha do email>
MAIL_FROM_NAME=Cifrô

PAYMENT_PIX_PHONE=55019982594834
PAYMENT_WHATSAPP_PHONE=55019982594834
PAYMENT_PIX_RECIPIENT=Felipe Negri de Oliveira
```

Stripe: deixe em branco até configurar as chaves de produção (ver seção Stripe abaixo).

### 3. Criar/migrar o banco de dados

**Primeira vez (banco vazio):** suba temporariamente `scripts/setup/setup_db.php` para `public_html/setup_db.php`, acesse via browser e **remova o arquivo imediatamente** após executar:

```
https://seudominio.com.br/setup_db.php
```

**Banco já existente (atualização de estrutura):** suba apenas a migration necessária da pasta `scripts/setup/`, acesse via browser e remova logo após:

| Migration | Quando usar |
|---|---|
| `migrate_planos.php` | Alterações na tabela de planos/bandas |
| `migrate_privacy.php` | Campos de aceite de termos/privacidade |
| `migrate_stripe_events.php` | Tabelas de idempotência do webhook Stripe |
| `migrate_performance_indexes.php` | Índices de performance (pode rodar a qualquer momento) |

> **Nunca deixe scripts de setup/migração acessíveis em produção após executar.**

### 4. Criar pasta do modo ensaio

Via File Manager do Hostinger, dentro de `public_html/`:
- Criar pasta: `rehearsal-audio/`
- Permissões: `755`

### 5. Configurar Stripe (quando disponível)

Adicione ao `.env`:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MENSAL=price_...
STRIPE_PRICE_SEMESTRAL=price_...
STRIPE_PRICE_ANUAL=price_...
```

Configure o webhook no Stripe Dashboard apontando para:

```
https://seudominio.com.br/api/stripe/webhook.php
```

Eventos necessários: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`.

### 6. Verificar após o deploy

- Login e cadastro funcionando
- Criar uma música e abrir o editor
- Abrir modo ensaio com upload de áudio local (teste mais simples)
- Acessar `/plano.php` e verificar que o PIX aparece (se configurado)
- Console do browser sem erros (`F12 → Console`)

Ver também [HOSTINGER_SETUP.md](HOSTINGER_SETUP.md) (detalhes específicos do Modo Ensaio / YouTube).
