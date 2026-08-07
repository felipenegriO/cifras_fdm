# Preparação offline automática — Design

## Objetivo
Substituir o botão manual "Preparar para offline" por uma preparação transparente e automática do pacote offline completo (shell PWA + todas as músicas da banda), disparada a cada abertura do app, mas só executando o trabalho pesado quando o conteúdo realmente mudou. O botão manual passa a se chamar "Sincronizar" (unificando com o que já existe em `config.php`) e força a mesma rotina completa.

## Diagnóstico do estado atual
- `cifroSync.load(bandaId)` já roda em toda página (`index.php`, `music.php`, `roteiro.php`, `editorroteiro.php`, `editorplaylist.php`) e já sincroniza *dados* (músicas/playlists/roteiros/categorias) de forma automática e barata, usando `content_revision` para evitar downloads desnecessários.
- `cifroSync.markPrepared()` marca `snapshot_valid=true`/`prepared_at` no IndexedDB (`cifro_bandas`/`cifro_sync_meta`) **em todo sync de dados bem-sucedido**, mesmo quando o *shell* (assets do app + páginas de cada música) nunca foi cacheado via `PREPARE_OFFLINE`. Isso faz o status "Pronto para palco" mentir quando só os dados foram sincronizados, mas o pacote completo nunca rodou.
- A preparação do shell (`offline-tools.js:prepareShell()` → mensagem `PREPARE_OFFLINE` ao service worker → `preparePages()` busca `/index.php`, `/roteiro.php`, `/select-banda.php` e `/music.php?id=X` para cada música) só roda hoje no clique manual do botão.
- Assets estáticos (JS/CSS) já são cacheados automaticamente no evento `install` do service worker — não fazem parte do problema.

## Separação de conceitos: dados vs. shell
Introduzir um campo novo e independente no registro `cifro_bandas`: `shell_prepared_revision` (+ `shell_prepared_at`), atualizado **somente** quando a rotina completa de shell (`PREPARE_OFFLINE` + `navigator.storage.persist()`) termina com sucesso. O campo `content_revision`/`prepared_at`/`snapshot_valid` já existentes continuam representando apenas o estado dos *dados*.

`getSyncStatus()` passa a expor também `shellPreparedRevision` e `shellReady` (`shellPreparedRevision === contentRevision`). A UI ("Pronto para palco") passa a exigir `shellReady === true`, não só `snapshotValid`.

## Fluxo de disparo automático
1. `cifroSync.load()`/`sync()`, ao concluir (com ou sem mudança de dados), dispara `document.dispatchEvent(new CustomEvent('cifro:sync-checked', { detail: { bandaId, contentRevision } }))`.
2. `offline-tools.js` escuta `cifro:sync-checked`. Ao receber:
   - Se já existe uma preparação em andamento para aquela banda (dedupe por `Map<bandaId, Promise>`), não faz nada além de aguardar a existente.
   - Compara `shellPreparedRevision` salvo com `contentRevision` recebido.
   - Se iguais e não é a primeira vez (shell já foi preparado alguma vez) → não faz nada (sem requisição de rede).
   - Se diferentes, ou nunca preparado, ou `navigator.onLine === false` sem pacote válido prévio → dispara a rotina completa (`runFullPreparation`) em segundo plano, sem bloquear a UI.
3. `runFullPreparation(bandaId, { force })`:
   - Se offline: aborta silenciosamente (tenta de novo no próximo evento).
   - `prepareShell()` (mensagem ao SW, já existente).
   - `navigator.storage.persist()` (best-effort, não bloqueia falha).
   - Em sucesso: grava `shell_prepared_revision = contentRevision`, `shell_prepared_at = now`.
   - Em falha: não atualiza os campos (retry natural no próximo `cifro:sync-checked`), mostra **um** toast de aviso (`cifroToast(..., 'warning')`), sem repetir a cada tentativa automática subsequente na mesma sessão (flag em memória, resetada ao recarregar a página).

## Botão manual "Sincronizar"
- Renomear o botão do painel "Uso offline" (`offline-tools.js`) de "Preparar para offline" para "Sincronizar".
- Esse botão chama `runFullPreparation(bandaId, { force: true })` — ignora a comparação de revisão, sempre executa e mostra barra de progresso (comportamento visual já existente, mantido).
- O botão "Sincronizar" de `config.php` (hoje só chama `cifroSync.sync()`, dados apenas) passa a chamar a mesma função unificada `window.OfflineTools.forceSync(bandaId)`, garantindo que os dois pontos de entrada façam o mesmo trabalho completo.

## Tratamento de falhas e casos de borda
- **Primeira abertura sem rede**: não há pacote prévio; app funciona só com o que o service worker já cacheou (shell estático). `runFullPreparation` não roda offline; tenta na próxima abertura online.
- **Falha de rede no meio da preparação automática**: pacote anterior (se existir) permanece intacto — nada é apagado antes do novo pacote ser validado por completo (já garantido pela arquitetura do SW: `populateStatic`/`preparePages` só substituem cache após buscar todos os assets com sucesso).
- **Quota de armazenamento excedida / `storage.persist()` indisponível**: `persist()` é best-effort; falha nele não aborta a marcação de sucesso do shell (o pacote em si já foi cacheado, persist só evita eviction). Falha em `PREPARE_OFFLINE` (cache real) sim aborta e não marca sucesso.
- **Duas chamadas concorrentes** (automática disparada + clique manual simultâneo): dedupe por `Map<bandaId, Promise>` já usado no `sync()` do cifro-sync.js; reaplicado aqui.
- **Troca de banda**: `shell_prepared_revision` é armazenado por `banda_id`, cada banda mantém seu próprio estado independente.
- **Revisão mudou durante uma preparação em andamento**: a preparação em andamento continua e completa para a revisão que iniciou; o próximo `cifro:sync-checked` (ex.: próxima abertura) detecta a revisão mais nova e dispara outra rodada.

## Fora do escopo
- Cache incremental por música (decisão explícita: continua baixando o repertório completo).
- Novo gatilho por versão do app (decisão explícita: só revisão de conteúdo dispara refazer o pacote).
- Mudança na lógica de `populateStatic`/assets estáticos do service worker (já automática, fora do escopo).
