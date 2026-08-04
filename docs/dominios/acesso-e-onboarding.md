# Acesso e onboarding

## F-001 Landing

`/landing.php` apresenta proposta, funcionalidades, preços e CTAs. Usuário já autenticado é redirecionado para `/index.php`.

## F-002 Login e sessão

O login aceita username e senha. `AuthService` valida usuário ativo e hash. Após autenticação, a sessão é regenerada, recebe os dados do usuário e suas bandas. Uma banda leva direto ao app; várias bandas levam à seleção. Logout limpa sessão e cookie.

Erros cobrem credenciais inválidas, usuário inativo, validade vencida e excesso de tentativas. `APP_DEBUG` habilita diagnóstico de autenticação e não deve estar ativo em produção.

## F-003 Cadastro

Campos: nome, e-mail e nome da banda. O username deriva da parte anterior a `@`. Em uma transação são criados usuário inativo, banda no plano gratuito, vínculo como administrador e token de 48 horas. O e-mail de boas-vindas contém o link de ativação.

Validações: campos obrigatórios, e-mail válido, duplicidade e limite de cinco tentativas em cinco minutos por sessão.

## F-004 Ativação

`/definir-senha.php?token=...` valida token sem consumi-lo no GET. No POST, exige CSRF, senha mínima de seis caracteres e confirmação idêntica. O token é consumido uma vez, o usuário é ativado e entra automaticamente.

## F-005 Recuperação

`/esqueci-senha.php` aceita e-mail ou username. Quando existe e possui e-mail, cria token de uma hora e envia mensagem. A resposta pública é genérica para evitar enumeração. `/reset-senha.php` consome o token, altera o hash e limpa a sessão.

## Fontes e testes

- Código: `AuthController`, `RegisterController`, `AuthService`, `UserRepository`, `MailService`.
- E2E: `01-public.spec.js`, `10-seguranca.spec.js`, `14-senha-reset.spec.js`, `24-onboarding.spec.js`.
- Unitários: `AuthServiceTest.php`, `UserRepositoryTest.php`, `ValidatorTest.php`.
