# Bandas e usuários

## F-006 Seleção de banda

`/select-banda.php` lista vínculos do usuário. POST em `/src/backend/bandas/selecionar.php` valida autenticação, CSRF, existência e vínculo; master pode selecionar qualquer banda. A sessão `banda_atual` recebe ID, nome, papel, plano e logo.

## F-007 Criação de banda

POST em `/api/bandas/criar.php` aceita nome de até 120 caracteres. O usuário criador é vinculado como administrador. O limite considera quantas bandas ele administra e o plano da banda atual.

## F-008 Administração global

`/bandas.php` é exclusiva de master. Permite listar, criar, editar, excluir, ativar/desativar e definir plano via `/src/backend/bandas/salvar_banda.php`.

## F-009 Membros

Administrador da banda pode listar membros, criar ou editar, importar usuário existente, procurar usuários externos, remover vínculo e reenviar convite. Um membro não pode remover a si próprio. Perfis aceitos: `administrador`, `gestor`, `basico`.

Campos: nome, username, e-mail opcional, senha opcional, atividade, validade e papel na banda. Username aceita letras, números, ponto, hífen e underscore.

## F-010 Preferências

Cada usuário possui `config` JSON. `/config.php` exibe preferências e `/src/backend/users/salvar_config.php` mescla alterações no JSON existente e atualiza a sessão.

## Fontes e testes

- Código: `BandaRepository`, `UserRepository`, `select-banda.php`, `editorbandas.php`, `editoruser.php`.
- E2E: `05-config`, `06-usuarios`, `07-bandas`, `15-select-banda`, `16-config-api`, `21-bandas-limite`, `22-multiband-flow`, `23-perfis-permissoes`.
