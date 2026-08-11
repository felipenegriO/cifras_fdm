# Offline, PWA e sincronização

## F-025 PWA

O service worker usa três caches com responsabilidades distintas: `cifro-static-*` para código, CSS, fontes e imagens versionados; `cifro-pages` para shells HTML autenticados; e `cifro-meta` apenas para o contexto local. Dados de domínio não são armazenados nesses caches.

Páginas de palco são armazenadas por usuário, banda e URL completa. A preparação inclui cada cifra da banda, impedindo que HTML de outra banda seja reutilizado. Respostas redirecionadas, HTML de login e conteúdo com tipo incorreto são rejeitados. APIs e endpoints de escrita nunca são interceptados.

O registro do service worker é centralizado em `script.js`. As mensagens suportadas são `SET_CONTEXT`, `CLEAR_CONTEXT`, `PREPARE_OFFLINE` e `SKIP_WAITING`. Não existem mais limpezas destrutivas em eventos `ONLINE` ou verificações diárias.

## F-026 Dados offline

O IndexedDB `cifro`, versão 6, armazena os dados de domínio e separa cada registro por `user_id:banda_id`:

- `cifro_bandas`;
- `cifro_musicas`;
- `cifro_playlists`;
- `cifro_roteiros`;
- `cifro_categorias`;
- `cifro_sync_meta`;
- `cifro_snapshot_current`;
- `cifro_snapshot_previous`.

A leitura é cache-first. O snapshot local é renderizado antes da rede. A revisão da banda é consultada após a janela de 30 segundos, na reconexão, no retorno do segundo plano, na troca de banda ou por ação manual. Quando `content_revision` mudou, o cliente tenta `/api/sync/changes.php`; se a revisão não puder ser atendida, baixa o snapshot completo por `/api/sync/data.php`.

Músicas, playlists, roteiros, categorias e metadata são persistidos em uma única transação IndexedDB. Banda, revisão, arrays e estrutura mínima dos registros são validados antes da gravação. Erros, timeout ou respostas inválidas mantêm o snapshot anterior.

POSTs de conteúdo enviam `baseRevision`. Respostas bem-sucedidas atualizam diretamente a store afetada e a revisão local. Conflitos retornam HTTP 409 e não sobrescrevem alterações mais novas.

## Preparação e bandas

O botão de preparação sincroniza a banda, valida o shell, solicita armazenamento persistente e só então grava `prepared_at` e `snapshot_valid`. A seleção offline aceita somente bandas preparadas. Ao reconectar, a seleção é confirmada no servidor antes de nova sincronização.

O conteúdo preparado continua legível se a sessão HTTP expirar. Acesso local só é removido depois de uma negativa confirmada pelo servidor.

## Regras

- Cadastros e alterações exigem conexão.
- Transposição `+` e `-` é visual, local e não persistente.
- A cifra aberta não é substituída silenciosamente; uma revisão remota exibe aviso para reabertura.
- Live usa rede somente quando o usuário entra como líder ou seguidor.
- Sem conexão não há chamadas de conteúdo.

## Testes

O projeto Playwright `pwa` habilita service worker real e cobre pacote limpo, modo avião, Home, cifra, duas bandas, reinício, sessão expirada, Wi-Fi lento, cache interrompido, assets com query, snapshot inválido, revisão igual/diferente, acesso cruzado, atualização remota e Wake Lock.
