# Modo Live

## Objetivo

Sincronizar a cifra e a posição de rolagem apresentadas por um host com os demais integrantes da mesma banda.

## F-019 Host

Gestor ou superior assume o host por POST `/api/live/host.php`. O servidor gera `hostId` e registra identidade do usuário. O browser guarda o ID em `localStorage` por sala/banda e o modo da aba em `sessionStorage`.

## F-020 Seguidor

Qualquer usuário autenticado pode seguir. O cliente consulta `/api/live/status.php` a cada 1,8 segundo. Ao detectar nova versão ou página, navega para a cifra do host. Na mesma página, aplica o percentual de rolagem.

## F-021 Publicação

O host envia keep-alive a cada 10 segundos e rolagem a cada 700 ms para `/api/live/update.php`. Apenas páginas `music.php` com ID numérico são publicadas como cifra. O estado inclui página, cifra, rolagem absoluta, percentual e capacidade de sincronizar.

## Estado e falhas

`live_state` é único por banda. O serviço expõe host ativo, identidade, página, cifra, rolagem, horário e versão. Perda de rede mantém a interface e mostra último contato; ao reconectar, host publica novamente e seguidor volta a consultar.

## Segurança

- Status: autenticado, leitura.
- Assumir host: autenticado e CSRF.
- Atualizar: autenticado, CSRF e papel mínimo gestor.
- Sala efetiva deve ser a banda atual.

## Legado

`livePlayerLer.php` e `livePlayerSalvar.php` permanecem cobertos para compatibilidade.

## Testes

`09-sync-api.spec.js`, `13-live-mode.spec.js`, `22-multiband-flow.spec.js`, `23-perfis-permissoes.spec.js`.

