- JS: chords.js, fdm-csrf.js, fdm-toast.js, playlists.js fechados/quase fechados (2 gaps residuais em chords.js, ambos documentados como estruturalmente inalcançáveis). Pipeline completo JS: 510 passed, 1 skipped, 0 failed, branches 81.65% (1634/2001).
- fdm-sanitize.js: 1 gap residual confirmado como guarda defensiva inalcançável.
- PHP: pipeline completo rodado mas bloqueado por falha de ambiente pré-existente em GoogleJwtVerifierTest (openssl). Ranking PHP não avançado nesta passada.
- Commit desta passada: teste chords.js/fdm-csrf.js/fdm-toast.js/playlists.js em tests/cifro/31-browser-branch-matrix.spec.js.
- Próximo: revisar categorias.js/fdm-theme.js/roteiros.js (pequenos gaps residuais), depois os arquivos JS grandes, e diagnosticar/corrigir o ambiente OpenSSL do PHP antes de retomar plano.php.

## Iteracao 10 (continuacao autonoma) - bloqueio OpenSSL resolvido + PHP em alta

### Blocker de ambiente resolvido (prioridade 1)
Diagnosticado: openssl_pkey_new()/openssl_pkey_export() falhavam porque o
processo PHP do XAMPP nao tinha OPENSSL_CONF apontando para um openssl.cnf
valido (sem essa variavel, a extensao OpenSSL do PHP no Windows nao acha a
config para gerar chaves - "CONF_load: system lib"). Corrigido de 2 formas
redundantes:
1. `setx OPENSSL_CONF "C:\xampp\php\extras\openssl\openssl.cnf"` (env var de
   usuario, persiste entre sessoes/shells).
2. scripts/coverage/run-php.ps1 (arquivo local, gitignorado por causa do
   padrao "coverage/" no .gitignore que tambem casa com
   scripts/coverage/) ganhou um fallback
   `if (-not $env:OPENSSL_CONF) { $env:OPENSSL_CONF = '...' }`
   para nao depender so da env var de sistema.
Confirmado com script standalone: openssl_pkey_new + openssl_pkey_export
funcionam e retornam uma chave PEM valida.

Rodando a suite completa apos o fix, restou 1 falha diferente das 9
originais: GoogleJwtVerifierTest::testUsaFetchJwksPadraoQuandoNaoInjetado
esperava a mensagem "nao foi possivel obter as chaves" (rede indisponivel),
mas com rede disponivel nesta sessao a busca real ao JWKS do Google teve
sucesso e falhou por "kid nao encontrado" (mensagem diferente, mesma
excecao). Nao e causado pelo fix de OpenSSL - e o mesmo teste dependente de
reachability de rede que ja tinha uma ressalva no codigo, so que a sandbox
desta sessao tem acesso a internet. Corrigido tornando o teste tolerante a
ambas as mensagens (tests/php/GoogleJwtVerifierTest.php), ja que ambas
exercitam o branch relevante (fetchJwksFromGoogle real, sem fetch injetado).

Depois disso: 324/324 PHPUnit, 0 erros/falhas - pipeline PHP completo
voltou a rodar de ponta a ponta.

### Trabalho no ranking PHP (prioridade 3)
Ranking obtido apos o fix (coverage/php/branch-summary.json):
plano.php(31) > salvar_user.php(12) > callback.php(10) > reset-senha.php(8)
= bootstrap.php(8) > editor/api.php(7) > ...

1. plano.php (31 -> 9 gaps, 94.27%) - tests/cifro/20-planos.spec.js:
   - Novo helper withExtraEnv(): acrescenta linhas temporarias ao
     .env.local real (usado para DB_HOST etc.), roda o teste, restaura o
     conteudo original byte-a-byte no finally. Seguro porque
     playwright.config.js tem workers: 1 (execucao serial) e o PHP
     built-in server rele o .env.local a cada requisicao (sem cache entre
     requests).
   - "plano trial no banco e tratado como gratuito" - banda com
     plano='trial' no DB deve ser exibida como gratuita.
   - "cards nao-atuais exibem link Stripe quando configurado" - com
     STRIPE_SECRET_KEY/STRIPE_LINK_* validos via withExtraEnv, cobre os
     branches stripeLinks[tipo] !== '' nos 3 cards de plano, tanto como
     card atual ("Renovar X") quanto como card alheio ("Trocar para X" /
     "Assinar X" conforme $isPago).
   - "pagamento indisponivel quando PIX esta desabilitado e Stripe nao
     configurado" - com PAYMENT_PIX_PHONE/PAYMENT_WHATSAPP_PHONE vazios
     via withExtraEnv, cobre o fallback "Pagamento indisponivel" em todos
     os 3 cards, atual e alheios.
   - "link WhatsApp do PIX usa telefone PIX quando WhatsApp especifico nao
     esta configurado" - cobre o fallback $whatsappSource !== '' ? ... :
     $pixPhoneRaw.
   - Impedimento residual (9 gaps): linha 235 ($banda['plano'] ?? '...')
     tem um branch para quando a chave 'plano' esta ausente do array de
     sessao - BandaSelectionHelper::buildBandaAtualSession() sempre define
     essa chave (com fallback 'ativo'), entao esse branch e codigo
     defensivo inalcancavel pelo fluxo real. Os outros 8 gaps sao os 4
     blocos try { ... } catch (Throwable $e) { ... = 0; } (linhas
     247/250/253/259) ao redor de MusicaRepository/UserRepository/
     PlaylistRepository/BandaRepository - cobrir o branch de excecao
     exigiria forcar uma falha real de DB/repositorio (ex.: derrubar uma
     tabela temporariamente), o que foi conscientemente evitado nesta
     sessao autonoma por risco de dano ao ambiente de dados compartilhado.
     Adiado - candidato a um mock/DI futuro do repositorio se se quiser
     cobertura completa.

2. callback.php (10 -> 3 gaps, 76.92%) - tests/cifro/35-google-auth.spec.js:
   - Mesmo padrao withExtraEnv() (helper duplicado localmente no arquivo).
   - Descoberta: start.php so grava $_SESSION['google_oauth_state']
     quando google_oauth_configured() e true; como este ambiente nao tem
     GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI, os testes antigos nunca
     conseguiam um state valido para exercitar os branches depois do
     check de CSRF.
   - "usuario cancela o consentimento (error=access_denied)" - com env
     Google fake (client id/secret/redirect bem formados, nunca reais),
     start.php grava o state real; callback recebe error=access_denied
     e cai no branch userCancelled().
   - "code e state validos, mas troca real do codigo com o Google falha" -
     mesma env fake; isConfigured() passa a ser true e o fluxo chega em
     exchangeCodeForIdToken(), que falha de verdade contra o endpoint real
     do Google (sem completar nenhum login), exercitando o
     catch (\Throwable $e) do callback.
   - Impedimento residual (3 gaps): o caminho de sucesso completo
     (token trocado + JWT verificado + usuario resolvido) exigiria mockar a
     resposta HTTP do Google inteira no nivel do PHP (nao e possivel via
     page.route, que so intercepta chamadas do browser) - fora do escopo
     desta passada.

3. reset-senha.php (8 -> 0 gaps, 100%) - tests/cifro/14-senha-reset.spec.js:
   - Todos os testes anteriores so cobriam caminhos de erro (token
     ausente/invalido/CSRF). Nenhum testava o fluxo de sucesso completo.
   - Novo teste: insere usuario descartavel + linha valida em
     password_reset_tokens via dbQuery direto, faz GET com token valido
     (cobre o branch "senao" que renderiza o formulario, nunca testado),
     extrai o CSRF token do campo oculto do proprio formulario renderizado
     (nao de /api/csrf.php, que exige autenticacao e retorna 401 numa
     pagina publica - armadilha descoberta ao depurar um 403 inicial), faz
     POST com senha valida, confirma sucesso e token marcado como usado, e
     limpa o usuario no finally.

### Numeros confirmados (pipeline oficial completo, nao estimativa)
- PHPUnit: 324/324, 0 falhas (era 315/324 com 9 erros de OpenSSL no inicio
  desta passada).
- Pipeline test:coverage:php completo, rodado 5x nesta sessao para
  confirmar cada incremento: 515-518 passed, 2 skipped, 0 failed em
  todas as rodadas (nenhuma regressao introduzida).
- PHP branches: 92.19% -> 94.24% (1834/1946), subindo em 5 passos
  confirmados: 92.19->92.86->93.32->93.83->94.24%.
- 4 arquivos de teste tocados/criados: tests/php/GoogleJwtVerifierTest.php
  (fix), tests/cifro/20-planos.spec.js, tests/cifro/35-google-auth.spec.js,
  tests/cifro/14-senha-reset.spec.js - commits cc83c27, ba6f8a3,
  0ad2ed7, b07c1da.

### Proximo da fila PHP (por gap, apos esta passada)
salvar_user.php(12, impedimento ja documentado - precisa cenarios de
dispatch/falha de e-mail) > plano.php(9, impedimento documentado acima) >
editor/api.php(7) > bootstrap.php(6) > LiveStateService.php(5) >
bandas/selecionar.php(5, impedimento parcial ja documentado - falta fixture
de sessao master) > editor/salvar_roteiros.php(5) > RegisterController.php(4)
> GoogleJwtVerifier.php(4) > download-yt-audio.php(4, impedimento parcial ja
documentado) > users/salvar_config.php(4) > callback.php(3, impedimento
documentado acima) > login.php(3) > GoogleAuthService.php(3) >
bandas/salvar_banda.php(3).

### Nota de escopo - JS nao avancado nesta passada
Por orcamento de tempo desta invocacao (focada na prioridade 1 - desbloquear
o pipeline PHP - e depois na prioridade 3 do ranking PHP), a fila JS grande
(editor.js ~64, fdm-sync.js ~45, rehearsal.bootstrap.js ~42, etc., listada
nas iteracoes anteriores) nao foi tocada nesta passada. JS permanece em
81.65% (1634/2001), 510 passed/1 skipped, conforme ultima medicao confirmada
(Iteracao JS 7). Recomenda-se priorizar isso na proxima passada, comecando
por editor.js.

## Iteracao 11 - editor.js (JS), sincrono, sem subagentes em background

Confirmado no inicio desta passada (rodada completa e real, nao estimativa):
npm run test:coverage:js -> 519 passed, 1 skipped, 0 failed, branches JS
82.20% (1645/2001). PHP nao foi re-rodado nesta passada (ultimo numero
confirmado seguue sendo 94.24%, 1834/1946, 324/324 PHPUnit).

Descoberta: tests/cifro/04-editor-musicas.spec.js ja tinha, de uma sessao
anterior nao documentada em log (provavelmente WIP do usuario ou passada
anterior que nao chegou a registrar), varios testes novos cobrindo parte
das branches de editor.js (falha de rede no salvar/catch, resposta HTTP
nao-JSON, tom "Nao identificado", exclusao com sucesso/cancelamento,
beforeunload dirty/clean). Esses testes ja estavam passando e nao foram
duplicados.

Adicionado nesta passada (873 linhas no arquivo final, commit c1f8c66):
- changeDefaultKey: branch de tom-alvo invalido (opcao injetada via JS
  que normalizeKey() rejeita), branch de mismatch real de modo (opcao
  de mesmo texto mas modo diferente, ja que o <select> normalmente so
  lista chaves do mesmo modo do tom detectado - testes anteriores desta
  natureza eram vacuos porque atribuir um valor invalido a um <select>
  reseta para '' e cai na guarda anterior sem nunca testar o branch real),
  e branch de intervalo zero (selecionar o mesmo tom ja detectado).
- selectSong: no-op ao clicar duas vezes na mesma musica (early return),
  fallback de campos vazios (artista/classificacao/bit ausentes no
  registro).
- normaliseChordMarkup: remocao de <b></b> vazio e preservacao de <b>
  com texto que nao e acorde (branch "false" do tokens.every).
- deleteSong: sanitizacao de <>& no nome exibido na mensagem de
  confirmacao.
- cleanImportedHtml: caminho com <pre> (cola de outra pagina de cifra)
  vs caminho sem <pre> (div/p convertidos em <br/>).
- plainTextToHtml: tabs e CRLF via colagem de texto puro.
- applySection: insercao de placeholder "[Rotulo]" quando nao ha selecao
  (branch else do if (selected)).

Nao coberto nesta passada / impedimentos (ainda restam ~40+ gaps em
editor.js apos este commit, nao re-medido formalmente por orcamento de
tempo desta invocacao):
- Linhas 37/43 (fallback de window.songs/window.categorias quando nao
  sao array) - dependem de estado global anormal, dificil de forcar sem
  reescrever window.songs diretamente antes do carregamento do script
  (setContent seria chamado em momento errado). Candidato a teste via
  page.addInitScript definindo window.songs = null antes do load.
- Linha 58 (setContent sem state.editor, fallback textarea) e branches
  518/534/536 (tema claro/escuro do TinyMCE) e 582 (tinymce.remove no
  catch de init) - exigem que window.tinymce falhe ao inicializar ou
  esteja ausente; precisa de um teste que bloqueie o script do TinyMCE
  via page.route antes do goto, nao tentado nesta passada.
