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

1. `composer install --no-dev` e enviar o projeto com `vendor/` (o MailService espera `vendor/` na raiz, um nível acima do document root)
2. Document root → `public/`
3. Criar `.env` na raiz (fora do document root) com todas as chaves de `.env.example`
4. Configurar o webhook do Stripe apontando para `/api/stripe/webhook.php`
5. **Não enviar**: `scripts/`, `tests/`, `node_modules/`, arquivos de debug

Ver também [HOSTINGER_SETUP.md](HOSTINGER_SETUP.md) (específico do Modo Ensaio).