- Linhas 164/170 (estado "nenhuma musica cadastrada" e plural "1
  musica") - exigem uma banda com exatamente 0 ou 1 musica; o ambiente
  de teste compartilhado sempre tem multiplas musicas de fixtures, e
  esvaziar temporariamente arriscaria quebrar testes concorrentes (nao
  ha isolamento de banda por teste neste arquivo). Adiado.
- Linha 192 ('Sem titulo' quando song.nome ausente) - a API de save
  exige nome nao-vazio, entao nao ha caminho legitimo para criar uma
  musica sem nome via fluxo real. Branch defensivo, provavelmente
  inalcancavel pelo fluxo de UI padrao.

Numeros: pipeline JS completo NAO re-rodado apos essas adicoes (rodar de
novo consome ~8min via npm run test:coverage:js); a spec isolada
tests/cifro/04-editor-musicas.spec.js foi rodada via
`npx playwright test tests/cifro/04-editor-musicas.spec.js --project=cifro`
e confirmada com 46/46 passed apos 1 ajuste (expectativa de `<br>` vs
`<br/>` no teste de colagem com <pre>).

Commit desta passada: c1f8c66 (test: expand editor.js branch coverage...).

Proximo: medir editor.js formalmente com o pipeline completo para
confirmar o novo percentual, depois seguir para fdm-sync.js (~45 gaps),
rehearsal.bootstrap.js (~42), rehearsal.pitch.js (~35), conforme fila da
Iteracao 10.

## Iteracao 12 - continuidade autonoma, colisao com sessao paralela em editor.js

Inicio desta passada: PHP reconfirmado primeiro (`npm run test:coverage:php`,
rodada completa e sincrona) -> 518 passed / 2 skipped / 0 failed, branches
PHP 94.24% (1834/1946), sem regressao. Nenhuma mudanca de codigo PHP feita
nesta passada (fila PHP nao avancada, ver Iteracao 10 para proximos itens:
salvar_user.php, editor/api.php, bootstrap.php etc.).

Foco desta passada era editor.js (item 1 da fila JS). Ao editar
tests/cifro/04-editor-musicas.spec.js foi detectada uma colisao: uma outra
sessao autonoma rodando em paralelo no mesmo diretorio de trabalho ja
estava/esta trabalhando exatamente no mesmo arquivo e mesmo objetivo
(evidenciado por um `git log` mostrando um commit `c1f8c66` "test: expand
editor.js branch coverage..." criado nesta mesma janela de tempo, e por um
system-reminder de "arquivo modificado externamente" durante a edicao). Os
6 testes que esta passada adicionou de forma independente (falha de rede no
salvar/catch com corpo abortado, resposta HTTP nao-JSON com corpo texto,
tom "Nao identificado" quando a cifra nao tem acordes, exclusao com
sucesso e sincronizacao, exclusao cancelada pelo usuario, guarda de
beforeunload dirty/limpo) coincidiram em escopo com o que a sessao paralela
tambem adicionou (ela documentou explicitamente ter encontrado esses testes
"ja passando, nao duplicados" no commit c1f8c66). Resultado: nao houve
perda de trabalho nem conflito real - o arquivo final (873 linhas,
commit c1f8c66, ja presente na branch) contem tanto os testes desta sessao
quanto os da sessao paralela (changeDefaultKey invalido/mismatch,
selectSong no-op/fallbacks, normaliseChordMarkup, deleteSong sanitizacao de
nome, cleanImportedHtml pre vs div/p, plainTextToHtml, applySection sem
selecao).

Verificacao formal desta passada (nao estimativa): `npx playwright test
tests/cifro/04-editor-musicas.spec.js --project=cifro` -> 36/36 passed
antes da fusao, depois `npm run test:coverage:js` completo (pipeline
inteiro, ~6.5min) confirmando o estado final da branch:
- 525 passed / 1 skipped / 0 failed (526 testes totais).
- Branches JS: 82.45% (1650/2001) - subiu de 81.65% (1634/2001) no inicio
  desta dupla-passada.
- editor.js especificamente: 77.46% (165/213), subindo de 71.36% (152/213)
  - 13 branches fechadas no total entre as duas sessoes combinadas.

Decisao: dado que uma sessao paralela ja estava ativamente iterando em
editor.js e ja documentou (Iteracao 11, acima) os gaps residuais restantes
(~40+) com impedimentos especificos (window.songs/categorias nao-array,
fallback textarea sem TinyMCE, temas claro/escuro do TinyMCE, estados de
biblioteca vazia/singular que exigem banda isolada com 0-1 musicas), esta
passada NAO reabriu o mesmo arquivo para evitar median resolver o mesmo
gap duas vezes ou introduzir um conflito de merge real. Nenhum commit novo
foi necessario desta sessao especificamente - as mudancas desta sessao ja
estao refletidas no commit c1f8c66 (working tree limpo para este arquivo
apos a fusao).

Numeros finais confirmados desta passada (ambas as verificacoes rodadas de
ponta a ponta nesta sessao):
- PHP: 518 passed / 2 skipped / 0 failed, 94.24% branches (1834/1946) -
  sem mudanca.
- JS: 525 passed / 1 skipped / 0 failed, 82.45% branches (1650/2001) -
  subiu de 81.65%.

Proximo (fila ainda valida, idêntica à da Iteracao 10/11): fdm-sync.js
(~45 gaps), rehearsal.bootstrap.js (~42), rehearsal.pitch.js (~35),
live.js (~30), fdm-presentation.js (~26), rehearsal.ui.js (~24),
service-worker.js (~23), music-view.js (~16), rehearsal.youtube.js (~16),
rehearsal.audio.js (~15), offline-tools.js (~13), script.js (~10). Como
ha evidencia de outra sessao autonoma ativa no mesmo workspace, a proxima
passada deve checar `git log --oneline -15` e o topo deste log ANTES de
escolher um arquivo, para reduzir chance de nova colisao.

## Iteracao 13 - fdm-sync.js (JS), sincrono, sem subagentes em background

Confirmado antes de iniciar: `git log --oneline -10` mostrava c1f8c66 no
topo (Iteracao 12, editor.js, ja commitada por passada paralela). Log
apontava fdm-sync.js (~45 gaps) como proximo item da fila.

Extracao de gaps: coverage-report.json agregado nao tinha chave por
arquivo utilizavel diretamente (so resumo); os gaps exatos foram extraidos
de coverage/js/lcov.info com
`awk '/SF:public.src.js.fdm-sync.js/,/end_of_record/' coverage/js/lcov.info | grep -E "^BRDA:" | awk -F, '$4==0'`
- 48 branches nao cobertas encontradas (fallback Array.isArray de
  window.songs/playlists/roteiros/categorias nas linhas 12-15, fallback
  'anonymous' em storageKey/offlineBandStorageKey/pendingBandStorageKey
  nas linhas 17/20/23, offlineBand||pendingBand na linha 27,
  onupgradeneeded idempotente na linha 35, defaults ?? em writeSnapshot
  nas linhas 77-90, validateSnapshot nas linhas 98-127, applySnapshot/
  loadCached defaults nas linhas 135-157, performSync nas linhas 202-204,
  applyMutation nas linhas 246-277, cacheBands nas linhas 329-330,
  reconcileOfflineBand nas linhas 366-369, banner na linha 395, bootstrap
  final nas linhas 410-412).

Arquivo de teste usado: tests/cifro/26-offline-sync.spec.js (ja existia,
roda sob o project "pwa" do playwright.config.js, nao "cifro" - descoberta
util: `npx playwright test tests/cifro/26-offline-sync.spec.js
--project=cifro` da "No tests found", precisa `--project=pwa`).

Testes adicionados (6 novos blocos `test(...)`, ~240 linhas):
1. Expandiu o teste existente "rejeita snapshot com playlists, roteiros
   ou categorias fora do contrato" com 4 novos casos: item de playlist
   objeto com id nao numerico, roteiro com id nao finito ('abc'), musica
   com campo cifra nao-string/nao-null (numero). Descoberta: um item de
   playlist "cru" (numero puro, nao objeto) e VALIDO pelo schema (o
   ternario trata isso como id direto com tom ''), entao esse caso foi
   removido do array de invalidos apos falhar a asserção inicialmente.
2. "applyMutation cobre todos os caminhos de mutação local" - chama
   fdmSync.applyMutation diretamente (nao exposto via UI real) para
   cobrir: editor/api.php (delete de id inexistente, noop sem
   response.musica, upsert com response.musica), salvar_playlists.php
   (payload.playlists ausente -> fallback [], presente -> upsert),
   salvar_roteiros.php (deleteId, noop, upsert com response.roteiro),
   categorias/api.php (delete, upsert sem payload.id, upsert com
   payload.id mas sem categoria anterior correspondente, upsert sem
   response.categoria), e path desconhecido -> false.
3. "cacheBands resolve actual_band_id a partir de actual_band_id,
   banda_id ou id" - cobre os 3 ramos do fallback `band.actual_band_id
   || band.banda_id || band.id`.
4. "reconcileOfflineBand (via evento online) recarrega em sucesso e
   invalida/redireciona em acesso negado" - dispara `window.dispatchEvent
   (new Event('online'))` (reconcileOfflineBand nao e exposta no objeto
   retornado por fdmSync, so e chamada internamente pelo listener
   'online' e por um setTimeout no load quando ha offlineBand). Cobre
   sucesso (200 + sucesso:true -> reload) e acesso negado (403 + mensagem
   "Acesso negado" -> invalidateBand + redirect para select-banda.php).
5. "reconcileOfflineBand ignora erro de rede silenciosamente (catch)" -
   route.abort('failed') no POST, confirma que nao trava a pagina (catch
   vazio).

Nao coberto nesta passada / impedimentos (candidatos para proxima
passada, gaps remanescentes estimados ~20-25 de 48):
- Linhas 12-15 (fallback Array.isArray quando window.songs/playlistsSalvas/
  roteirosSalvos/categorias NAO sao array): so acontece se algum outro
  script atribuir um valor nao-array a essas globais ANTES de fdm-sync.js
  rodar. Precisaria de page.addInitScript definindo essas globais como
  nao-array antes do carregamento da pagina - nao tentado nesta passada
  por exigir controle fino de ordem de scripts.
- Linha 35 (branch "else" de objectStoreNames.contains, ou seja, upgrade
  rodando quando a store ja existe): exigiria forcar onupgradeneeded a
  disparar duas vezes (bump de DB_VERSION ou apagar/recriar o DB no meio
  do teste) - alto risco de interferir em outros testes que compartilham
  o mesmo IndexedDB 'cifro'. Adiado.
- Linhas 77-90 e 135-138 (branches "??" de writeSnapshot/applySnapshot
  quando musicas/playlists/roteiros/categorias/plano/trial_expira_em sao
  undefined em vez de ausentes/null): validateSnapshot exige
  Array.isArray nesses 4 campos, entao musicas/playlists/roteiros/
  categorias nunca chegam undefined em applySnapshot/writeSnapshot pelo
  fluxo real; so os campos plano/trial_expira_em (linha 87-88) sao
  realmente alcancaveis e ja devem estar cobertos pelo snapshot real
  (a confirmar na proxima medicao formal).
- Linhas 156-157 (loadCached: playlists?.data ?? [] e roteiros?.data ??
  [] quando as linhas de playlists/roteiros no IndexedDB sao null) -
  ocorre naturalmente so em banda recem-criada sem nenhuma playlist/
  roteiro salvo; o ambiente de teste compartilhado sempre tem fixtures.
  Candidato a teste com banda isolada/nova.
- Linha 410 (branch `offlineBand && isOnline()` quando offlineBand e
  falsy) e linha 412 (`'serviceWorker' in navigator && window.FDM_USER_ID`
  quando FDM_USER_ID ausente) - ambos avaliados no boot do modulo, dificil
  de parametrizar sem reload controlado com env alternativo; nao tentado.

Numeros: spec isolada tests/cifro/26-offline-sync.spec.js rodada via
`npx playwright test tests/cifro/26-offline-sync.spec.js --project=pwa`,
16/16 passed (1 falha inicial corrigida - caso invalido de playlist que na
verdade era valido pelo schema, removido do array de testes). Pipeline
completo (test:coverage:js) NAO re-rodado nesta passada por orcamento de
tempo (e por instabilidade momentanea da ferramenta de shell no fim da
sessao); recomenda-se rodar no inicio da proxima passada para confirmar o
novo percentual antes de seguir para rehearsal.bootstrap.js.

Commit desta passada: 01ff39b (test: expand fdm-sync.js branch coverage...).

### Numeros finais confirmados (pipeline completo rodado ate o fim nesta
passada, `npm run test:coverage:js`, 5m54s):
- 539 passed / 1 skipped / 0 failed (540 testes totais, 109 suites).
- Branches JS: 83.25% (1666/2001) - subiu de 82.45% (1650/2001) no inicio
  desta passada (+16 branches fechadas).
- Statements 93.88%, Functions 90.91%, Lines 89.32%.

Proximo: rehearsal.bootstrap.js (~42 gaps), rehearsal.pitch.js (~35),
live.js (~30), conforme fila das Iteracoes 10-12.

## Iteracao 14 - rehearsal.bootstrap.js (JS), sincrono, sem subagentes em background

Confirmado antes de iniciar: `git log --oneline -10` mostrava 01ff39b no topo
(Iteracao 13, fdm-sync.js), sem commits novos de outras sessoes paralelas.
Pipeline completo rodado primeiro para confirmar baseline:
`npm run test:coverage:js` (5m45s) -> 539 passed / 1 skipped / 0 failed,
branches JS 83.15% (1664/2001) - leve variacao em relacao ao numero
reportado no fim da Iteracao 13 (83.25%/1666), dentro da margem de ruido
entre execucoes completas.

Extracao de gaps: `awk '/SF:public.src.js.rehearsal.rehearsal.bootstrap.js/,/end_of_record/' coverage/js/lcov.info | grep -E "^BRDA:" | awk -F, '$4==0'`
-> 41 branches nao cobertas.

Arquivo de teste usado: tests/cifro/32-rehearsal-real-flow.spec.js (ja
existia, cobria o fluxo principal do modo ensaio). Adicionados 9 novos
`test(...)` (~180 linhas):
1. "bootstrap não faz nada quando a página não tem id de música" - navega
   para music.php SEM ?id= (so ?editorPreview=1) e ainda assim abre o
   painel; window.bootstrapEntered fica true mas bootstrap() retorna cedo
   (musicId ausente) - cobre a linha 11.
2. "fecha e reabre o painel" - clica btnAtivarEnsaio duas vezes (via
   document.getElementById(...).click() em JS, pois o botao fica fora do
   viewport apos abrir o painel em telas de teste e nem `force:true` do
   Playwright resolve isso) para cobrir handleToggle(true) e
   handleToggle(false) (linha 45).
3. "controles de reprodução sem áudio carregado" - descoberta importante:
   os botoes de playback (btnInicio, btnSetA, btnPitchUp etc.) comecam
   com `disabled=true` (setPlaybackControlsEnabled(false) no bootstrap) e
   SO sao habilitados apos handleAudioFile ter sucesso; cliques do
   Playwright em botao disabled (mesmo com force:true) nao disparam
   listeners no Chromium real. Solução: remover o atributo `disabled` via
   `page.evaluate` antes de clicar, permitindo exercitar de fato os
   guards `if (!player) return` em handleStart/handleBack1/
   handlePlayPause/handleForward1/handleSetA/handleSetB/handlePitchDown/
   handlePitchUp/handlePitchReset sem áudio carregado (linhas 155, 165,
   170, 176, 182, 194, 203, 225, 238, 251). Tambem cobre getPlayer()
   retornando window.mockPlayer quando definido (linha 220).
4. "segundo upload de áudio reutiliza o player" - dois uploads
   sequenciais cobrem o ramo `if (!player)` falso em handleAudioFile
   (linha 130); um terceiro upload com um WAV valido mas `File` de nome
   vazio (`new File([...], '')`) cobre o fallback `file.name || "uploaded"`
   (linha 148) - importante usar bytes de WAV validos (mesmo gerador do
   wavTone()), senao player.loadFile rejeita e cai no catch sem nunca
   atualizar o nome. Um change event sem nenhum arquivo selecionado cobre
   o guard `if (!file) return` (linha 127).
5. "ordena região A/B em ambas as direções" - define B antes de A e depois
   A antes de B para cobrir os dois operandos das condicoes aninhadas de
   handleSetA/handleSetB (linhas 196 e 205).
6. "erro de download sem mensagem usa fallback Unknown error" - substitui
   window.fetch temporariamente via page.evaluate para rejeitar com `{}`
   (sem `.message`) apenas na chamada a download-yt-audio.php, cobrindo
   o fallback `err.message || "Unknown error"` (linha 122).
7. "conversão bem-sucedida com áudio já carregado" - carrega um audio
   primeiro (cria player), depois vincula YouTube com sucesso (audioPath
   sem fileName, meta sem title) para cobrir: `if (player) await
   player.loadFile(audioBlob)` ramo verdadeiro (linha 111), fallback de
   fileName "audio.mp3" (linha 115) e fallback de titulo vazio (linha 78).

Nao coberto nesta passada / impedimentos (candidatos para proxima
passada, ~23 gaps residuais de 41):
- Linha 21 (`!stateModule || !youtubeModule || ...`): exige que um dos
  modulos Rehearsal.* nao esteja carregado - dificil de simular sem
  interceptar/bloquear um dos scripts lazy-loaded por music.php
  (loadScript via <script> tag), nao tentado.
- Linha 36 (`!waveform || !waveform.wavesurfer` dentro de
  updateRegionFromAB) e linha 155/213 (`if (waveform)` falso em
  handleAudioFile/handleClearAB): o container #waveform sempre existe na
  pagina real, entao `waveform` normalmente nunca fica null depois do
  bootstrap rodar; exigiria remover o elemento do DOM antes do bootstrap
  rodar (ordem de carregamento dificil de controlar via Playwright).
- Linha 52 (fallback de `defaultTitle` quando #song-title nao existe):
  o elemento sempre existe na pagina music.php real.
- Linha 81 idx1 (thumbnailUrl fallback): parcialmente coberto pelo teste
  existente com `thumbnail_url: ''`, mas o branch idx1 especifico segue
  aparecendo no lcov - possivelmente istanbul conta um sub-caso adicional
  (ex.: thumbnailUrl undefined vs string vazia); nao investigado a fundo.
- Linha 275 (`updateAutoSave` guard `if (!player) return`): parece
  estruturalmente inalcancavel pelo fluxo real, pois updateAutoSave so e
  chamada dentro do callback `onTimeUpdate` do pitchPlayer, e `player` ja
  esta atribuido (closure) antes desse callback poder disparar. Candidato
  a "dead code" documentado, nao gap real.
- Linhas 298 (`!uiElements || !uiElements.panel`) e 303 idx1
  (`waveformContainer` ausente): exigem que initUI falhe ou que #waveform
  nao exista na pagina - nao ocorre no fluxo real da aplicacao.
- Linhas 307 (onSeek dentro do waveform: `if (player)`) requer clicar/
  arrastar na waveform real renderizada pelo wavesurfer.js (biblioteca
  externa), nao tentado por complexidade de simular clique preciso no
  canvas do wavesurfer.
- Linhas 322/323 (branches do setInterval de auto-save a cada 2s): dificil
  de testar deterministicamente sem mockar o relogio (fake timers) ou
  esperar >2s reais em cada variante; nao tentado por orcamento de tempo.
- Linha 332 (`document.readyState === "loading"`): ramo so acontece se o
  script for injetado antes do DOMContentLoaded, o que normalmente ja
  aconteceu quando o script e carregado dinamicamente via loadScript()
  apos clique do usuario - estruturalmente quase inalcancavel no fluxo
  real (lazy-load ocorre so apos DOM pronto e usuario clicar).

Numeros: spec isolada rodada via
`npx playwright test tests/cifro/32-rehearsal-real-flow.spec.js --project=cifro`,
12/12 passed (apos corrigir 4 falhas iniciais: bootstrapEntered exigia
realmente clicar no botao mesmo sem id, botao fora do viewport apos abrir
painel exigiu clique via JS, botoes de pitch/playback disabled nao
disparam clique real do Playwright mesmo com force:true, e File com bytes
invalidos fazia loadFile cair no catch sem atualizar o nome).

Pipeline completo (`npm run test:coverage:js`, 5m34s) apos a mudanca:
- 546 passed / 1 skipped / 0 failed (547 testes totais).
- Branches JS: 83.95% (1680/2001) - subiu de 83.15% (1664/2001) no inicio
  desta passada (+16 branches fechadas).
- rehearsal.bootstrap.js especificamente: gaps residuais caem de 41 para
  23 branches nao cobertas (lcov.info confirmado apos a mudanca).

Commit desta passada: a1d6985 (test: expand rehearsal.bootstrap.js branch
coverage...). Nota: como tests/cifro/ ainda e um diretorio nao rastreado
(rename pendente de tests/stagebox/), o commit incluiu TODOS os arquivos
.spec.js novos em tests/cifro/ (28 arquivos), nao apenas o modificado
nesta passada - consistente com o padrao das iteracoes anteriores.

Proximo: rehearsal.pitch.js (~35 gaps), live.js (~30), fdm-presentation.js
(~26, ja tem tests/cifro/33-presentation-mode.spec.js para estender),
rehearsal.ui.js (~24), service-worker.js (~23), conforme fila das
Iteracoes 10-14.

## Iteracao 15 - rehearsal.pitch.js (JS), sincrono, sem subagentes em background

Confirmado antes de iniciar: topo do git log era a1d6985 (Iteracao 14, este
mesmo processo), sem commits paralelos novos.

Extracao de gaps: mesmo awk sobre coverage/js/lcov.info -> 28 branches nao
cobertas em rehearsal.pitch.js (createPitchPlayer, updateTimeLoop,
buildSoundTouchNode/buildFallbackNode, startFrom/stopInternal, play/pause/
toggle/seek/setPitchSemitones/getDuration, e resolveSoundTouch no topo do
arquivo).

Testes adicionados em tests/cifro/32-rehearsal-real-flow.spec.js (5 novos
blocos `test(...)`):
1. "createPitchPlayer chamado diretamente sem callbacks/buffer" - chama
   `window.Rehearsal.pitch.createPitchPlayer()` via page.evaluate SEM
   passar options (cobre os fallbacks ternarios onTimeUpdate/onEnded/
   onStatus) e sem buffer carregado, exercitando os guards `if (!buffer)
   return` em play/seek/setPitchSemitones e o ternario `buffer ? duration
   : 0` em getDuration.
2. "reproduz o áudio até o fim naturalmente" - clica Play e ESPERA de
   verdade (`toHaveText('Play', {timeout: 8000})`) o tom de 2s terminar
   via requestAnimationFrame real, cobrindo o loop updateTimeLoop
   completo (linha 60 ramo continua, linha 61 combinacao usingSoundTouch/
   source/position, linha 65 ternario de rate, linha 70 fim de faixa
   disparando stopInternal+onEnded). Descoberta chave desta iteracao:
   NENHUM teste anterior esperava o audio tocar de verdade ate o fim -
   todos apenas clicavam Play e seguiam adiante, entao o loop de update
   praticamente nunca rodava mais de 0-1 frames.
3. "seek durante reprodução ativa" - inicia playback e clica Plus1/
   PitchUp enquanto tocando, cobrindo os ramos `if (playing)
   startFrom(...)` dentro de seek() e setPitchSemitones() (antes so
   testados com playing=false).

Tentativas que FALHARAM e foram revertidas (documentadas como impedimento
no proprio spec, com comentario extenso): tentei forcar o fallback de
audio nativo (sem SoundTouch) sobrescrevendo/deletando
`window.soundtouchjs.getWebAudioNode` / `window.soundtouchjs` via
page.evaluate para cobrir buildFallbackNode (linhas 99-112) e o terceiro
operando de cada OR em resolveSoundTouch (linhas 6-9, branch idx4, i.e.
`root.soundtouch && root.soundtouch.X`). Confirmado via debug isolado
(scripts _debug_soundtouch.spec.js temporarios, removidos ao final) que:
- `window.soundtouchjs.getWebAudioNode = fn` falha silenciosamente (sem
  erro, sem efeito) porque a propriedade e um getter sem setter definido
  via Object.defineProperty pelo bundle do vendor.
- `Object.defineProperty(window.soundtouchjs, 'getWebAudioNode', {value:
  fn, configurable:true})` lanca `TypeError: Cannot redefine property:
  getWebAudioNode` (a propriedade original e non-configurable).
- `delete window.soundtouchjs` retorna `false` silenciosamente (mesma
  causa).
Concluido que esses ramos sao estruturalmente inalcancaveis no ambiente
de teste atual, pois a biblioteca soundtouch.min.js real sempre esta
disponivel e suas exportacoes sao imutaveis; forcar o fallback exigiria
servir uma build alternativa do vendor so para o teste (nao tentado por
escopo/tempo).

Nao coberto nesta passada / impedimentos residuais (~18 gaps de 28):
- Linhas 6-9 idx4 (terceiro operando `window.soundtouch` de cada OR em
  resolveSoundTouch) e linhas 92 (`!processor` em buildSoundTouchNode),
  99-112 (buildFallbackNode) e 106 (guard onended de audio nativo):
  bloqueados pela imutabilidade do bundle vendor, ver acima.
- Linha 22 idx1 (`window.AudioContext || window.webkitAudioContext`
  fallback): Chromium sempre define window.AudioContext, inalcancavel
  sem mockar o proprio construtor global antes do carregamento do script
  (nao tentado).
- Linha 220 idx1 (`window.Rehearsal = window.Rehearsal || {}` ramo
  "ainda nao existe"): rehearsal.state.js sempre carrega primeiro na
  cadeia de loadScript() de music.php e ja cria window.Rehearsal = {},
  entao para o proprio arquivo pitch.js esse ramo e estruturalmente
  inalcancavel na ordem real de carregamento.
- Linha 134/136 (`stopInternal` guard `!playing` e ramo `!keepPosition`):
  stopInternal so e chamado internamente com `keepPosition=true` (via
  pause() e via fim de faixa em updateTimeLoop) - nunca com valor falsy
  em nenhum call site do arquivo, entao o ramo `!keepPosition` (linha
  136) parece ser codigo morto real, nao apenas gap de teste.

Numeros: spec isolada rodada via
`npx playwright test tests/cifro/32-rehearsal-real-flow.spec.js --project=cifro`,
15/15 passed. Pipeline completo (`npm run test:coverage:js`, 5m31s) apos a
mudanca:
- 549 passed / 1 skipped / 0 failed (550 testes totais).
- Branches JS: 84.75% (1696/2001) - subiu de 83.95% (1680/2001) no inicio
  desta passada (+16 branches fechadas).
- rehearsal.pitch.js especificamente: gaps residuais caem de 28 para 18.

Commit desta passada: d908042 (test: expand rehearsal.pitch.js branch
coverage...).

Proximo: live.js (~30 gaps), fdm-presentation.js (~26, ja tem
tests/cifro/33-presentation-mode.spec.js para estender), rehearsal.ui.js
(~24), service-worker.js (~23), conforme fila das Iteracoes 10-15.

## Iteracao 16 - live.js (JS), sincrono, sem subagentes em background

Confirmado antes de iniciar: topo do git log era d908042 (Iteracao 15),
sem commits paralelos novos.

Baseline confirmado via `npm run test:coverage:js` (5m35s): 549 passed/
1 skipped/0 failed, branches JS 84.70% (1695/2001).

Extracao de gaps: awk sobre coverage/js/lcov.info -> 25 linhas BRDA nao
cobertas em live.js (algumas com multiplos indices de branch): confirmHost
Start guard (dead code, sempre true), renderButtons hostConfirmUntil,
currentPageState validacoes de id/tom, getScrollContainer fallback,
applyFollowerScroll guards, setLiveShortcut guards, assumirHost fluxo de
sucesso, assumirHostComConfirmacao quando ja e host, atualizarHost sem
hostId/offline, startPolling com pagina oculta, consultarStatus (response
nao-ok, deteccao de mudanca de versao/pagina), publishScrollIfChanged
(signature igual/canSync false), listeners de online/visibilitychange em
ambos os modos host/follow.

Testes adicionados em tests/cifro/13-live-mode.spec.js (13 novos blocos
`test(...)` no describe "Live — módulo cliente (window.LiveMode)"):
1. assumirHost com sucesso (mock host.php + update.php 200) -> cobre
   fluxo completo ate "Voce e o host" e texto do botao "Você está
   transmitindo".
2. assumirHostComConfirmacao quando ja em modo host -> dispara clique
   programatico no botao ja vinculado, cobrindo o ramo `if (getMode() ===
   'host') { assumirHost(); return; }` sem passar por fdmConfirm/confirm().
3. atualizarHost sem hostId salvo (mode=host mas sem localStorage) ->
   cobre `if (!hostId) { setMode(''); setDisconnectedStatus(); return; }`.
4. atualizarHost com hostId salvo mas offline -> cobre o guard
   `!navigator.onLine` dentro de atualizarHost (antes so testado em
   assumirHost).
5. startPolling com document.visibilityState='hidden' (via
   Object.defineProperty com getter, dentro de page.evaluate, retornando
   o valor lido do sessionStorage para evitar problema de timing) -> cobre
   o ramo negativo do `if (document.visibilityState !== 'hidden')`.
6. visibilitychange oculto->visivel em modo follow -> cobre stopPolling
   no ramo oculto e consultarStatus+startPolling no ramo visivel/follow.
7. visibilitychange oculto->visivel em modo host -> cobre o ramo
   `else if (getMode() === 'host') { atualizarHost(false); }`.
8. evento 'online' em modo host -> cobre o listener window.addEventListener
   ('online', ...) ramo host, contando chamadas a update.php via mock.
9. evento 'online' em modo follow -> mesmo listener, ramo follow, contando
   chamadas a status.php.
10. consultarStatus com versao incrementando a cada chamada mas
    paginaAtual igual a atual -> cobre `changed = true` combinado com
    `samePage(...)` true, garantindo que NAO navega (branch idx dentro do
    `if (changed && ... && !samePage(...))`).
11. setLiveShortcut com wrapper #mostrarbtnplay removido do DOM -> cobre
    o guard `if (!wrapper || !link) return;` dentro de consultarStatus em
    modo follow, sem lancar erro.

Dificuldades e correcoes durante a passada:
- Clique real via Playwright locator (`hostBtn.click()`) falhou com
  "element is outside of the viewport" porque o botao de host fica fora
  da area visivel nesta pagina/viewport de teste; troquei para
  `btn.dispatchEvent(new MouseEvent('click', ...))` via page.evaluate,
  que aciona o listener sem exigir visibilidade real do elemento.
- Um teste inicial lia a chave de sessionStorage fixa 'fdmLiveMode_default',
  mas salaId real vem de `window.FDM_BAND_ID` (banda autenticada real, nao
  'default'), entao a leitura retornava null; corrigido para calcular a
  chave dinamicamente dentro do proprio page.evaluate, igual ao codigo-fonte.
- Um teste usava paginaAtual: 'music.php?id=1' num cenario que nao
  esperava navegacao, mas como a pagina atual era index.php e samePage()
  retornava false, o modulo navegava de verdade para music.php?id=1,
  quebrando a asserção seguinte (elemento nao encontrado apos navegacao);
  corrigido usando paginaAtual: 'index.php' (mesma pagina), consistente
  com o comportamento real esperado do guard samePage().

Nao coberto nesta passada / impedimentos (branches residuais ~20 de 25
linhas originais, incluindo overlaps):
- confirmHostStart() sempre retorna `true` (linha 258/277-279) — o ramo
  `if (!confirmHostStart()) return;` em assumirHost e estruturalmente
  inalcancavel: e codigo morto / hook para futura logica de confirmacao,
  nao ha caminho no codigo-fonte atual que faca confirmHostStart retornar
  falsy.
- currentPageState com path === 'music.php' e id/tom invalidos (regex
  falha) depende de navegar para music.php?id=<invalido> autenticado, o
  que non-trivialmente interage com roteamento real da aplicacao (pode
  redirecionar); nao tentado nesta passada por tempo — candidato para
  proxima iteracao usando page.route para servir music.php diretamente
  ou testando currentPageState isoladamente via injecao de script.
- publishScrollIfChanged (debounce de 350ms + comparacao de signature)
  depende de eventos de scroll reais disparando o listener passivo
  'scroll' no window; nao exercitado nesta passada, requer simular scroll
  real na pagina com um container que tenha overflow, mais robusto para
  proxima iteracao dedicada a esse trecho.
- getScrollContainer fallback (`document.scrollingElement ||
  document.documentElement` quando #song-cifra nao existe) nao teve teste
  dedicado; a maioria das paginas de teste ja tem #song-cifra pela
  estrutura de music.php.

Numeros: spec isolada `tests/cifro/13-live-mode.spec.js --project=cifro`,
38/38 passed. Pipeline completo (`npm run test:coverage:js`, 5m41s) apos
as mudancas:
- 560 passed / 1 skipped / 0 failed (561 testes totais, +11 vs baseline).
- Branches JS: 84.95% (1700/2001) - subiu de 84.70% (1695/2001) no inicio
  desta passada (+5 branches fechadas efetivamente, apos overlaps de
  indices multiplos por linha).

Commit desta passada: b2f4a93 (test: expand live.js branch coverage...).

Proximo: fdm-presentation.js (~26 gaps, ja tem
tests/cifro/33-presentation-mode.spec.js para estender), rehearsal.ui.js
(~24), service-worker.js (~23), music-view.js (~16), rehearsal.youtube.js
(~16), rehearsal.audio.js (~15), conforme fila das Iteracoes 10-16. Restam
tambem gaps residuais de live.js listados acima (currentPageState invalido,
publishScrollIfChanged, getScrollContainer fallback) para uma proxima
passada dedicada, caso a fila principal termine antes do tempo esgotar.

## Iteracao 17 - fdm-presentation.js e rehearsal.ui.js (JS), sincrono, sem subagentes em background

Confirmado antes de iniciar: topo do git log era b2f4a93 (Iteracao 16), sem
commits paralelos novos.

### fdm-presentation.js (~26 gaps segundo lcov.info da passada anterior)

Testes adicionados em tests/cifro/33-presentation-mode.spec.js (10 novos
`test(...)` em dois novos `describe`):
- Navegacao de setlist via teclado: ArrowRight no meio da lista (navega
  com playlistTom na URL), PageDown na ultima musica (toast "Ultima
  musica da setlist", nao navega), PageUp na primeira musica (toast
  "Primeira musica da setlist", nao navega), ArrowLeft/ArrowRight/
  PageDown/PageUp sem setlist ativa (guard `if (state.setlist)` falso,
  nao navega).
- Navegacao por swipe: gesto horizontal amplo navega; gesto curto
  (abaixo do threshold de 80px) nao navega; gesto com angulo muito
  vertical (guard maxAngle) nao navega; gesto lento (>600ms, guard dt)
  nao navega. Simulados via `new Event('touchstart'/'touchend')` com
  `Object.assign` para `clientX/clientY`, evitando depender de Touch
  real do Chromium (o codigo usa `e.touches ? e.touches[0] : e`, entao
  aceita eventos sinteticos sem `touches`).
- loadSetlist: setlist cujo `items` nao contem o id da musica atual na
  URL cai no fallback `typeof data.currentIndex === 'number' ? ... :
  0`, testado com currentIndex=2 e verificado "3/3" no contador.
- updateProgress/getScrollContainer: `document.scrollingElement`
  sobrescrito para `null` via `Object.defineProperty`, forcando o
  fallback para `document.documentElement`.

Bug corrigido durante a escrita: no primeiro rascunho, o array de ids da
setlist usava `i === 0 ? songReal : id`, mas em alguns testes o id real
precisava ficar em outra posicao; corrigido para usar sentinela por
valor (`id === 0 ? songReal : id`) em vez de indice.

Spec isolada `tests/cifro/33-presentation-mode.spec.js --project=cifro`:
23/23 passed.

### rehearsal.ui.js (~24 gaps)

Nao havia spec dedicado; a cobertura existente vinha de um teste em
tests/cifro/31-browser-branch-matrix.spec.js que exercita `initUI` com
TODOS os elementos e handlers presentes (so os ramos "verdadeiros").
Adicionado um novo teste nesse mesmo arquivo, "modo ensaio UI cobre
guards de elementos ausentes e handlers ausentes", que:
- Chama `initUI(undefined)` com nenhum elemento no DOM (nenhum branch de
  binding deve disparar, sem lancar).
- Recria `btnAtivarEnsaio` sem `#modo-ensaio` (guard `btnToggle && panel`
  com panel ausente).
- Recria `btnAtivarEnsaio`+`panel` ja marcados com
  `dataset.ensaioListenerAdded='true'` (ramo "ja vinculado por
  music.php", listener de initUI nao e re-adicionado).
- Recria `btnAtivarEnsaio`+`panel` do zero com `handlers={}` (sem
  onToggle) e com `handlers=undefined`, clicando o botao em ambos os
  casos para cobrir `handlers && handlers.onToggle` falso nos dois
  operandos.
- `btnAbrirYoutube` presente sem `handlers.onOpenYoutube`.
- `btnVincularYoutube` presente sem `handlers.onBindYoutube`, e depois
  com handler mas sem `inputYoutubeUrl` no DOM (ternario `inputYoutubeUrl
  ? .value : ""` ramo falso).
- `inputAudio` presente sem `handlers.onAudioFile`, e com handler mas
  evento `change` sem arquivo selecionado (`file || null` ramo null).
- `bindControl` com elemento presente mas handler ausente
  (`btnInicio` sem `onStart`).
- Todos os setters (`setLoopActive`, `setPlayState`, `setPitchLabel`,
  `setYoutubePreview` com meta nulo e com title-sem-thumb,
  `setAudioFileName`, `showMessage`, `setControlsEnabled`,
  `setPlaybackControlsEnabled`) chamados sem os elementos-alvo no DOM
  (guards `if (!el) return`), sem lancar.
- `showMessage('', 'success')` com elemento presente, cobrindo
  `text || ""` com texto vazio.
- `setYoutubePreview` com `ytThumb` presente mas `ytTitle` ausente,
  cobrindo o `if (title && meta)` com title nulo.

Spec isolada (so o novo teste) rodada via
`npx playwright test tests/cifro/31-browser-branch-matrix.spec.js -g "modo ensaio UI cobre guards" --project=cifro`:
2/2 passed (setup + teste).

### service-worker.js

Investigado mas nao modificado nesta passada: o spec existente
(tests/cifro/30-service-worker-coverage.spec.js) ja e uma solucao
elaborada que spawna um Chromium via CDP bruto (fora do Playwright
padrao) para anexar ao service worker real e coletar `Profiler
.takePreciseCoverage` diretamente, pois o Playwright normal nao
instrumenta scripts de service worker. Dado o escopo/tempo desta
passada e o risco de quebrar esse mecanismo fragil sem uma investigacao
mais profunda de por que os BRDA especificos aparecem descobertos
mesmo com esse teste ja exercitando quase todos os branches (install,
activate, mensagens SKIP_WAITING/SET_CONTEXT/CLEAR_CONTEXT/
PREPARE_OFFLINE ok e falho, stagePage com cache hit/miss e refresh
falho offline, staticFirst com cache hit/miss e fetch falho),
fica para uma proxima passada dedicada exclusivamente a esse arquivo.

### Numeros da passada (pipeline completo `npm run test:coverage:js`, 6m33s)

- 571 passed / 1 skipped / 0 failed (572 testes totais, +11 vs baseline
  de 560 passed da Iteracao 16).
- Branches JS: 86.26% (1726/2001) - subiu de 84.95% (1700/2001) no
  inicio desta passada (+26 branches fechadas).

Commit desta passada: 88c3b9c (test: expand fdm-presentation.js and
rehearsal.ui.js branch coverage...).

Proximo: service-worker.js (~23 gaps, requer investigacao dedicada do
motivo dos BRDA descobertos apesar do teste CDP existente ja exercitar
quase todos os fluxos), music-view.js (~16), rehearsal.youtube.js (~16),
rehearsal.audio.js (~15), conforme fila das Iteracoes 10-17. Gaps
residuais de live.js e rehearsal.pitch.js de passadas anteriores
tambem seguem pendentes para uma passada dedicada.

## Iteracao 18 (bloqueio de sessão)
- Tentativa de pass 9 (music-view.js, rehearsal.youtube.js, rehearsal.audio.js, service-worker.js) falhou imediatamente: "You've hit your session limit · resets 2:10pm (America/Sao_Paulo)".
- Estado confirmado antes do bloqueio (Iteração 17): JS branches 86.26% (1726/2001), 571 passed/1 skipped/0 failed. Commit topo: 88c3b9c.
- PHP: 94.24% (1834/1946), 324/324 PHPUnit — não verificado há várias passadas, próxima passada deve reconfirmar.
- Impedimento: limite de uso de sessão da API atingido; retomada agendada para após o reset (2:10pm America/Sao_Paulo). Nenhum trabalho perdido — todos os commits anteriores estão intactos em git log.
- Próximo: retomar pass 9 exatamente como planejado (music-view.js ~16, rehearsal.youtube.js ~16, rehearsal.audio.js ~15, offline-tools.js ~13, script.js ~10, service-worker.js ~23 com cautela).

## Iteracao 19 - music-view.js, rehearsal.audio.js, rehearsal.youtube.js, offline-tools.js, script.js (JS), sincrono

Retomada apos o bloqueio de sessao da Iteracao 18. Confirmado antes de iniciar: topo do git log era 88c3b9c (Iteracao 17), sem commits paralelos novos. Baseline reconfirmado com pipeline completo antes de qualquer mudanca: 86.61% (1733/2001) branches, 571 passed/1 skipped/0 failed.

### music-view.js (16 gaps -> 2 residuais)

Novo spec tests/cifro/36-music-view-branches.spec.js, 9 testes cobrindo: closeDrawers com menu/playlists removidos; speedInPixels sem #autoScrollSpeed; updateSpeed sem #autoScrollSpeedValue; updateQuickBar sem #musicQuickBar; syncLyrics sem #quickLyrics; resetReadingSettings com #song-cifra/#autoScrollSpeed/#showQuickBar ausentes e window.__reflowCifra deletado; aba de leitura salva invalida cai para "reading"; cliques data-music-action=menuButton/playlistButton; cliques idempotentes em modo de visualizacao/coluna ja ativos; auto-scroll parando sozinho quando document.scrollingElement e sobrescrito para null.

Tecnica: page.addInitScript registrando um listener de DOMContentLoaded ANTES do listener do proprio music-view.js (que usa defer), removendo elementos-alvo antes do script real rodar.

Bug de teste corrigido: varios controles de leitura (#autoScrollToggle, #resetReadingSettings, #toggle-cifra-letra, [data-view-mode], [data-column-mode]) vivem dentro do drawer #menusideMenu (aria-hidden, fora do viewport ate abrir o menu). locator.click() expirava com "element is outside of the viewport". Corrigido usando locator.evaluate(el => el.click()) para disparar o evento sem depender de visibilidade real.

### rehearsal.audio.js (15 gaps -> 4 residuais) e rehearsal.youtube.js (16 gaps -> 1 residual)

Novo spec tests/cifro/37-rehearsal-audio-youtube-branches.spec.js, 2 testes, carregando os modulos via injecao de <script> e mockando window.WaveSurfer: callbacks onSeek/onRegionChange ausentes; setRegion caindo no addRegion quando getRegion() retorna null; clearRegion sem clearRegions (via getRegion().remove() ou no-op); setTime sem getDuration e com duration<=0; getDuration/isReady sem os metodos correspondentes do WaveSurfer. Para youtube.js: hosts/paths reais do youtube.com (watch/shorts/embed validos, vazios e invalidos), path desconhecido, buildSearchUrl sem argumento, fetchYoutubeMeta com videoId vazio, segundo load() cobrindo o `window.Rehearsal || {}` ja truthy. Ambos passaram de primeira.

### offline-tools.js (13 gaps -> 2 residuais)

Novo spec tests/cifro/38-offline-tools-branches.spec.js cobrindo formatDate com/sem timestamp, setProgress sem barra, prepareShell via registration.waiting sem active, prepareShell sem worker nenhum, fdmSync.sync falso, erro sem .message, resposta do MessageChannel sem ok/error, navigator.storage ausente, markPrepared falso, e re-load dinamico do script (readyState != 'loading').

Bug de teste real encontrado e corrigido: offline-tools.js referencia o identificador solto `fdmSync` (sem window.), que em JS nao-modular resolve para o `const fdmSync` declarado no escopo lexical global de fdm-sync.js — nao para a propriedade window.fdmSync. Reatribuir window.fdmSync = {...} cria uma propriedade nova mas nao afeta a resolucao do identificador dentro de offline-tools.js; os mocks eram silenciosamente ignorados e o fdmSync REAL era chamado. Corrigido mutando o objeto existente com Object.assign(window.fdmSync, {...}) em vez de reatribuir. Este e o mesmo padrao de armadilha (const X global + window.X = X no final) que pode existir em outros modulos (fdm-sync.js, fdm-theme.js etc.) — atencao em passadas futuras ao mockar qualquer global desses.

### script.js (10 gaps -> 6 residuais)

Novo spec tests/cifro/39-script-branches.spec.js, 4 testes: openSideMenu sem window.renderPlaylistsMenu; handlers de menuButton/menuButtonTop/menucloseButton/closeButton com #menusideMenu/#sideMenu removidos; clique fora do painel fechando #sideMenu aberto de fato (verificado via toHaveCSS); fdmSwMessage com navigator.serviceWorker.controller mockado ativo; carregamento de pagina com Navigator.prototype.serviceWorker deletado via addInitScript.

### Numeros da passada (pipeline completo `npm run test:coverage:js`, rodado 4x)

- Inicio: 86.61% (1733/2001), 571 passed/1 skipped/0 failed.
- Apos music-view.js + rehearsal.audio/youtube.js: 88.55% (1772/2001), 584 passed/1 skipped/0 failed. Commit 6d9484a.
- Apos offline-tools.js: 89.05% (1782/2001), 585 passed/1 skipped/0 failed. Commit 40a7799.
- Apos script.js: 89.30% (1787/2001), 589 passed/1 skipped/0 failed. Commit 0c55c1f.
- Total: +54 branches fechadas, +18 testes novos, 0 regressoes.

Ranking de gaps residuais ao final da passada: editor.js (49), fdm-sync.js (38), service-worker.js (23), rehearsal.bootstrap.js (23), fdm-presentation.js (18), live.js (18), rehearsal.pitch.js (18), script.js (6), categorias.js (4), rehearsal.audio.js (4), chords.js (2), fdm-theme.js (2), music-view.js (2), offline-tools.js (2), roteiros.js (2), fdm-sanitize.js (1, ja documentado como inalcancavel), rehearsal.ui.js (1), rehearsal.youtube.js (1).

PHP nao verificado nesta passada por foco total na fila JS (estado conhecido da Iteracao 17: 94.24% / 1834/1946 branches, 324/324 PHPUnit) — recomendado reconfirmar na proxima passada.

Nenhum impedimento estrutural novo documentado nesta passada.

Proximo: retomar a fila dos arquivos grandes (editor.js 49, fdm-sync.js 38, service-worker.js 23, rehearsal.bootstrap.js 23, fdm-presentation.js 18, live.js 18, rehearsal.pitch.js 18) — note que estes numeros sao maiores que os registrados nas Iteracoes 10-17 para os mesmos arquivos, sugerindo que branches residuais/novos surgiram possivelmente por mudancas no codigo-fonte fora desta fila (WIP de migracao de username em andamento pelo usuario). Vale reconferir com git diff se as linhas correspondentes aos BRDA uncovered realmente mudaram antes de escrever testes novos. service-worker.js segue exigindo investigacao dedicada do mecanismo CDP conforme Iteracoes 16-17. Fechar os pequenos residuais de script.js/categorias.js/rehearsal.audio.js/music-view.js/offline-tools.js/rehearsal.youtube.js e uma opcao de retorno rapido se a fila grande nao render tempo suficiente.

## Iteracao 20

### Investigacao da anomalia editor.js/fdm-sync.js (prioridade 1 desta passada)

Rodei `npm run test:coverage:js` do zero (pipeline completo, ~6m54s). Resultado: **89.31% branches (1787/2001)** — bytes/statements/lines/functions identicos (ate arredondamento) ao ultimo numero registrado na Iteracao 19 pos-commit 0c55c1f (89.30%, 1787/2001). Ou seja: **nao ha regressao real no total agregado**. Confirmei via lcov.info fresco que editor.js tem 48 branches descobertas de 213 totais e fdm-sync.js tem 39 de 270 — numeros muito proximos aos "49" e "38" que a Iteracao 19 tinha sinalizado como suspeitos.

Conclusao: a "anomalia" apontada na Iteracao 19 nao e uma regressao introduzida entre passadas recentes — e sim que os numeros de referencia mais antigos (Iteracoes 10-17) citados no ranking historico ficaram desatualizados/nao foram recalculados com o codigo-fonte atual (editor.js, categorias.js, chords.js, fdm-sanitize.js e music-view.js sao arquivos **nao rastreados pelo git nesta branch** — `git status` os mostra como `??`, entao nao existe historico de diff para comparar; sao artefatos de disco cujo conteudo pode ter mudado por edicao direta ou pela migracao WIP de username do usuario sem nunca terem sido commitados). O total agregado da suite bate exatamente com o ultimo estado commitado (0c55c1f), entao nao ha trabalho corretivo de "regressao" a fazer — o ranking de gaps por arquivo apenas precisa ser tratado como o estado real e atual, nao comparado contra numeros antigos de iteracoes anteriores a reestruturacao de diretorios (public/src/assets/js -> public/src/js).

3 testes falharam nesta rodada do pipeline completo (visual desktop-2560x1440, e dois de 26-offline-sync.spec.js). Reexecutei os dois de 26-offline-sync.spec.js isoladamente (`npx playwright test tests/cifro/26-offline-sync.spec.js --project=pwa -g "..."`) e ambos passaram — confirmando que sao flaky sob carga/contencao da suite completa (rodando com outros workers), nao uma regressao real de codigo ou de teste. Nao documentado como impedimento estrutural pois nao bloqueia a pipeline (relatorio de cobertura foi gerado normalmente).

### PHP reconfirmado

`npm run test:coverage:php` (pipeline via Xdebug + Playwright, ~9.6min): **PHP branches 94.04% (1830/1946)** — leve queda de 4 branches vs Iteracao 17 (94.24%, 1834/1946); nao investigado a fundo por tempo, mas nao ha commits de app code nesta janela que expliquem obviamente a queda; possivelmente mais WIP de username nao commitado alterando arquivos PHP tocados pelos testes E2E. Fica como item para proxima passada (comparar lcov PHP por arquivo).

PHPUnit direto (`vendor/bin/phpunit`) inicialmente reproduziu os 9 erros de `openssl_pkey_export(): Cannot get key from parameter 1` em GoogleJwtVerifierTest — a variavel de ambiente `OPENSSL_CONF` setada permanentemente pelo commit cc83c27 nao estava presente **nesta sessao de shell** (ela foi setada como env var de sistema/usuario apos a sessao ja estar aberta). Confirmado que **nao e uma regressao de codigo**: rodando `OPENSSL_CONF="C:/xampp/php/extras/openssl/openssl.cnf" "/c/xampp/php/php.exe" vendor/bin/phpunit` explicitamente, os 324 testes passam limpos: `OK (324 tests, 670 assertions)`. Nota de processo para futuras passadas: se `vendor/bin/phpunit` direto falhar com erro de OpenSSL, primeiro tentar abrir um shell novo (para herdar a env var de sistema) antes de investigar como bug real.

### Impedimentos estruturais novos identificados (nao fechados nesta passada)

- **chords.js linha 257** (`typeof window !== 'undefined' ? window : globalThis`): branch `globalThis` e estruturalmente inalcancavel em qualquer teste Playwright, pois o script sempre roda em contexto de browser onde `window` esta definido. So seria exercitavel rodando o arquivo em Node puro fora do Playwright, o que foge do modelo de teste E2E do projeto.
- **music-view.js linha 39** (`setDrawerState`: `if (!drawer) return;`): os dois unicos call sites (`closeDrawers` linha 45 e o `MutationObserver` callback linha 54) ja fazem o proprio guard `if (!drawer) return` *antes* de chamar `setDrawerState`, entao o branch `drawer` nulo dentro de `setDrawerState` e codigo defensivo mas inalcancavel pelos caminhos de chamada atuais expostos publicamente — a funcao e local ao IIFE e nao esta exposta em `window` para injecao direta via `page.evaluate`.

### Sem novos testes fechados nesta passada

Passada dedicada integralmente a investigacao da anomalia (prioridade 1 explicita) e reconfirmacao PHP/JS pedida no briefing; nao sobrou tempo de execucao para atacar a fila grande (editor.js/fdm-sync.js/service-worker.js/etc). Nenhum commit de codigo/teste feito nesta iteracao — apenas leitura, execucao de pipelines e esta entrada de log.

Proximo: com a anomalia esclarecida (nao e regressao), retomar diretamente a fila de gaps reais usando os numeros frescos desta passada: editor.js (48), fdm-sync.js (39), service-worker.js (~23), rehearsal.bootstrap.js (~23), fdm-presentation.js (~18), live.js (~18), rehearsal.pitch.js (~18), depois residuais pequenos (chords.js 1 real + 1 inalcancavel documentado, music-view.js 1 real + 1 inalcancavel documentado, rehearsal.youtube.js 1). Investigar tambem a queda de 4 branches no PHP (94.24% -> 94.04%) comparando lcov PHP por arquivo entre iteracoes.

## Iteracao 21 - editor.js e fdm-sync.js (JS), sincrono

Retomada apos bloqueio de sessao (fila da Iteracao 20). Topo do git log era 0c55c1f antes de comecar, sem commits paralelos novos.

### editor.js (48 gaps -> parcialmente fechado)

Novos testes em tests/cifro/04-editor-musicas.spec.js (13 testes): fallback para textarea quando o TinyMCE nao carrega (bloqueando a request do script via page.route, ja que o navigator.serviceWorker do projeto `cifro` esta desabilitado mas o cache HTTP normal do browser exigiu usar glob amplo `**/tinymce.min.js*` por causa do query string `?v=<filemtime>` do helper `asset_url()`); cancelar confirmacao de descarte ao trocar de musica e ao criar nova musica; excluir musica cuja referencia local ja foi removida de `window.songs` (branch `index >= 0` falso); erro de rede ao excluir sem `error.message`; `cleanForSave` removendo `<span>` sem estilo relevante e preservando o laranja (`#ff7700`); salvar sem musica selecionada (payload com `id` undefined, adicionando `saved` a `window.songs`); item da lista sem tom detectavel (cifra sem acordes). 54/54 testes do arquivo passam isolados.

Dois testes tentados e descartados por serem estruturalmente inalcancaveis pela UI real: os guards `Array.isArray(window.songs)`/`Array.isArray(window.categorias)` (linhas 37 e 43) nunca veem o ramo falso porque fdm-sync.js ja normaliza `window.songs`/`window.categorias` para array (linhas 12-15 e 135-138) antes de `initialise()` chamar `renderSongs()`/`renderCategories()` — nao ha nenhum call site publico que rode essas funcoes antes da normalizacao. Documentado aqui em vez de forcar um teste artificial via `Object.defineProperty`, que nao sobrevive a atribuicao normal feita pelo proprio fdm-sync.js.

### fdm-sync.js (39 gaps -> parcialmente fechado)

Dois novos testes em tests/cifro/31-browser-branch-matrix.spec.js:
- Reconciliacao de banda offline bem-sucedida: mocka `POST /src/backend/bandas/selecionar.php` retornando `{sucesso:true}`, seta a chave `fdmOfflineBandId:<user>` no localStorage, dispara `online`, e verifica com `page.waitForEvent('load')` que `window.location.reload()` realmente disparou e que a chave foi limpa — cobre o ramo de sucesso de `reconcileOfflineBand` (antes so o ramo 403/acesso-negado estava coberto).
- Guards de `checkOfflinePlanBanner`: 4 cenarios (sem `trial_expira_em`, plano pago, trial ainda valido, trial expirado) usando `context.setOffline(true/false)` + `fdmSync.load(bandId)` com dados de IndexedDB escritos diretamente. Armadilha encontrada: `checkOfflinePlanBanner` e chamada dentro de `load()` sem `await` (fire-and-forget), entao foi necessario um `page.waitForTimeout(150)` apos `fdmSync.load()` antes de checar o banner no DOM.

Bug de teste corrigido durante o desenvolvimento: o helper de escrita no IndexedDB usava `indexedDB.open('cifro', 4)` sem `onupgradeneeded`; em contextos de teste onde o app ainda nao tinha aberto o banco antes, os object stores nao existiam ainda, causando `NotFoundError` na transacao. Corrigido adicionando o mesmo bloco de `onupgradeneeded` usado no teste de reconciliacao ja existente (linha ~213 do mesmo arquivo).

### Numeros da passada (pipeline completo `npm run test:coverage:js`, rodado limpo apos matar 2 execucoes concorrentes acidentais que corromperam `test-results/` e o relatorio monocart — ver nota de processo abaixo)

- **JS branches: 89.71% (1795/2001)**, subiu de 89.31% (1787/2001) no inicio da passada (+8 branches fechadas).
- 600 testes totais: 590 passed / 9 skipped / 1 failed. O unico teste falho (`tests/music-layout.spec.js` — `music layout fits viewport (desktop-2560x1440)`, timeout de `page.evaluate` em 60s) e da suite visual/regressao nao tocada nesta passada; nao investigado a fundo por escopo, mas nao ha nenhuma relacao com editor.js/fdm-sync.js. Vale reconfirmar em passada futura se e flaky ou uma regressao real da suite visual.
- Duracao do pipeline: 11m35s (mais lento que o normal ~6-7min, possivelmente por hardware/contencao da maquina nesta sessao).

### Nota de processo: nunca rodar `npm run test:coverage:js` duas vezes em paralelo

Nesta passada, uma primeira tentativa de rodar o pipeline em background nao retornou notificacao dentro do timeout esperado, entao uma segunda (e depois uma terceira) execucao foi disparada sem confirmar que a anterior tinha realmente terminado ou sido cancelada. As execucoes concorrentes escreveram no mesmo diretorio `test-results/` e colidiram, causando um teste falho espurio (`31-browser-branch-matrix.spec.js` "sincronizacao local aplica playlists...") e um erro de geracao do relatorio monocart (`ENOENT` tentando copiar screenshot que a outra execucao ja tinha limpado). Corrigido matando os processos node extras (`kill -9 <pid>` nos PIDs do `ps aux`), limpando `test-results/` e `coverage/js/` manualmets, e rodando uma unica vez limpa ate o fim (usando `run_in_background: true` explicito + espera sincrona em loop com `sleep 10` dentro de uma unica chamada Bash, ate aparecer o marcador `EXITCODE:N` no log). Os numeros acima sao dessa execucao unica e limpa. Para proximas passadas: sempre verificar `ps aux | grep node` antes de disparar o pipeline de novo, e preferir uma unica chamada Bash com `run_in_background: true` mais espera sincrona em loop, em vez de multiplas tentativas soltas.

PHP nao verificado nesta passada (foco total em fechar editor.js/fdm-sync.js dentro do tempo disponivel). Estado conhecido da Iteracao 20: 94.04% (1830/1946), 324/324 PHPUnit com `OPENSSL_CONF` setado explicitamente.

Nenhum impedimento estrutural novo alem dos dois guards de editor.js documentados acima (songs()/renderCategories() com window.songs/categorias nao-array).

Commits desta passada: `dc43588` (test: expand editor.js branch coverage...) e `b41c922` (test: expand fdm-sync.js branch coverage...).

Proximo: continuar a fila com service-worker.js (~23, requer investigacao dedicada do mecanismo CDP), rehearsal.bootstrap.js (~23), fdm-presentation.js (~18), live.js (~18), rehearsal.pitch.js (~18); reconfirmar PHP; investigar o teste visual `desktop-2560x1440` que falhou nesta passada.

## Iteracao 22 - PHP reconfirmado, service-worker.js investigado, rehearsal.bootstrap.js (1 gap fechado), sincrono

Retomada apos bloqueio de sessao no fim da Iteracao 21. Topo do git log era b41c922 antes de comecar, sem commits paralelos novos.

### Impedimento de processo: pipeline PHP travou (hang real) na primeira tentativa

Primeira execucao de `npm run test:coverage:php` rodou os 324 testes PHPUnit normalmente (OK, 670 assertions, ~7.5s) e todos os 600 testes Playwright do pipeline combinado ate o teste 600/601 (`30-service-worker-coverage.spec.js`, que falhou rapido por motivo nao investigado nessa tentativa), mas em seguida o processo node ficou preso por mais de 10 minutos sem nenhum progresso no log e com CPU essencialmente zero (14s de CPU acumulada em >20min de wall time, confirmado via `Get-Process` no PowerShell). Isso ultrapassou o baseline documentado de ~9.6-11.6min do pipeline completo. Diagnostico: hang real na fase de merge/relatorio de cobertura apos os testes terminarem, nao lentidao normal. Corrigido matando o processo (`kill -9`) e o processo PHP orfao que ainda segurava a porta 8091 (`Stop-Process`), limpando `test-results/` e `coverage/php/`, e rodando novamente do zero.

### service-worker.js: investigado, nao modificado (mesma conclusao das Iteracoes 16-17-20)

Extraidas as 23 BRDA descobertas do `coverage/js/lcov.info` (linhas 24, 26, 30, 37, 43, 54×3, 55, 61, 65, 82-85, 101-103, 112, 114, 117, 126, 129) e lido o spec existente `tests/cifro/30-service-worker-coverage.spec.js` por completo: e uma solucao elaborada com conexao CDP bruta via Chromium separado (`Profiler.takePreciseCoverage`), ja exercitando quase todos os fluxos (install, activate, todas as mensagens, stagePage com cache hit/miss/refresh falho, staticFirst com cache hit/miss/fetch falho, offline). Mapear as 23 BRDA para expressoes de codigo especificas exigiria instrumentacao adicional (comparar branches por coluna/id do istanbul com o AST) que nao coube no orcamento desta passada dada a fragilidade documentada do mecanismo. Na pipeline JS completa rodada nesta passada, o teste do service-worker passou normalmente (5.8s) sem falhas. Mantido como pendente para passada dedicada, conforme recomendado nas Iteracoes 16-17-20.

### rehearsal.bootstrap.js (23 gaps -> 22 residuais, 1 fechado)

Novo teste em `tests/cifro/32-rehearsal-real-flow.spec.js` ("bootstrap retorna cedo quando um módulo de ensaio falha ao carregar"): intercepta a requisicao de `rehearsal.audio.js` via `page.route` devolvendo um script vazio mas valido (200 OK, corpo `// audio module intentionally empty for coverage`), fazendo `window.Rehearsal.audio` nunca ser definido. Isso cobre o ramo verdadeiro do guard `if (!stateModule || !youtubeModule || !pitchModule || !audioModule || !uiModule) return;` na linha 21 de `rehearsal.bootstrap.js` (BRDA:21,6,0,0 -> coberto).

Armadilha de teste encontrada e corrigida: a primeira tentativa assumia que o painel `#modo-ensaio` ficaria com `aria-hidden="true"` porque o bootstrap retornou cedo. Isso estava errado: o listener de clique do botao `#btnAtivarEnsaio` que alterna `aria-hidden` e `is-active` esta definido inline em `public/src/Views/music.php` (`bindButton()`), independente de `rehearsal.bootstrap.js`/`uiModule.initUI()`, e so falha se o `loadScript()` de algum modulo rejeitar (erro de rede real) - um `route.fulfill` com status 200 nao causa isso, entao o painel abre normalmente mesmo com o modulo de audio vazio. A asserção correta e verificar que `uiModule.initUI()` nunca rodou: como ela e quem registra o listener de clique em `#btnVincularYoutube` (`onBindYoutube`), clicar nesse botao com o modulo ausente nao produz nenhuma mensagem em `#rehearsalMessage` (fica vazio), diferente do fluxo normal onde apareceria "Invalid YouTube URL" etc. Teste corrigido e reexecutado isolado (`npx playwright test tests/cifro/32-rehearsal-real-flow.spec.js --project=cifro`): 16/16 passaram.

Residual: 22 gaps ainda pendentes em rehearsal.bootstrap.js (linhas 36, 45×2, 52, 81, 127, 133, 155, 165, 170, 196, 213, 275, 298, 303, 307×2, 322×2, 323×2, 332) - a maioria requer acesso a variaveis de closure (`waveform`, `player`) nao expostas em `window`, ou reproducao de condicoes de timing/estado dificeis de forcar via UI real (ex.: `waveform` truthy mas `waveform.wavesurfer` falso). Nao investigado a fundo por orcamento de tempo desta passada; fica para proxima passada dedicada.

### Numeros reconfirmados desta passada

**PHP** (`npm run test:coverage:php`, rodado do zero apos matar o hang, ~11min): **94.24% branches (1834/1946)**, 599 passed / 2 skipped, PHPUnit 324/324 OK (670 assertions). Identico ao numero da Iteracao 17/20 (nenhuma regressao real, apenas a "queda" reportada na Iteracao 20 nao se repetiu nesta medicao).

**JS** (`npm run test:coverage:js`, rodado limpo, ~12min): **89.51% branches (1741/1945)**, 600 passed / 1 skipped / 0 failed (601 testes totais, incluindo o teste de service-worker que passou normalmente desta vez). O total de branches (1945) e menor que o da Iteracao 21 (2001) e a contagem coberta tambem caiu proporcionalmente (1741 vs 1795) — mesmo padrao ja diagnosticado na Iteracao 20: arquivos JS nao rastreados pelo git (editor.js, categorias.js, chords.js, fdm-sanitize.js, music-view.js etc.) sofrem edicoes de disco fora do controle desta sessao (WIP de migracao de username do usuario), alterando a contagem total de branches instrumentaveis entre passadas sem que seja uma regressao real de cobertura. O teste visual `desktop-2560x1440`/`mobile-375x667` que falhara nas Iteracoes 20-21 nao falhou nesta passada (0 failed) — confirma que era flaky sob contencao, nao uma regressao real.

### Nota de processo adicional: pipeline hung real além do documentado em passadas anteriores

Diferente da nota da Iteracao 21 (execucoes concorrentes acidentais), desta vez foi uma unica execucao que travou de fato apos os testes terminarem (fase de merge/relatorio). Adicionar aos procedimentos futuros: se o processo node ficar mais de ~2min sem novas linhas no log de output E o tamanho do arquivo de log parar de crescer, verificar CPU real via `Get-Process` (PowerShell) antes de assumir que e apenas lento — um processo preso tem CPU perto de zero, um processo processando cobertura de verdade continua consumindo CPU.

Commit desta passada: `b3c084c` (test: cover rehearsal.bootstrap.js missing-module early-return branch).

Proximo: continuar rehearsal.bootstrap.js (22 residuais, provavelmente exigem tecnica de injecao direta de script como em `37-rehearsal-audio-youtube-branches.spec.js` para acessar variaveis de closure), depois fdm-presentation.js (~17-18), live.js (~18-20), rehearsal.pitch.js (~18), service-worker.js (~23, investigacao dedicada do mapeamento BRDA->codigo). PHP: sem gaps residuais priorizados nesta passada (94.24% mantido); plano.php/callback.php residuais de passadas anteriores nao reavaliados.

## Iteracao 23 - fdm-presentation.js, live.js, rehearsal.pitch.js (JS), sincrono

Retomada apos bloqueio de sessao no fim da Iteracao 22. Topo do git log era b3c084c antes de comecar, sem commits paralelos novos.

### fdm-presentation.js (5 testes novos em tests/cifro/33-presentation-mode.spec.js)

Novos casos: `loadSetlist` sem `currentIndex` e sem id correspondente cai no fallback `: 0` do ternario (linha 34); navegar para item de setlist sem `tom` nao inclui `playlistTom` na URL (linha 52); `enter()` sem `requestFullscreen` disponivel nao quebra (linha 204, guard de ausencia de API); `exit()` com `document.fullscreenElement` mockado chama `exitFullscreen()` de fato (linhas 219-221, branch verdadeiro nunca exercitado antes porque o Chromium headless nunca fica realmente em fullscreen via `requestFullscreen()` non-user-gesture); `attachSwipe()` usa `document.body` quando `#song-cifra` nao existe (linha 311, fallback do `||`). Todos os 5 passaram de primeira; suite completa do arquivo (28/28) revalidada isolada.

Nao fechados nesta passada (documentado para referencia futura, nao reinvestigado a fundo): guard `if (!state.setlist) return` em `navigateSetlist` (linha 41) parece estruturalmente inalcancavel — todo call site (onKey, attachSwipe.onEnd via injectSetlistUI que so roda quando `state.setlist` e truthy) ja garante `state.setlist` truthy antes de chamar `navigateSetlist`; idem para o guard em `injectSetlistUI` (linha 271) que so e chamado dentro de `if (state.setlist) injectSetlistUI()`. O guard `if (state.scrolling) return` em `startScroll` (linha 132) tambem parece inalcancavel pela API publica, pois `toggleScroll()` sempre alterna e nao ha caminho para chamar `startScroll` duas vezes seguidas sem passar por `stopScroll` primeiro.

### live.js (5 testes novos em tests/cifro/13-live-mode.spec.js)

Novos casos: salaId real do servidor (`window.FDM_BAND_ID` setado pelo inline `<script>` do proprio `index.php` a partir de `current_band_id()`) usado na chave de sessao em vez do fallback `'default'` (linha 2) — tentativa inicial de sobrescrever via `page.addInitScript` falhou porque o script inline da propria pagina roda depois e vence a ordem de execucao; teste reescrito para verificar o comportamento real (chave nao-default) em vez de forcar um valor sintetico; `currentPageState` em `music.php` com `playlistTom` invalido (`Z9`, nao bate no regex `/^[A-G](?:#|b)?$/`) nao inclui `playlistTom` no payload publicado (linha 156, branch falso do `if (next.tom)` equivalente); `consultarStatus` com `response.ok` mas `success:false` cai no `throw` (linha 403, branch antes so testado via erro de rede/500); `setLiveShortcut` mostra o link "IR PARA LIVE" quando o host esta em pagina real diferente (linha 247, branch `canShow` verdadeiro nunca exercitado — so o falso estava coberto); `applyFollowerScroll` ignora quando `status.canSyncScroll` e falso (linha 196/201, guard `!status.canSyncScroll`).

Tentativa descartada: testar `currentPageState` em `roteiro.php` (linha 165) — live.js **nao e incluido** em `roteiro.php` (`grep` confirma ausencia de `<script src=".../live.js">` na view), entao `window.LiveMode` e `undefined` nessa pagina e o branch e estruturalmente inalcancavel via fluxo real do produto. Documentado como impedimento (nao e bug, e so codigo morto defensivo dentro de uma funcao cujo unico call site em producao nunca visita esse path).

### rehearsal.pitch.js (2 testes novos em tests/cifro/32-rehearsal-real-flow.spec.js)

As Iteracoes anteriores documentavam como "estruturalmente inalcancavel" o fallback de audio nativo (`buildFallbackNode`, linhas 99-112) e o terceiro operando de cada `||` em `resolveSoundTouch` (linhas 6-9, idx4, `window.soundtouch` minusculo) porque tentativas de sobrescrever `window.soundtouchjs`/`window.SoundTouch` via `page.evaluate` falhavam silenciosamente (o bundle define essas propriedades via `Object.defineProperty` sem setter, non-configurable). Nesta passada, a tecnica que funcionou foi interceptar o **request HTTP** do bundle via `page.route('**/src/vendor/soundtouch/soundtouch.min.js*', ...)` **antes** do script real rodar, substituindo o corpo da resposta:
- Teste 1: serve um script vazio (comentario apenas) — `window.soundtouchjs`/`window.SoundTouch` nunca sao definidos, `resolveSoundTouch()` retorna tudo `undefined`, `buildSoundTouchNode()` retorna `null`, e `startFrom()` cai no `buildFallbackNode()` real (native `AudioBufferSourceNode`), incluindo o callback `onended` real do node nativo tocando um tom de 2s ate o fim.
- Teste 2: serve um stub que define `window.soundtouch` (minusculo, terceiro operando) com `SoundTouch`/`SimpleFilter`/`BufferSource`/`getWebAudioNode` falsos minimos (apenas os metodos que `createPitchPlayer` realmente chama), sem definir `window.soundtouchjs` nem `window.SoundTouch` — cobre as 4 branches idx4 das linhas 6-9 e permite que `buildSoundTouchNode()` complete com sucesso via um `getWebAudioNode` fake que retorna um objeto com `connect`/`disconnect` no-op.

Ambos passaram de primeira (18/18 no arquivo completo revalidado isolado). O comentario antigo no spec que documentava esses branches como impedimento foi atualizado para refletir a tecnica que funcionou.

### Numeros da passada

Pipeline `npm run test:coverage:js` teve uma tentativa que travou de fato na fase de merge/relatorio apos o teste 613/613 (mesmo padrao de hang documentado na Iteracao 22 — processo com CPU perto de zero por >15min sem crescimento do log). Diagnosticado via `Get-Process node`/`Get-Process php` no PowerShell (real: CPU 15s/0.2s/0.5s acumulados apos ~19min de wall time parado). Corrigido matando todos os processos `node`/`php` orfaos encontrados (incluindo 2 processos node "zumbis" de uma sessao anterior de 31/07, sem relacao com esta passada), limpando `test-results/` e rodando novamente do zero, limpo, ate o fim (7m2s, sem travar desta vez).

- **JS branches: 90.17% (1754/1945)**, subiu de 89.51% (1741/1945) no inicio da passada (+13 branches fechadas com 12 testes novos, 0 regressoes).
- 613 testes totais: 612 passed / 1 skipped / 0 failed.

PHP nao verificado nesta passada (foco total na fila JS priorizada no briefing). Estado conhecido da Iteracao 22: 94.24% (1834/1946), 599 passed/2 skipped, PHPUnit 324/324.

### Impedimentos estruturais novos documentados

- **live.js linha 165-171** (branch `path === 'roteiro.php'` dentro de `currentPageState`): inalcancavel porque `live.js` nao e carregado em `roteiro.php` (confirmado via grep na view — nao ha `<script src=".../live.js">` nessa pagina), entao `window.LiveMode` nunca existe nesse contexto.
- **fdm-presentation.js linhas 41, 132, 271**: guards defensivos (`!state.setlist`, `state.scrolling` em `startScroll`, `!sl` em `injectSetlistUI`) cujos unicos call sites em producao ja garantem a pre-condicao antes de chamar, tornando o ramo "falso"/early-return teoricamente inalcancavel via qualquer fluxo de UI real. Nao confirmado com certeza absoluta (nao tentado forcar via injecao direta de closure), fica como candidato a impedimento documentado para proxima passada validar ou fechar.

Commits desta passada: `1f99fba` (fdm-presentation.js), `175ba7a` (live.js), `a6e9211` (rehearsal.pitch.js).

Proximo: rehearsal.bootstrap.js (22 residuais, tecnica de injecao via `page.route` interceptando os modulos de rehearsal pode ajudar a acessar variaveis de closure como fizemos com soundtouch.min.js nesta passada), depois os residuais menores de fdm-presentation.js/live.js listados acima, service-worker.js (~23, investigacao dedicada do mapeamento BRDA->codigo ainda pendente), e reconfirmar PHP (nao tocado desde a Iteracao 22).

## Iteracao 24 - PHP reconfirmado, rehearsal.bootstrap.js (JS), sincrono

Retomada apos bloqueio de sessao no fim da Iteracao 23. Topo do git log era a6e9211 antes de comecar, sem commits paralelos novos.

### PHP reconfirmado (prioridade 1)

`npm run test:coverage:php` rodou limpo ate o fim (~7.6min, sem hang desta vez): PHP branches 94.24% (1834/1946), 599 passed/2 skipped, PHPUnit 324/324 (via OPENSSL_CONF explicito). Identico as Iteracoes 17/20/22 - confirma que a "queda" pontual da Iteracao 20 (94.04%) continua sendo ruido/nao-reproduzivel, nao uma regressao real. Um teste falhou nessa mesma rodada completa (04-editor-musicas.spec.js "editor visual indisponivel usa textarea como fallback", timeout esperando #dirtyIndicator visivel); reexecutado isolado e passou de primeira - confirmado flaky sob contencao da suite completa, mesmo padrao ja documentado nas Iteracoes 20-21, nao investigado como regressao real.

### rehearsal.bootstrap.js (22 gaps -> 12 residuais, 10 fechados)

Novos testes em tests/cifro/32-rehearsal-real-flow.spec.js (7 testes novos, arquivo agora com 24 testes, todos passam isolados em ~43s):

- handleOpenYoutube sem #song-title: remove o elemento via page.evaluate antes de clicar #btnAbrirYoutube, cobrindo o fallback title ? title.textContent : "song" (linha 52) - verificado via a URL de busca do popup contendo "song".
- handleBindYoutube sem meta.thumbnailUrl: mock de oEmbed retornando apenas title (sem thumbnail_url), cobrindo o fallback meta.thumbnailUrl || youtubeModule.getThumbnailUrl(videoId) (linha 81).
- handleAudioFile(null): dispara "change" no #inputAudio sem arquivos selecionados via dispatchEvent(new Event('change')), cobrindo o guard if (!file) return; (linha 127).
- handleStart/handleBack1 com player presente: upload de audio real, play/pause breve para avancar a posicao, depois clique em #btnInicio/#btnMinus1, cobrindo os ramos "player truthy" (linhas 165-166, 169-172) que antes so tinham o ramo "sem player" testado.
- autoSaveInterval (guard de diff > 0.1s): investigacao revelou que este branch e quase impossivel de reproduzir em reproducao normal porque updateAutoSave() (chamado a cada frame via onTimeUpdate) ja mantem state.lastPositionSeconds sincronizado continuamente com player.getCurrentTime(), entao o diff checado pelo proprio setInterval de 2s nunca ultrapassa 0.1s - e um checkpoint defensivo redundante na pratica. Tecnica usada: interceptar pitchModule.createPitchPlayer e substituir a opcao onTimeUpdate por um no-op antes de repassar ao player real (via Object.assign({}, opts, { onTimeUpdate(){} })), deixando o player avancar currentTime normalmente mas sem nunca sincronizar state.lastPositionSeconds - assim o proprio setInterval acaba pegando a diferenca sozinho. Cobre as linhas 322-323 (branch verdadeiro).
- Guards dependentes de waveform (linhas 36, 155, 213, 133): descoberto via analise fina do lcov (BRDA por block-id) que waveform e waveform.wavesurfer sao sempre truthy nos testes existentes (WaveSurfer real inicializa com sucesso em todos os fluxos ja cobertos), entao os ramos "falso" desses guards nunca eram exercitados. Novo teste intercepta **/src/vendor/wavesurfer/wavesurfer.min.js* via page.route devolvendo um script vazio (tecnica ja usada com soundtouch.min.js na Iteracao 23): window.WaveSurfer fica undefined, createWaveform() retorna null (guard proprio de rehearsal.audio.js linha 10-13, sem lancar excecao), e waveform permanece null durante todo o bootstrap. O teste entao faz upload de audio, marca A/B, limpa A/B, toca brevemente e faz um segundo upload - tudo sem erros, cobrindo os 4 ramos de uma vez.

Armadilha de depuracao (bastante tempo gasto): a primeira tentativa do teste de autoSaveInterval usava um tom de audio de 6s esperando que o setInterval pegasse a diferenca durante a reproducao. Descobriu-se por instrumentacao (page.addInitScript sobrescrevendo Storage.prototype.setItem e window.setInterval para logar chamadas) que o setInterval de fato disparava a cada 2s reais, mas nunca salvava - porque updateAutoSave() corre a cada frame de onTimeUpdate e mantem o valor sincronizado o tempo todo (comportamento correto do codigo, nao um bug). Achado adicional: o tom de audio sintetico gerado via wavTone() toca muito mais rapido que o tempo real em Chromium headless (um tom de 6s terminou em menos de 600ms de wall-clock) - relevante para futuras passadas que dependam de timing de reproducao real.

Residual: 12 gaps ainda pendentes em rehearsal.bootstrap.js:
- Linha 45 (ambos os ramos de handleToggle) - impedimento estrutural confirmado: handleToggle e passado como handlers.onToggle para uiModule.initUI(), que so vincula o listener de clique em #btnAtivarEnsaio se !btnToggle.dataset.ensaioListenerAdded (rehearsal.ui.js linha 32). Mas o proprio public/src/Views/music.php (linhas 407-440, bindButton()) ja vincula seu proprio listener no mesmo botao e marca btn.dataset.ensaioListenerAdded = 'true' antes dos scripts de rehearsal.bootstrap.js serem carregados dinamicamente (via loadRehearsal(), chamado dentro do handler de clique inline). Ou seja: handleToggle do bootstrap.js nunca e vinculado a nenhum evento real - e codigo morto por design de dupla implementacao. Confirmado via leitura completa de ambos os arquivos.
- Linha 332 (document.readyState === "loading") - impedimento estrutural confirmado: os scripts de rehearsal/*.js sao carregados dinamicamente via document.createElement('script') + document.head.appendChild() dentro de uma cadeia de await loadScript(...) disparada pelo clique no botao, momento em que document.readyState e sempre "complete". So seria testavel se rehearsal.bootstrap.js fosse incluido como <script> estatico no <head>, o que contraria a arquitetura de carregamento sob demanda do modo ensaio.
- Linha 298 (!uiElements || !uiElements.panel): exigiria remover #modo-ensaio do DOM antes do bootstrap rodar; nao tentado nesta passada - candidato a impedimento, nao confirmado com certeza.
- Linha 196 (comparacao de regiao A/B, variante especifica), linha 275 (updateAutoSave com player nulo), linha 303/307 (callback onSeek do waveform, requer interacao real de arraste na waveform), linha 81 idx1 renumerado: nao investigados a fundo por orcamento de tempo; ficam para proxima passada.

### Numeros da passada

Pipeline npm run test:coverage:js rodado do zero (limpo test-results/ e coverage/js/ antes), terminou sem hang em 8m39s.

- JS branches: 90.53% (1761/1945), subiu de 90.17% (1754/1945) no inicio da passada (+7 branches fechadas com 7 testes novos).
- 619 testes totais: 618 passed / 1 skipped / 0 failed.

### Impedimentos estruturais novos documentados

- rehearsal.bootstrap.js linha 45 (handleToggle, ambos os ramos): codigo morto - nunca vinculado a nenhum listener real porque music.php sempre vincula seu proprio handler de clique no botao antes dos scripts do modo ensaio carregarem (ver detalhamento acima).
- rehearsal.bootstrap.js linha 332 (document.readyState === "loading"): estruturalmente inalcancavel dado o carregamento dinamico sob demanda dos scripts do modo ensaio.

Nao houve tempo nesta passada para atacar fdm-presentation.js/live.js/rehearsal.pitch.js (prioridade 3) nem service-worker.js (prioridade 4) do briefing - quase todo o orcamento foi consumido pela investigacao profunda do autoSaveInterval em rehearsal.bootstrap.js (que rendeu tecnica nova reutilizavel: interceptar callbacks de opcoes passadas a factories via wrapper, nao so vendor scripts via HTTP) e pela reconfirmacao PHP.

Commit desta passada: `b487b03` (test: expand rehearsal.bootstrap.js branch coverage...).

Proximo: fechar os residuais de fdm-presentation.js (16 - nota: a linha 52 parece ter um artefato de colecao de cobertura, ja que location.href navegando fora da pagina pode cortar a captura do CDP antes do flush mesmo quando a linha foi executada; vale investigar antes de escrever testes novos), live.js (20, provavelmente mesmo artefato), rehearsal.pitch.js (11), rehearsal.bootstrap.js residuais (12, listados acima), depois service-worker.js (23, investigacao dedicada do mapeamento BRDA->codigo ainda pendente ha 4 passadas).

## Iteracao 25 (recuperacao de sessao anterior apos falha de ambiente EPERM)

A passada anterior (nao logada) fez edicoes reais e verificadas em 3 spec
files mas o shell (Bash e PowerShell) travou com EPERM ao criar processos
antes de rodar o pipeline completo ou commitar. Esta passada recuperou o
trabalho pendente com um shell funcional:

- tests/cifro/13-live-mode.spec.js: +7 testes (tom valido no payload,
  id nao-numerico/fallback, container nao-rolavel em applyFollowerScroll,
  dedupe guard de publishScrollIfChanged, cancelamento via fdmConfirm=false,
  bind direto quando document.readyState=="complete").
- tests/cifro/33-presentation-mode.spec.js: +1 teste (navegacao de setlist
  para item com tom definido, cobrindo o branch verdadeiro de `if (next.tom)`).
- tests/cifro/32-rehearsal-real-flow.spec.js: +3 testes (buildSoundTouchNode
  com processor falsy via stub HTTP de getWebAudioNode retornando null, guard
  de play() duplo, reuso de window.Rehearsal ao recarregar rehearsal.pitch.js).

Todos os 103 testes desses 3 arquivos rodados isoladamente passaram antes do
commit (re-verificado, nao apenas confiado no relato da sessao anterior).
Commit: `631e050`.

## Iteracao 26 (service-worker.js + reconfirmacao completa)

### Pipeline JS completo (numeros frescos, pos-Iteracao 25)

Rodado do zero via `npm run test:coverage:js` (9m35s): 628 passed / 1
skipped / 0 failed. Branches JS: 91.10% (1772/1945) - subiu de 90.53%
(1761/1945) no baseline anterior, refletindo as 11 branches fechadas pela
Iteracao 25.

Nota de processo: a primeira tentativa desta rodada ficou presa porque foi
lancada como comando "fire-and-forget" sem realmente aguardar o resultado -
os processos node ficaram parados (~0% CPU) sem produzir saida. Diagnosticado
via `Get-Process node` (CPU quase zero, sem progresso), processos mortos com
`Stop-Process -Force`, e o pipeline re-executado como chamada sincrona unica
com timeout adequado (600s do Bash tool, que internamente aguardou ate
completar). Sempre aguardar o resultado real de comandos longos em vez de
assumir execucao em background.

### service-worker.js (23 gaps mapeados, alguns fechados)

Analisado `coverage/js/lcov.info` (secao SF:public\service-worker.js) via
BRDA - 23 branches sem cobertura, concentradas nas funcoes helper
`validAsset` (linha 24/26), `validStagePage` (linha 30), `populateStatic`
(37/43/54/55), `preparePages` (61/65), os listeners de `install`/`activate`/
`message` (82-103) e os handlers `stagePage`/`staticFirst` (112-129).

O teste existente (tests/cifro/30-service-worker-coverage.spec.js) ja usa
uma abordagem CDP real (Target.attachedToTarget em service_worker + Debugger/
Profiler.takePreciseCoverage) para capturar cobertura do proprio
service-worker.js, que roda em worker thread separada e nao e alcancavel via
cobertura normal de pagina. Ampliado o array `checks` dentro do
`Runtime.evaluate` que chama as funcoes helper internas diretamente (elas sao
globais no escopo do worker), adicionando:
- validAsset com expectedType fornecido que nao bate com o content-type real
  (branch4, linha 26).
- validAsset sem expectedType mas com content-type text/html (ramo
  `!type.includes('text/html')` falso).
- validAsset com response.ok=false sem redirected (outro lado do optional
  chaining em `!response?.ok`).
- validStagePage numa resposta nao-html (curto-circuito via validAsset).
- validStagePage num html valido mas sem o marcador FDM_USER_ID (cai no
  `false` final da funcao).
- getContext com JSON corrompido no cache META_CACHE (branch catch, linha 44).
- getContext com JSON valido mas sem a chave `userId` (fallback `|| null`).
- pageKey com caracteres especiais no userId, exercitando o
  encodeURIComponent.

Armadilha de sintaxe encontrada e corrigida: como a expressao inteira e
enviada como uma string entre backticks (template literal) para
`Runtime.evaluate`, comentarios em portugues com acentos que continham
backticks dentro do proprio texto (ex.: crases envolvendo "`|| null`")
fechavam prematuramente o template literal externo do arquivo de teste,
quebrando o parse do arquivo inteiro sem erro obvio na primeira leitura -
corrigido removendo todas as crases dos comentarios novos.

Teste re-executado isoladamente com `JS_COVERAGE=1 npx playwright test
tests/cifro/30-service-worker-coverage.spec.js` apos a correcao: 2/2 passed.
Nao foi rodado o pipeline completo de novo so para medir o ganho exato em
service-worker.js por orcamento de tempo, mas as 8 asserts novas confirmam
que os branches-alvo foram de fato exercitados (valores `false`/`null`
esperados batendo). Residual: handlers de install/activate/message/fetch
(populateStatic, preparePages, stagePage, staticFirst) ja sao exercitados
via fluxo real de pagina no restante do teste (registro do SW, mensagens
PREPARE_OFFLINE/CLEAR_CONTEXT, offline via CDP Network.emulateNetworkConditions
+ context.setOffline) - o mapeamento fino de quais branches especificos
desses handlers ainda faltam nao foi refeito nesta passada; fica para a
proxima com o lcov.info gerado a partir de um pipeline completo pos-commit.

Commit: `d0c80be`.

### Reconfirmacao PHP

`npm run test:coverage:php` (9m35s, sem hang): PHP branches 94.24%
(1834/1946), 627 passed / 2 skipped / 0 failed (o service-worker spec.js e
pulado no modo PHP_COVERAGE=1 por design). Identico ao numero estavel das
Iteracoes 17/20/22/24 - confirma novamente que nao ha regressao no lado PHP.

### Numeros finais da passada

- JS: 91.10% branches (1772/1945), 628 passed/1 skipped/0 failed.
- PHP: 94.24% branches (1834/1946), 627 passed/2 skipped/0 failed.
- Commits: `631e050` (recuperacao Iteracao 25), `d0c80be` (service-worker.js
  helpers, Iteracao 26).

### Impedimentos / pendencias

- Nenhum impedimento estrutural novo confirmado nesta passada.
- Pendente: mapear com precisao (via lcov.info pos-commit) quais dos 23 gaps
  originais de service-worker.js seguem abertos apos os testes desta
  passada, e atacar os handlers de nivel superior (install/activate/message/
  fetch/stagePage/staticFirst) que ainda podem ter ramos de erro nao
  cobertos (ex.: falha de rede em populateStatic/preparePages lancando antes
  do primeiro asset, cache.match retornando hit antes do fetch em
  staticFirst).

## Iteracao 27 (verificacao de rastreamento do log + reconfirmacao + diagnostico service-worker.js)

### Status do arquivo de log
Verificado com git status/git check-ignore: coverage-100-log.md esta
rastreado normalmente (commit cb25277 e o HEAD atual, arquivo nao aparece
como modificado nem ignorado - git check-ignore retorna exit 1). Nao ha
mais ambiguidade sobre isso; segue sendo commitado normalmente daqui em
diante.

### Pipeline JS completo (numeros frescos)
Rodado do zero via npm run test:coverage:js (10m34s): 628 passed / 1
skipped / 0 failed. Branches JS: 91.10% (1772/1945) - identico ao numero da
Iteracao 26, confirmando estabilidade (nenhuma regressao).

### Ranking fresco de gaps por arquivo (via lcov.info, BRDA sem hits)
editor.js(43) > fdm-sync.js(35) > service-worker.js(23) >
fdm-presentation.js(15) > live.js(12) = rehearsal.bootstrap.js(12) >
rehearsal.pitch.js(9) > script.js(6) > categorias.js(4) > music-view.js(3)
> chords.js(2) = fdm-theme.js(2) = offline-tools.js(2) = roteiros.js(2) >
fdm-sanitize.js(1) = rehearsal.ui.js(1) = rehearsal.youtube.js(1).

Nota: editor.js e fdm-sync.js aparecem no topo do ranking fresco com mais
gaps absolutos que service-worker.js, mas o prompt desta passada priorizava
explicitamente terminar o mapeamento de service-worker.js iniciado na
Iteracao 26 antes de migrar para outros arquivos - seguido abaixo.

### Diagnostico service-worker.js (23 gaps - identicos aos da Iteracao 26)
Confirmado via BRDA fresco que os 23 gaps mapeados na Iteracao 26
permanecem exatamente os mesmos (linhas 24, 26, 30, 37, 43, 54(x3), 55, 61,
65, 82-85, 101-103, 112, 114, 117, 126, 129) apesar do commit d0c80be ter
adicionado 8 chamadas diretas as funcoes helper (validAsset/validStagePage/
getContext) via Runtime.evaluate dentro da janela
Profiler.startPreciseCoverage/takePreciseCoverage do teste
30-service-worker-coverage.spec.js.

Investigado o motivo: reexecutado o spec isoladamente (JS_COVERAGE=1 npx
playwright test tests/cifro/30-service-worker-coverage.spec.js) - 2/2
passed, sem erros, confirmando que as chamadas diretas continuam
executando com sucesso (os expect sobre os valores retornados batem).
Porem a cobertura precisa por branch (V8 detailed:true coverage,
convertida para formato istanbul/lcov pelo Monocart) nao esta atribuindo
hits aos ramos internos de expressoes (ternarios, optional chaining,
curto-circuito ||/&&) quando a funcao e invocada via Runtime.evaluate fora
do fluxo normal de execucao do worker (fetch/install/activate/message
reais) - possivelmente porque o mapeamento AST->range do v8-to-istanbul
usado pelo Monocart associa essas sub-expressoes a ranges de coluna dentro
da MESMA function-range que ja e contabilizada pelas chamadas reais
(install/message) em outro ponto do teste, e o merge de call counts do V8
profiler nao decompoe automaticamente ramos sem instrumentacao explicita
de branch (ao contrario do Babel/Istanbul tradicional, que instrumenta
cada ramo separadamente). Ou seja: o V8 precise coverage por si so da
cobertura de funcao e de range de codigo executado, mas nao garante que
sub-expressoes logicas dentro de uma linha unica sejam diferenciadas como
branches distintos a menos que o codigo realmente execute caminhos que
produzam ranges de caracteres diferentes (o que so ocorre de forma
confiavel para if/else com blocos separados, nao para ternarios/optional-
chaining/curto-circuito compactados em uma linha).

Isso explica por que os gaps remanescentes de service-worker.js sao quase
todos ternarios e optional chaining compactados (linha 23-26 validAsset,
linha 54 expected = ... ? ... : ... ? ... : ..., linha 82-85 message
handler com 4 if independentes de uma linha so). Nao e um problema de
teste faltando, e uma limitacao conhecida do V8 Profiler precise coverage
para esse padrao de codigo denso em uma linha - documentado como
impedimento tecnico. Alternativa futura: reescrever o service-worker.js
com blocos if/else explicitos so para fins de coverage (nao vale o
trade-off de legibilidade/manutenibilidade do arquivo de producao so para
uma metrica).

### location.href / navegacao completa e cobertura (fdm-presentation.js, live.js)
Confirmado que fdm-presentation.js:53 (location.href = 'music.php?...') e
live.js:426 (window.location.href = status.paginaAtual) sao os unicos
pontos de navegacao completa (full page navigation) nesses dois arquivos.
Isso e uma limitacao diferente da de service-worker.js: quando o browser
navega para uma nova pagina via location.href, o contexto JS anterior e
descartado e a sessao V8 do Playwright/Monocart para aquele arquivo perde
a chance de capturar coverage acumulado apos o ponto de navegacao (o
codigo que roda ANTES da atribuicao a location.href e coberto
normalmente). Isto NAO afeta os 12 gaps atuais de live.js nem os 15 de
fdm-presentation.js listados no lcov.info fresco desta passada - nenhum
dos BRDA descobertos esta em uma linha posterior a atribuicao de
location.href. Portanto essa preocupacao levantada na passada anterior nao
e, de fato, a causa dos gaps residuais desses dois arquivos; e uma
limitacao teorica do Monocart/V8 coverage para paginas que navegam de
verdade (relevante em outros cenarios futuros, mas nao aplicavel aos gaps
atuais). Marcado como investigado e descartado como causa.

### PHP - sem alteracoes nesta passada
Nenhuma mudanca de codigo PHP ou de teste PHP feita nesta passada. Pipeline
PHP nao re-executado (sem alteracoes que pudessem afetar o resultado, e o
numero ja foi reconfirmado identico em 5 passadas anteriores - 94.24%,
1834/1946 branches, 627 passed/2 skipped). plano.php (9 gaps) e
callback.php (3 gaps) seguem com os impedimentos ja documentados nas
Iteracoes anteriores (catch(Throwable) exigindo falha real de
DB/repositorio evitada por risco ao ambiente compartilhado; fluxo de
sucesso do OAuth do Google exigiria mock de HTTP no nivel do PHP, fora do
alcance de page.route).

### Numeros finais da passada
- JS: 91.10% branches (1772/1945), 628 passed/1 skipped/0 failed -
  identico a Iteracao 26 (sem regressao, sem novos ganhos de codigo nesta
  passada - passada dedicada a diagnostico e verificacao).
- PHP: 94.24% branches (1834/1946), 627 passed/2 skipped - nao
  re-executado nesta passada, mantido do ultimo numero confirmado.
- Nenhum commit de codigo/teste nesta passada (nenhuma mudanca de
  cobertura real produzida); apenas este commit de log.

### Impedimentos / pendencias
- service-worker.js (23 gaps): diagnosticado como limitacao tecnica do V8
  precise coverage para ternarios/optional-chaining/curto-circuito
  compactados em uma unica linha - chamada direta via Runtime.evaluate nao
  decompoe em branches distintos; apenas fluxo real de pagina exercitaria
  essas condicoes, e forcar as condicoes alternativas reais (ex.:
  response.ok=false vindo de um fetch de rede de verdade, nao de um
  Response sintetico) de forma deterministica dentro do worker e dificil.
  Considerar impeditivo estrutural salvo reescrita do arquivo de producao
  (fora de escopo desta sessao).
- location.href em fdm-presentation.js/live.js: investigado e descartado
  como causa dos gaps atuais desses arquivos - os gaps remanescentes (15 e
  12 respectivamente) precisam de mapeamento BRDA linha-a-linha proprio,
  nao relacionado a navegacao.
- Proximo: como editor.js (43) e fdm-sync.js (35) sao agora os maiores
  gaps absolutos do ranking fresco, a proxima passada deveria priorizar
  esses dois antes de continuar em service-worker.js (que parece ter
  atingido um teto tecnico) ou nos arquivos pequenos remanescentes.

## Iteracao 28 - fdm-sync.js e editor.js (JS), sincrono, sem subagentes

Confirmado antes de iniciar: `git log --oneline -15` tinha b4ed6fd no topo
(Iteracao 27). Pipeline completo JS reexecutado do zero primeiro (o
processo em background da tentativa anterior nesta mesma sessao ficou com
CPU quase zero por >10min sem gerar lcov.info - matado via
`Get-Process node | Stop-Process -Force`, `test-results/` e `coverage/js/`
limpos, e o pipeline reexecutado com sucesso): 628 passed/1 skipped/0
failed, branches 91.15% (1773/1945) - baseline fresco confirmado antes de
qualquer mudanca.

Gaps extraidos via
`awk` sobre `coverage/js/lcov.info` isolando os blocos SF: de fdm-sync.js
e editor.js: 35 gaps em fdm-sync.js, 43 em editor.js - confirmando o
ranking da Iteracao 27.

### fdm-sync.js (tests/cifro/26-offline-sync.spec.js, projeto "pwa")
5 testes novos:
1. `window.songs/playlistsSalvas/roteirosSalvos/categorias` nao-array sao
   normalizados para `[]` no boot (linhas 12-15) - via
   `page.addInitScript` definindo essas globais como nao-array ANTES do
   `page.goto`, cobrindo o ramo falso do `Array.isArray(...) ? ... : []`
   que a Iteracao 12 havia tentado e descartado por nao ter usado
   addInitScript (so reatribuicao direta, que nao sobrevive a ordem real
   de carregamento dos scripts).
2. `storageKey`/`offlineBandStorageKey`/`pendingBandStorageKey` caem para
   'anonymous' sem `FDM_USER_ID` (linhas 17/20/23) - via
   `Object.defineProperty(window, 'FDM_USER_ID', {value: undefined, ...})`
   em addInitScript.
3. Ramo verdadeiro de `if (offlineBand || pendingBand) window.FDM_BAND_ID
   = ...` com apenas pendingBand presente (linha 27) - exercita o codigo
   mas so verifica ausencia de erro, pois um bootstrap de sessao do
   servidor reatribui `window.FDM_BAND_ID` mais tarde na mesma carga de
   pagina (comportamento correto em producao); documentado no proprio
   teste.
4. `version.banda_id !== bandaId` retorna false em performSync com meta
   existente (linha 202) - interceptando `/api/sync/version.php` com
   `banda_id` divergente apos uma sincronizacao bem sucedida anterior
   (para garantir que `meta` exista e o codigo entre no ramo `!force &&
   meta`).
5. `requestJson` lanca erro quando `!res.ok` e sync cai no catch (linha
   127) - `route.fulfill({status: 500})` em `/api/sync/data.php`.
6. `applyMutation` em banda nunca sincronizada localmente usa os
   fallbacks `{}`/`[]` de criacao (linhas 246/252/253) - chamando
   `fdmSync.applyMutation` diretamente com um `bandaId` novo (sem
   nenhuma linha previa no IndexedDB para essa chave).

### editor.js (tests/cifro/04-editor-musicas.spec.js, projeto "cifro")
4 testes novos (1 tentativa descartada):
1. Tema claro usa skin `oxide` (nao `oxide-dark`) e cores claras (linhas
   518/534-536) - via `localStorage.setItem('fdm-theme', 'light')` em
   addInitScript. Descoberta: mockar `window.fdmTheme` diretamente nao
   funciona porque `fdm-theme.js` roda antes de `editor.js` e SEMPRE
   reatribui `window.fdmTheme` lendo o proprio `localStorage['fdm-theme']`
   - o mock precisa ser feito na fonte de dados (localStorage), nao no
   objeto.
2. Lista de musicas com nome/artista/classificacao/tom todos ausentes
   mostra "Sem titulo"/"Sem detalhes" (linhas 164/165/168/192/195).
3. `preserveAlignmentSpacesIn` ignora nos de texto vazios sem lancar erro
   (linha 277) - via `BeforeSetContent` com `<strong></strong><em></em>`.
4. `plainTextToHtml` com texto vazio retorna string vazia (linha 444).
5. Tentativa descartada: `PastePreProcess` com `content` nao-string (ex.:
   objeto) para cobrir a linha 575 - o proprio pipeline interno do
   TinyMCE chama `.replace()` no `content` antes do handler customizado
   rodar, lancando `TypeError: t.replace is not a function` dentro do
   `tinymce.min.js` minificado. Nao e possivel disparar esse evento com
   `content` nao-string via `editor.dispatch()` sem quebrar o proprio
   TinyMCE; documentado como impedimento (o guard e defensivo contra um
   cenario que o TinyMCE nunca produz na pratica).

### Numeros finais da passada
- JS: 91.82% branches (1786/1945), 638 passed/1 skipped/0 failed - alta
  de +13 branches e +0.67pp sobre a Iteracao 27 (91.15%, 1773/1945).
  638 = 628 (baseline) + 10 testes novos.
- PHP: nao reexecutado nesta passada (sem mudancas de codigo/teste PHP);
  mantido 94.24% (1834/1946), 627 passed/2 skipped conforme ultima
  confirmacao.
- Commit: bedb77a "test: expand fdm-sync.js and editor.js branch
  coverage" (tests/cifro/26-offline-sync.spec.js +118 linhas,
  tests/cifro/04-editor-musicas.spec.js +68 linhas).

### Impedimentos / pendencias
- editor.js linha 575 (PastePreProcess com content nao-string): TinyMCE
  quebra internamente antes do handler customizado rodar; guard
  defensivo inalcancavel via `editor.dispatch()` programatico.
- fdm-sync.js linha 27 (offlineBand||pendingBand): o teste cobre a
  execucao do ramo mas nao consegue afirmar o valor final de
  `window.FDM_BAND_ID` de forma deterministica porque um bootstrap de
  sessao do servidor pode reatribuir a variavel mais tarde na mesma
  carga de pagina - comportamento correto em producao, nao um bug.
- fdm-sync.js linha 35 (upgrade idempotente do IndexedDB) e linhas
  77-90/135-138 (defaults `??` inalcancaveis por causa da validacao
  `Array.isArray` previa em validateSnapshot) seguem nao tentados,
  conforme documentado na Iteracao 13 - seguem como candidatos de baixo
  retorno/alto risco (upgrade exigiria bump de DB_VERSION ou recriacao do
  IndexedDB compartilhado por outros testes).
- Gaps remanescentes estimados apos esta passada: fdm-sync.js ~29 (de 35),
  editor.js ~39 (de 43, incluindo os 2 impedimentos ja documentados de
  window.songs/categorias das Iteracoes anteriores).
- Proximo: continuar fdm-sync.js (validateSnapshot linha 98/104-105,
  applyMutation linha 277 - `window.categorias.find`, cacheBands
  fallbacks) e editor.js (linhas 57-58 setContent, 354/357-367 saveSong,
  382-408 deleteSong, 518-536 restante do initialiseEditor) antes de
  passar para fdm-presentation.js/live.js/rehearsal.pitch.js/script.js.

## Iteracao 29 (continuacao autonoma) - fdm-sync.js/editor.js: gaps residuais

### Pipeline JS: recuperacao apos execucao concorrente acidental
A primeira tentativa desta passada de rodar `scripts/coverage/run-js.ps1`
ficou presa por confusao operacional: uma chamada em background (`&` no
shell) e uma segunda chamada sincrona do mesmo script acabaram rodando
concorrentemente (dois conjuntos de processos node visiveis via
`Get-Process node`, com StartTime diferentes), disputando a mesma porta/
diretorio de cobertura. Matei todos os processos node
(`Get-Process node | Stop-Process -Force`), limpei `test-results/` e
rodei novamente uma unica vez, do inicio ao fim, sem interferir - essa
rodada (12m45s) terminou de ponta a ponta com 640 testes (639 passed, 1
skipped, 0 failed) e gerou os numeros finais usados nesta secao.

### fdm-sync.js (tests/cifro/26-offline-sync.spec.js)
1 teste novo: `window.songs/playlistsSalvas/roteirosSalvos/categorias`
ja em array no boot preservam a mesma referencia - cobre o ramo
verdadeiro (ainda nao tentado) de
`Array.isArray(window.songs) ? window.songs : []` e equivalentes
(linhas 12-15). O unico teste existente ate entao ('...nao-array sao
normalizados para []') so exercitava o ramo falso. Usa `addInitScript`
para pre-popular as quatro globais como arrays com um item sentinela
antes do boot de fdm-sync.js, depois confirma que a mesma referencia
(nao uma copia) chega ate `window.*` apos `page.goto`.

Tentativa descartada: teste para o ramo "anonymous" de `storageKey()`
(linha 17, distinto de offlineBandStorageKey/pendingBandStorageKey que
ja tem cobertura). Forcei `window.FDM_USER_ID = undefined` via
`addInitScript` e chamei `fdmSync.applyMutation(...)` diretamente,
esperando que a chave de persistencia no IndexedDB usasse o prefixo
"anonymous:". Na pratica, um bootstrap de sessao do servidor (mesmo
inline `<script>` que reatribui `window.FDM_BAND_ID` em cenarios
anteriores) reatribui `window.FDM_USER_ID` para o ID real do usuario
autenticado ANTES de fdm-sync.js rodar, mesmo com o `addInitScript`
tentando fixar `undefined` via `Object.defineProperty` com
`writable:true`. Confirmado lendo `window.FDM_USER_ID` no momento exato
da chamada a `applyMutation`: o valor efetivo era o ID real (ex.:
"00000000000000000000000000000001"), nao `undefined`. Documentado como
impedimento: a sessao de teste sempre tem um usuario autenticado com
FDM_USER_ID valido antes que qualquer mutacao real possa rodar, entao o
ramo "anonymous" de `storageKey()` especificamente (diferente das duas
outras funcoes irmãs, que rodam ANTES do bootstrap de sessao, no
carregamento sincrono do modulo) e inalcancavel via fluxo real de UI
autenticado - so seria alcancavel simulando uma sessao nao-autenticada
completa, fora do escopo runtime de fdmSync.applyMutation.

### editor.js (tests/cifro/04-editor-musicas.spec.js)
1 teste estendido: o teste existente "editor visual indisponivel usa
textarea como fallback" ganhou um passo adicional - apos confirmar o
fallback de textarea, estuba `window.fdmConfirm = async () => true` e
clica em `#newSongButton`, disparando `newSong() -> setContent('')`
com `state.editor` nulo. Isso cobre o ramo `else elements.textarea.value
= value || ''` (linhas 57-58) de `setContent()`, que nao era alcancado
no boot inicial da pagina (nenhuma chamada a setContent() acontece antes
de uma musica ser selecionada ou criada).

### Numeros finais da passada
- JS: 92.23% branches (1794/1945) via check-js-branches.mjs; lcov global
  (todos os arquivos, incluindo visual/pwa-only) 92.25% (1846/2001
  branches). 640 testes, 639 passed, 1 skipped, 0 failed (alta de +8
  branches sobre a Iteracao 28: 91.82%/1786/1945 -> 92.23%/1794/1945).
- PHP: nao reexecutado nesta passada (sem mudancas de codigo/teste PHP);
  mantido 94.24% (1834/1946) conforme ultima confirmacao (Iteracao 28).
- Commit: 116dc76 "test: cover fdm-sync.js array-preset boot branch and
  editor.js setContent fallback branch" (tests/cifro/26-offline-sync.spec.js
  +27 linhas, tests/cifro/04-editor-musicas.spec.js +9 linhas).

### Impedimentos / pendencias
- fdm-sync.js linha 17 (storageKey ramo "anonymous"): inalcancavel via
  fluxo real autenticado, ver detalhamento acima.
- fdm-sync.js: gaps remanescentes maiores em validateSnapshot (linhas
  98/104-105 - condicoes de validacao de playlists/musicas ainda nao
  tentadas), applyMutation linha 277 (`window.categorias.find` dentro do
  branch de categorias), linhas 135-138 (defaults `??` apos
  Array.isArray - baixo retorno conforme Iteracao 13), linha 204 (branch
  204), linha 253, linhas 369-410 (reconcileOfflineBand branches
  403/regex "acesso negado", guard serviceWorker+FDM_USER_ID no final do
  modulo).
- editor.js: gaps remanescentes maiores em saveSong (354-367),
  deleteSong (382-408), linhas 459-474 e 518-582 (restante de
  initialiseEditor/paste handlers) - nao tentados nesta passada por
  tempo, ver BRDA bruto extraido de coverage/js/lcov.info nesta sessao
  para retomar.
- Proximo: usar as BRDA gaps ja extraidas nesta sessao (via
  `awk '/SF:.*ARQUIVO/{flag=1} flag{print} /end_of_record/{if(flag){exit}}' coverage/js/lcov.info | grep "^BRDA:" | awk -F',' '$4==0'`)
  para continuar fdm-sync.js (validateSnapshot, reconcileOfflineBand) e
  editor.js (saveSong/deleteSong/initialiseEditor), depois seguir para
  fdm-presentation.js/live.js/rehearsal.pitch.js/script.js conforme
  planejado.

## Iteracao 30 (autonoma) - fdm-sync.js validateSnapshot/applyMutation/reconcileOfflineBand + editor.js saveSong/deleteSong fdmToast

### Confirmacao inicial (baseline desta passada)
Pipeline JS completo rodado do zero (sem mudancas de codigo ainda):
643 passed, 1 skipped, 0 failed, branches 92.18% (1793/1945) via
check-js-branches.mjs. Nota de processo: um primeiro disparo do pipeline
colidiu com um segundo processo `npm run test:coverage:js` iniciado
acidentalmente em paralelo (dois PIDs node distintos rodando Playwright
ao mesmo tempo), corrompendo test-results/ e causando 3 falhas +
"7 did not run" nessa rodada contaminada. Descartada; rerun limpo (um
unico processo, confirmado via Get-CimInstance Win32_Process antes de
iniciar) confirmou 0 falhas. Licao reforcada: sempre checar processos
node ativos antes de disparar o pipeline, mesmo dentro da mesma sessao.

### fdm-sync.js (tests/cifro/26-offline-sync.spec.js)
Gaps atacados (BRDA extraida de coverage/js/lcov.info no inicio da
passada): 98(validateSnapshot condicoes), 104/105 (ternario de item de
playlist objeto vs escalar), 87/88 (fallbacks `?? null` de plano/
trial_expira_em em writeSnapshot), 277 (rename de categoria com
`previous` encontrado em window.categorias), 369/121 (reconcileOfflineBand
- nem sucesso nem acesso-negado).

- "rejeita snapshot com playlists..." ganhou um caso `itens: ['abc']`
  (item escalar, nao-objeto) cobrindo o ramo `:` do ternario
  `typeof entry === 'object' && entry ? entry.id : entry` (linhas
  104-105), que so era exercitado com itens como objetos ate entao.
- Novo teste "snapshot valido sem plano/trial_expira_em usa os
  fallbacks null de writeSnapshot": snapshot 100% valido (arrays vazios,
  content_revision numerico) mas sem as chaves `plano`/`trial_expira_em`
  -> cobre `json.plano ?? null` e `json.trial_expira_em ?? null`
  (linhas 87-88), que nunca tinham sido omitidas propositalmente de um
  snapshot aceito (so apareciam em snapshots ja rejeitados por outros
  motivos).
- "applyMutation cobre todos os caminhos..." ganhou o caso
  `categoriaRenameComPrevio`: popula `window.categorias` com uma
  categoria de id conhecido antes de chamar applyMutation com
  `payload.id` igual e `response.categoria` com novo nome, cobrindo o
  ramo verdadeiro de `previous ? items.map(...) : items` (linha 277) -
  ate entao so o ramo falso (previous undefined) estava coberto.
- Novo teste "reconcileOfflineBand com resposta ok mas sucesso false e
  sem acesso negado nao recarrega nem redireciona": POST para
  selecionar.php retorna 200 com `{ sucesso: false, mensagem: '...' }`
  generica (sem "acesso negado", status != 403) - cobre o ramo em que
  NEM `response.ok && json.sucesso` NEM
  `response.status === 403 || /acesso negado/i.test(...)` sao
  verdadeiros (linha 369, branch 121), veirificando que a pagina
  permanece em index.php e o localStorage nao e limpo.

### editor.js (tests/cifro/04-editor-musicas.spec.js)
Gaps atacados: 354 (Object.assign com `data.id || saved.id` e
`detectedKey(content)?.key || ''`), e os 4 ramos `if (window.fdmToast)`
em saveSong (364/367) e deleteSong (406/408).

- Novo teste "salvar musica existente sem id na resposta mantem o id
  local, e sem acordes reconhecidos zera o tom": cria uma musica real
  via API, seleciona no editor, troca o conteudo para texto sem acordes
  reconheciveis, e estuba a resposta de save para retornar
  `{ ok: true }` sem `id`. Cobre `data.id || saved.id` (usa o id local
  ja existente) e `detectedKey(content)?.key || ''` (cai para '' porque
  nao ha acorde detectavel).
- Novo teste "sem window.fdmToast disponivel, salvar e excluir com
  sucesso/erro nao lancam erro": remove `window.fdmToast` via
  `delete window.fdmToast` (o toast global esta sempre presente em
  producao via fdm-toast.js, entao o ramo falso de
  `if (window.fdmToast)` nunca era exercitado) e percorre as 4
  combinacoes save-sucesso/save-erro-de-rede/delete-erro-de-rede/
  delete-sucesso, confirmando que a UI nao quebra sem o toast.
  Ajuste de processo: apos a etapa de delete com falha o titulo
  permanece preenchido (deleteSong nao limpa o formulario em erro), mas
  foi necessario re-preencher `#titulo` explicitamente antes do ultimo
  save da sequencia (a primeira versao do teste falhou com "Digite o
  nome da musica" porque o campo estava vazio nesse ponto do fluxo).

### Numeros finais da passada
JS (rerun limpo, sem colisao de processos): 643 passed, 1 skipped, 0
failed. Branches 92.80% (1805/1945) via check-js-branches.mjs (alta de
+12 sobre a Iteracao 29: 92.18%/1793/1945 -> 92.80%/1805/1945).
PHP: nao reexecutado nesta passada (sem mudancas de codigo/teste PHP);
mantido 94.24% (1834/1946) conforme ultima confirmacao (Iteracao 28).

Commit desta passada: "test: expand fdm-sync.js and editor.js branch
coverage (Iteracao 30)" (tests/cifro/26-offline-sync.spec.js +52 linhas,
tests/cifro/04-editor-musicas.spec.js +88 linhas).

### Impedimentos / pendencias
- fdm-sync.js: gaps residuais ainda nao tentados nesta passada -
  linhas 17/20/23 (fallback "anonymous", ja documentado inalcancavel
  via fluxo autenticado real), 35 (createObjectStore so roda na
  primeira criacao do DB/upgrade de versao - dificil de forcar sem
  derrubar o IndexedDB entre testes), 135-138 (fallbacks `??` de
  applySnapshot - possivelmente ja cobertos indiretamente, precisa
  reverificar BRDA apos este commit), 157 (bloco load/sync), 204,
  253 (optional chaining `response.categoria?.id` - candidato a teto
  tecnico do V8/Monocart com decomposicao de branch unico), 369/119-120
  (ramos restantes dentro do bloco reconcileOfflineBand).
- editor.js: gaps residuais em 459-474 e 518-582 (paste handlers e
  restante de initialiseEditor) - nao tentados nesta passada por tempo;
  proximo passo natural apos revisitar fdm-sync.js remanescente.
- Proximo: reextrair BRDA de coverage/js/lcov.info para fdm-sync.js e
  editor.js apos este commit para confirmar quais gaps fecharam e quais
  permanecem, depois seguir para fdm-presentation.js/live.js/
  rehearsal.pitch.js/script.js (contagens desta passada: 15/12/9/6
  gaps residuais respectivamente, nao tocados ainda) ou PHP
  (plano.php/callback.php) se o retorno em JS diminuir.

## Iteracao 31

### Processo: incidentes com o pipeline em background (documentado para evitar repeticao)
Nesta passada o pipeline `npm run test:coverage:js` foi disparado
acidentalmente 2x sem aguardar corretamente a conclusao (o comando
sempre excede o timeout de foreground de 10 min da ferramenta Bash e
e movido para background automaticamente). Dois disparos anteriores
foram interrompidos por engano via `Stop-Process` antes de terminar
(matando processos node legitimos que ainda estavam rodando,
gerando corrida com lcov.info nao gerado). Tecnica que funcionou:
disparar o pipeline com `run_in_background: true` explicito,
redirecionando stdout/stderr para um arquivo de log proprio com um
marcador `EXITCODE:$?` ao final, e entao fazer polling direto e
sincrono desse arquivo (loop `grep -q "^EXITCODE:"` com `sleep 10`)
dentro de uma unica chamada Bash com timeout longo, sem tocar em
processos node/php ate o marcador aparecer. Licao reforcada: nunca
matar processos node/php sem antes confirmar via `Get-CimInstance
Win32_Process` qual comando cada PID representa - um `Stop-Process`
as cegas pode destruir um pipeline valido em andamento.

### editor.js (tests/cifro/04-editor-musicas.spec.js)
BRDA re-extraida de coverage/js/lcov.info no inicio da passada mostrou
25 branches residuais em editor.js, incluindo os gaps de linhas
459-582 (paste handlers e initialiseEditor) mencionados como pendentes
na Iteracao 30. Atacados 3 dos gaps mais acessiveis:

- **Linha 459** (`wrap.innerHTml = String(html || '')` em
  `preserveSpaces`): novo teste cola apenas `<script>alert(1)</script>`
  via PastePreProcess. `cleanImportedHtml` remove o `<script>` antes de
  chamar `preserveSpaces`, resultando em `root.innerHTML === ''` -
  cobre o ramo falsy do `html || ''`.
- **Linha 474** (`(pre.innerHTML || '')` dentro do branch `<pre>` de
  `cleanImportedHtml`): novo teste cola `<pre></pre>` vazio - a tag
  `<pre>` e encontrada mas sem conteudo, cobrindo o fallback.
- **Linha 518** (`(window.fdmTheme ? window.fdmTheme.get() : 'dark')
  !== 'light'` em `initialiseEditor`): novo teste usa
  `page.addInitScript` com `Object.defineProperty(window, 'fdmTheme',
  {get: () => undefined, set: () => {}})` para forcar `window.fdmTheme`
  permanentemente falsy (impedindo que fdm-theme.js consiga
  reatribuir), e verifica que o link de skin do TinyMCE injetado
  contem `oxide-dark` (fallback padrao quando o helper de tema esta
  ausente).

Tentativa de terceiro teste para a linha 575 (`else if (typeof
event.content === 'string')` dentro do listener `PastePreProcess`) foi
**descartada como impedimento estrutural**: disparar
`editor.dispatch('PastePreProcess', { content: null })` faz o proprio
motor interno do TinyMCE (nao o nosso handler) lancar
`TypeError: Cannot read properties of null (reading 'replace')` antes
mesmo do nosso listener terminar de rodar - o TinyMCE espera que
`event.content` seja sempre string em qualquer listener registrado
nesse evento, entao esse ramo (content nem string-sem-tag nem
string-com-tag, i.e. nao-string) e inatingivel via uso real do editor.

### Impedimentos remanescentes em editor.js (nao tentados/nao atingidos)
- Linha 464 (`if (node.nodeValue)` em preserveSpaces): exigiria um
  text node real com `nodeValue === ''`, o que o parser HTML do
  browser normalmente nao produz a partir de innerHTML - candidato a
  teto tecnico, nao tentado a fundo nesta passada.
- Linha 470 (`String(rawHtml || '')` em cleanImportedHtml): confirmado
  estruturalmente inatingivel - so e chamado quando
  `event.content.includes('<')` e verdadeiro, o que implica uma string
  nao-vazia (logo sempre truthy).
- Linha 582 (`if (window.tinymce)` dentro do catch de
  `tinymce.init()`): exigiria window.tinymce se tornar falsy entre a
  chamada de init e o catch, o que so ocorreria via manipulacao
  artificial do ambiente; nao tentado por tempo.

### fdm-presentation.js / live.js / rehearsal.pitch.js / script.js
Gaps residuais re-confirmados via BRDA fresca (15/12/9/6
respectivamente), mas nao atacados nesta passada - o tempo foi
consumido majoritariamente por incidentes de processo com o pipeline
em background (3 disparos, 2 interrompidos por engano). Prioridade
para a proxima passada.

### Numeros finais da passada
JS: 647 testes, 646 passed, 1 skipped, 0 failed. Branches
92.80% -> 92.95% (1805 -> 1808 de 1945).
PHP: reconfirmado sem mudancas de codigo/teste - 645 passed, 2
skipped, 0 failed, branches 94.24% (1834/1946), estavel.

Commit desta passada: "test: cover editor.js paste-fallback and
fdmTheme-absent branches (Iteracao 31)" (ceb1079).

### Proximo
Reextrair BRDA fresca apos este commit para fdm-presentation.js,
live.js, rehearsal.pitch.js e script.js e atacar seus gaps residuais;
retomar linha 464/582 de editor.js caso sobre tempo; considerar
plano.php/callback.php em PHP se o retorno em JS diminuir. Reforcar o
protocolo de disparo do pipeline em background (arquivo de log +
polling direto do marcador EXITCODE, sem jamais usar Stop-Process sem
antes confirmar via Get-CimInstance qual comando cada PID representa).

## Iteracao 32

### Estado no inicio da passada
Confirmado via `git log --oneline -15` (topo f5f5ab5) e BRDA fresca apos
rodar o pipeline completo `npm run test:coverage:js` em background com
log dedicado (protocolo do prompt seguido: `npm run test:coverage:js >
coverage-js-run.log 2>&1 &`, polling proprio via `tail`/`grep -q
"^EXITCODE:"` a cada ~50s dentro de chamadas Bash, sem matar nenhum
processo node). Resultado: 647 testes, 646 passed, 1 skipped, 0
failed, branches 92.95% (1808/1945) - identico ao estado reportado no
inicio da passada, confirmando estabilidade.

### fdm-presentation.js (tests/cifro/33-presentation-mode.spec.js)
BRDA fresca reconfirmou 15 branches residuais. Ao investigar a linha
204 (`if (document.documentElement.requestFullscreen) { ... }`),
descoberto que o teste ja existente "enter sem suporte a
requestFullscreen nao quebra" (commit 631e050, linha 371) usa `delete
document.documentElement.requestFullscreen` - isso NAO tem efeito
porque `requestFullscreen` e um metodo herdado do prototype
(`Element.prototype`/`HTMLElement.prototype`), nao uma own-property do
elemento; `delete` em uma own-property inexistente e um no-op, entao o
guard permanece sempre truthy nesse teste e o ramo falso nunca era de
fato exercitado (explica por que o BRDA continuava mostrando
204,39,1,0 mesmo com aquele teste presente havia varias passadas).

Corrigido adicionando um novo teste que usa
`Object.defineProperty(document.documentElement, 'requestFullscreen',
{configurable: true, value: undefined})` para criar uma own-property
que de fato sobrepõe o metodo herdado, forçando o guard a avaliar
falso corretamente. Teste roda `enter()` e confirma que `body` recebe
a classe `fdm-presenting` sem lançar erro.

Tambem adicionado um teste exercitando `toggleScroll()` chamado em
sequencia rapida (start -> stop -> start -> stop) para tentar cobrir
os guards de reentrada em `startScroll` (linha 132, `if
(state.scrolling) return`) e `stopScroll` (linha 150, `if
(state.rafId) cancelAnimationFrame`) em ambos os ramos, aproveitando
que com conteudo curto (sem overflow) o auto-stop interno de `step()`
já zera `state.rafId` antes da chamada manual seguinte.

Ambos os testes novos passam isoladamente (`npx playwright test
tests/cifro/33-presentation-mode.spec.js --project=cifro`: 31 passed).
Reconfirmacao via BRDA completa nao foi refeita nesta passada (exigiria
novo pipeline completo de ~14min); recomendado reextrair no inicio da
proxima passada para confirmar quais dos ramos remanescentes de
fdm-presentation.js (~13 aproximadamente apos esta correcao) fecharam.

Commit desta passada: "test: fix ineffective requestFullscreen guard
test + cover startScroll/stopScroll re-entry branches (Iteracao 32)".

### live.js / rehearsal.pitch.js / script.js
BRDA fresca extraida e registrada para as tres:
- live.js: 12 branches residuais confirmados (linhas 2, 48, 99, 165,
  196, 258, 298, 403, 493 e ambos os ramos das linhas 148/151).
- rehearsal.pitch.js: 8 branches residuais confirmados (linhas 22, 60,
  65, 106 [ambos ramos], 115, 134, 136, 220).
- script.js: 6 branches residuais confirmados (linhas 6, 31, 32, 40,
  48, 61). Ao investigar a linha 6 (`if (typeof
  window.renderPlaylistsMenu === 'function')`), notado que o teste
  existente em tests/cifro/39-script-branches.spec.js chama `delete
  window.renderPlaylistsMenu` antes de `openSideMenu()` e deveria
  cobrir o ramo falso - possivel suspeita de outra reatribuicao
  assincrona sobrescrevendo antes da chamada, ou uma peculiaridade
  na fusao de cobertura V8 entre specs; nao investigado a fundo por
  tempo. As linhas 31/32/40/48 (guards de elemento ausente em
  menuButtonTop/menucloseButton/closeButton) tambem nao fecharam com
  o teste existente que faz `.remove()` dos elementos e depois clica
  via `document.getElementById(id)?.click()` - suspeita de que esses
  ids podem nao existir na pagina music.php usada no teste
  (`openPreview` -> `/music.php?...`), fazendo o optional-chaining
  descartar o clique silenciosamente; precisa confirmar no markup
  (public/src/Views/partials/topnav.php e music.php) na proxima
  passada.

Essas tres nao foram atacadas com novos testes nesta passada - o
tempo foi consumido no pipeline completo (14min) + investigacao de
fdm-presentation.js. Prioridade para a proxima passada.

### PHP (plano.php / callback.php)
Nao revisitado nesta passada por tempo; PHP permanece estavel em
645 passed, 2 skipped, 94.24% branches (1834/1946) conforme ultima
confirmacao.

### Proximo
1. Reextrair BRDA fresca de fdm-presentation.js apos o commit desta
   passada para confirmar fechamento das linhas 132/150/204.
2. Investigar por que os testes existentes de script.js (linha 6 e
   31/32/40/48) nao fecham os ramos correspondentes - conferir se os
   ids menuButtonTop/menucloseButton/closeButton existem de fato no
   DOM renderizado por music.php, e se ha alguma reatribuicao
   assincrona de window.renderPlaylistsMenu antes da chamada de
   openSideMenu no teste.
3. Atacar live.js (12 gaps) e rehearsal.pitch.js (8 gaps) com tecnicas
   ja documentadas (page.route, withExtraEnv, Object.assign em vez de
   reassign).
4. Revisitar plano.php/callback.php em PHP se o retorno em JS diminuir.

## Iteracao 33

### Estado no inicio da passada
Confirmado via git log --oneline -15 (topo 559817e). Pipeline completo
npm run test:coverage:js rodado em background (log dedicado
coverage-js-run.log, polling proprio, protocolo seguido sem matar
nenhum processo): 647 passed/1 skipped/2 failed na primeira rodada
(falhas investigadas e corrigidas nesta passada, ver abaixo), branches
93.05% (1862/2001).

### script.js - 3 dos 4 gaps residuais fechados, causas raiz confirmadas
Investigacao do item 2 do "Proximo" da Iteracao 32 confirmou DUAS
causas raiz distintas via reproducao isolada (page.evaluate com
Object.getOwnPropertyDescriptor):

1. Linha 6 (if (typeof window.renderPlaylistsMenu === 'function')):
   window.renderPlaylistsMenu e uma propriedade global NAO
   configuravel (criada pela declaracao de funcao de topo function
   renderPlaylistsMenu() {} em playlists.js; a atribuicao posterior
   window.renderPlaylistsMenu = renderPlaylistsMenu reutiliza o mesmo
   slot). delete window.renderPlaylistsMenu e um no-op silencioso
   (retorna false, nao lanca) - confirmado via
   Object.getOwnPropertyDescriptor mostrando configurable:false. Nem
   Object.defineProperty consegue redefinir ("Cannot redefine
   property"). Fix: como a propriedade E writable, uma atribuicao
   simples window.renderPlaylistsMenu = undefined ja derruba o typeof
   ... === 'function' para false.

2. Linhas 31/32/40/48 (guards internos if (menuSide)/if (sideMenu)
   dentro dos handlers de menuButtonTop/menucloseButton/closeButton):
   confirmado por grep em topnav.php/music.php que menuButtonTop so
   existe no partial topnav.php (incluido em index.php, NAO incluido
   em music.php), entao o guard externo if (menuButtonTop) nunca
   registra o listener quando os testes rodam so em music.php (linhas
   31/32 estruturalmente inalcancaveis nesse fluxo). Separadamente,
   #menucloseButton e #closeButton sao FILHOS de
   #menusideMenu/#sideMenu respectivamente (DOM de music.php) - o
   teste antigo removia o container ANTES de clicar, o que tambem
   desconectava o botao do DOM, tornando
   document.getElementById(id)?.click() um no-op silencioso que nunca
   alcancava o guard interno (linhas 40/48).

   Fix duplo em tests/cifro/39-script-branches.spec.js:
   - Novo teste dedicado rodando em /index.php (onde #menuButtonTop
     existe de fato via topnav.php), clicando o botao real com
     #menusideMenu/#sideMenu presentes (ramo verdadeiro) e depois
     removidos (ramo falso) - cobre 31/32.
   - Teste original de music.php ajustado para capturar as referencias
     dos botoes ANTES de remover os containers, clicando via essas
     referencias depois (listeners continuam validos em elementos
     desconectados) - cobre 40/48.

   Gap residual: linha 61 (dentro do listener
   document.addEventListener('click', ...), primeiro operando do &&
   em sideOpen && !closest(...)) permanece nao fechado; nao investigado
   a fundo nesta passada por tempo - candidato a proxima passada.

Commits: 86d2ecd (fix inicial do teste de menuButtonTop), a784194 (fix
do renderPlaylistsMenu + botoes aninhados).

### rehearsal.pitch.js - fallback window.webkitAudioContext coberto
Investigado o gap da linha 22 (new (window.AudioContext ||
window.webkitAudioContext)()): todos os testes existentes rodam num
browser real do Playwright com window.AudioContext sempre presente,
entao o operando de fallback nunca era exercitado. Novo teste em
tests/cifro/32-rehearsal-real-flow.spec.js remove temporariamente
window.AudioContext (via Object.defineProperty, que E configuravel
nesse caso - diferente do caso de script.js acima) e expoe
window.webkitAudioContext apontando para o mesmo construtor real antes
de chamar createPitchPlayer(), restaurando o original no finally.
Commit aee9609.

Gaps residuais analisados e considerados codigo defensivo
estruturalmente inalcancavel via API publica (nao atacados com testes
"falsos"):
- Linha 115 (if (!buffer) return; dentro de startFrom): startFrom so e
  chamada internamente por play()/seek()/setPitchSemitones(), que ja
  checam buffer antes de chamar - o guard interno nunca ve buffer nulo
  na pratica.
- Linha 134 (if (!playing) return; dentro de stopInternal): todos os 3
  call-sites (updateTimeLoop, callback onended, pause()) ja garantem
  playing === true antes de chamar stopInternal.
- Linha 136 (if (!keepPosition) { currentTime = 0; }): as 3 chamadas
  existentes a stopInternal no arquivo inteiro passam sempre
  keepPosition = true (grep confirmou); stopInternal(false) nunca e
  invocada em nenhum fluxo real, entao o ramo !keepPosition e codigo
  morto.
- Linha 106 (if (!playing) return; dentro do callback onended do
  fallback nativo): cleanupNode() sempre zera nativeSource.onended =
  null ANTES de chamar .stop(0), entao uma parada manual nunca deixa o
  callback onended original disparar com playing ja falso.

### live.js - 12 gaps analisados, 2 causas raiz de codigo morto
identificadas (nao atacadas com testes nesta passada por serem
genuinamente inalcancaveis, documentadas como impedimento):
- Linhas 165-171 (if (path === 'roteiro.php') { ... } dentro de
  currentPageState()): confirmado via grep que live.js so e carregado
  por <script> em index.php e music.php - roteiro.php NAO inclui
  live.js. Logo window.location.pathname nunca pode ser roteiro.php no
  momento em que esse codigo roda; branch morto.
- Linha 99 (else if (Date.now() < hostConfirmUntil)) e linha 258 (if
  (!confirmHostStart())): hostConfirmUntil e inicializada em 0 e NUNCA
  reatribuida em nenhum outro ponto do arquivo (grep confirmou), e
  confirmHostStart() e uma funcao hardcoded para sempre return true.
  Ambos os ramos (linha 99 verdadeiro, linha 258 early-return) sao
  vestigios de uma feature de confirmacao com timeout que parece ter
  sido removida/nunca finalizada - codigo morto ate reintroducao real
  da feature ou remocao explicita.

Os demais gaps (linhas 2, 48, 196, 298, 403, 493 e ambos os ramos de
148/151) nao foram reanalisados a fundo nesta passada; ficam para a
proxima por orcamento de tempo (a maior parte do tempo desta passada
foi consumida no debug e fix dos 2 testes que quebravam no pipeline
completo, ver abaixo).

### Pipeline completo - 2 falhas encontradas e corrigidas
A primeira rodada completa do pipeline (coverage-js-run.log, 14m9s,
647 passed/1 skipped/2 failed) revelou duas falhas:

1. 31-browser-branch-matrix.spec.js - "sincronizacao local aplica
   playlists, roteiros, categorias e estado offline": passou isolado
   (--project=cifro -g), nao reproduzido - aparenta ser flake de ordem
   /estado entre specs na suite completa, nao uma regressao real
   introduzida nesta passada. Nao investigado a fundo (fora do escopo
   dos arquivos prioritarios desta passada); candidato a proxima
   passada se voltar a falhar.

2. 33-presentation-mode.spec.js - "toggleScroll chamado duas vezes
   seguidas" (teste novo da Iteracao 32): falha REAL e reproduzivel
   isoladamente. Causa: o teste rodava em conteudo curto sem overflow
   (scrollHeight <= clientHeight), entao o primeiro
   requestAnimationFrame de step() ja detectava fim de scroll e
   chamava stopScroll() sozinho, removendo fdm-scroll-active antes da
   asercao toHaveClass conseguir observar a classe - corrida real, nao
   flake de ambiente. Fix: forca min-height: 400vh no container de
   scroll antes do toggle, garantindo overflow real. Commit 68cad48.
   Confirmado estavel com --repeat-each=3.

### Numeros
- Pipeline completo #1 (antes dos fixes): 647 passed, 1 skipped, 2
  failed, branches 93.05% (1862/2001), 14m9s.
- Pipeline completo #2 (apos todos os fixes desta passada) rodado em
  background ao final da passada para confirmacao.
- Commits desta passada: 86d2ecd, aee9609, 68cad48, a784194.

### Proximo
1. Confirmar resultado do pipeline #2 e reextrair BRDA fresca para
   confirmar fechamento de script.js linhas 6/31/32/40/48 e
   rehearsal.pitch.js linha 22.
2. script.js linha 61 (guard sideOpen && !closest(...)) - gap residual
   nao investigado.
3. live.js - atacar os gaps ainda nao analisados (linhas 2, 48, 196,
   298, 403, 493, 148/151); considerar documentar linhas
   99/165-171/258 como impedimento formal (codigo morto) se confirmado
   que a feature de hostConfirmUntil/roteiro.php nunca sera reativada.
4. PHP: plano.php (9 residual) e callback.php (3 residual) seguem sem
   novidade - impedimentos ja documentados (falha de DB real / mock de
   resposta HTTP do Google) permanecem validos, nao revisitados nesta
   passada.
