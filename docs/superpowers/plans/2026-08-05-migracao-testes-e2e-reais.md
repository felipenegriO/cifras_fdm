# Migração para Testes E2E Reais — Plano de Ação

**Objetivo:** Substituir testes falsos (baseados em `page.evaluate()` para forçar estado) por testes E2E reais de clique na tela, garantindo que cada funcionalidade crítica é exercida da mesma forma que o usuário a usa. A cada fase: implementar o teste real → verificar cobertura mantida → deletar o fake.

**Princípios:**
- `page.route()` para simular respostas de API é técnica E2E **legítima** — não é "fake"
- `page.evaluate()` para **chamar funções internas** em substituição a clicar num botão é **fake** e deve ser eliminado
- Não deletar o teste fake antes do real estar verde
- Threshold de cobertura pode cair temporariamente durante a migração de cada fase
- Testes que dependem de hardware (WaveSurfer, AudioContext) **não são migráveis** — manter como estão

**Regra de ouro:** Um teste real verifica o que o usuário **vê na tela** após clicar. Um teste fake verifica o que uma função **retorna** quando chamada diretamente.

---

## Estado atual dos arquivos

| Arquivo | Projeto | Tipo atual |
|---|---|---|
| `01-public.spec.js` | cifro | Real |
| `02-home-cifras.spec.js` | cifro | Real |
| `03-music-view.spec.js` | cifro | Real (incompleto) |
| `04-editor-musicas.spec.js` | cifro | Real (67 testes) |
| `05-config.spec.js` | cifro | Real (incompleto) |
| `06-usuarios.spec.js` | cifro | Real |
| `07-bandas.spec.js` | cifro | Real |
| `08-roteiro.spec.js` | cifro | Real |
| `09-sync-api.spec.js` | cifro | Real |
| `10-seguranca.spec.js` | cifro | Real |
| `11-topnav.spec.js` | cifro | Real |
| `12-planos.spec.js` | **ignorado** | Não roda (requer Stripe real) |
| `13-live-mode.spec.js` | cifro | Real (48 testes) |
| `14-senha-reset.spec.js` | cifro | Real |
| `20-planos.spec.js` | cifro | Real parcial |
| `21-bandas-limite.spec.js` | cifro | Real |
| `22-multiband-flow.spec.js` | cifro | Real |
| `23-perfis-permissoes.spec.js` | cifro | Real |
| `26-offline-sync.spec.js` | pwa | Real |
| `27-sync-revision.spec.js` | cifro | Real |
| `31-browser-branch-matrix.spec.js` | coverage | **Fake** — mega-spec evaluate() |
| `32-rehearsal-real-flow.spec.js` | serial | Real |
| `33-presentation-mode.spec.js` | cifro | Híbrido — entrada via evaluate() |
| `34-rehearsal-state.spec.js` | serial | Híbrido — asserts via evaluate() |
| `35-google-auth.spec.js` | cifro | Real (API) |
| `36-music-view-branches.spec.js` | coverage | **Fake** — remove DOM |
| `37-rehearsal-audio-youtube-branches.spec.js` | coverage | Fake não-migrável (WaveSurfer) |
| `38-offline-tools-branches.spec.js` | coverage | Fake não-migrável (SW internals) |
| `39-script-branches.spec.js` | coverage | **Fake** — remove DOM / evaluate() |
| `40-php-under80-coverage.spec.js` | coverage | Real (API pura) |
| `41-php-under80-endpoints.spec.js` | coverage | Híbrido — majoritariamente real |
| `42-php-endpoint-residual-branches.spec.js` | coverage | Real (API pura) |
| `43-js-residual-branches.spec.js` | coverage | **Fake** — tudo via evaluate() |
| `44-js-ui-fallbacks.spec.js` | coverage | Fake não-migrável (localStorage bloqueado) |
| `45-cifro-sync-validation.spec.js` | coverage | Legítimo (page.route + payloads inválidos) |
| `46-editor-residual-branches.spec.js` | coverage | **Fake** — cifroConfirm substituído |
| `47-live-residual-branches.spec.js` | coverage | **Fake** — DOM injetado manual |
| `48-rehearsal-audio-pitch-residual.spec.js` | coverage | Fake não-migrável (AudioContext) |

---

## Fases de migração — por prioridade de criticidade

---

### FASE 0 — Segurança

**Estado atual:** `10-seguranca.spec.js` cobre CSRF, autenticação e perfis. Bom, mas incompleto.

**Gaps identificados:**
- Sem teste de rate limit / força bruta no login
- Sem teste de acesso cross-banda via API direta (usuário da banda A tentando ler dados da banda B)
- Sem teste de acesso negado por perfil em endpoints de API (gestor tentando deletar usuário)

**Ação:**
- Expandir `10-seguranca.spec.js` com:
  - `POST /login.php` múltiplas vezes com senha errada → verificar bloqueio ou resposta consistente
  - `GET /api/sync/data.php?banda_id=<banda_alheia>` autenticado como usuário de outra banda → deve retornar 403
  - `DELETE /src/backend/users/salvar_user.php` com perfil `basico` → deve retornar 403
- Não há arquivo fake a deletar — são adições puras

**Arquivos a criar/modificar:** `10-seguranca.spec.js`
**Arquivos a deletar:** nenhum

---

### FASE 1 — Plano & Pagamento

**Estado atual:**
- `12-planos.spec.js` ignorado pelo projeto `cifro` (nunca roda)
- Webhook Stripe (`/api/stripe/webhook.php`) nunca testado E2E
- Limites de plano testados em `21-bandas-limite.spec.js` (real, bom)
- `StripeCheckoutHelperTest.php` e `StripeWebhookHelperTest.php` testam helpers em PHP puro

**Gaps identificados:**
- Webhook de pagamento: nenhum teste que simule um POST real do Stripe e verifique que o plano da banda muda no banco
- Fluxo de checkout: botão → `create-checkout-session.php` → URL gerada — nunca testado E2E
- Plano expirado: sem teste que verifica bloqueio de acesso após validade

**Ação:**
- Criar `52-stripe-webhook.spec.js` no projeto `cifro`:
  - `POST /api/stripe/webhook.php` com payload `checkout.session.completed` assinado com `STRIPE_WEBHOOK_SECRET=whsec_playwright` (já configurado no webServer do playwright.config.js)
  - Verificar via SQL ou API que o plano da banda mudou
  - Testar `invoice.paid` → renovação
  - Testar `customer.subscription.deleted` → volta para gratuito
- Expandir `20-planos.spec.js`:
  - Clicar em "Assinar mensal" → verificar que `POST /api/stripe/create-checkout-session.php` retorna URL válida (interceptar com `page.route` ou verificar redirect)
- Reativar e corrigir `12-planos.spec.js` ou absorver seus casos no `20-planos.spec.js`

**Arquivos a criar:** `52-stripe-webhook.spec.js`
**Arquivos a modificar:** `20-planos.spec.js`
**Arquivos a deletar:** `12-planos.spec.js` (absorvido)

---

### FASE 2 — Autenticação & Acesso

**Estado atual:**
- Login/logout/cadastro cobertos em `01-public.spec.js` (real)
- Reset de senha coberto em `14-senha-reset.spec.js` (real)
- Google OAuth testado via API em `35-google-auth.spec.js`

**Gaps identificados:**
- Login com Google: botão existe na UI mas o fluxo E2E real (clica → redirect Google → volta logado) nunca foi testado — é inviável testar o redirect externo, mas o callback com token real pode ser testado via `page.route`
- Fluxo de convite: admin convida → usuário recebe token → acessa `/definir-senha.php?token=X` → define senha → loga — fluxo completo nunca testado E2E
- Definir senha com token expirado: sem teste de clique real

**Ação:**
- Expandir `14-senha-reset.spec.js`:
  - Criar usuário sem senha (via API de convite), acessar `/definir-senha.php?token=X` real, preencher campos, submeter, verificar redirect para login
  - Acessar `/definir-senha.php?token=invalido` → verificar mensagem de erro na tela
- Expandir `35-google-auth.spec.js`:
  - Verificar que botão "Continuar com Google" existe e aponta para URL correta
  - Simular callback com token via `page.route` interceptando `/api/auth/google/callback.php`

**Arquivos a modificar:** `14-senha-reset.spec.js`, `35-google-auth.spec.js`
**Arquivos a deletar:** nenhum

---

### FASE 3 — Visualização de Música

**Estado atual:**
- `03-music-view.spec.js` tem cobertura básica real
- Auto-scroll, transposição, modo letra, apresentação cobertos via `evaluate()` no `31` e `33`
- `33-presentation-mode.spec.js` usa `window.cifroPresentation.enter()` em vez de clicar no botão

**Gaps identificados:**
- Transposição: clique real nos botões `+`/`-` de tom → verificar que o acorde na tela muda
- Auto-scroll: clicar no toggle real → verificar que a classe/comportamento muda
- Ajuste de velocidade: slider real
- Modo letra: toggle real → verificar que acordes somem
- Modo apresentação: clicar no botão real (não chamar `cifroPresentation.enter()`)

**Ação:**
- Expandir `03-music-view.spec.js` com testes de clique real para todos os controles acima
- Reescrever `33-presentation-mode.spec.js`: substituir `window.cifroPresentation.enter()` por clique no botão real de fullscreen/apresentação
- Após verificar cobertura mantida, deletar as seções correspondentes do `31` e `36`

**Arquivos a modificar:** `03-music-view.spec.js`, `33-presentation-mode.spec.js`
**Arquivos a deletar:** `36-music-view-branches.spec.js` (partes migradas do `31`)

---

### FASE 4 — Sincronização & Offline

**Estado atual:** Melhor coberto entre todas as categorias.
- `09-sync-api.spec.js`: endpoints reais
- `27-sync-revision.spec.js`: conflito de revisão real
- `26-offline-sync.spec.js`: Service Worker real (projeto pwa)
- `45-cifro-sync-validation.spec.js`: `page.route()` com payloads inválidos — **legítimo, não migrar**

**Gaps identificados:**
- Fluxo completo offline via UI: usuário cria música offline (sem rede) → reconecta → sync dispara → música aparece no servidor — testado via SW mas sem interação real do usuário
- `50-connectivity-server.spec.js`: verificar cobertura atual

**Ação:**
- Verificar o que `50-connectivity-server.spec.js` cobre e se há gaps
- Adicionar em `26-offline-sync.spec.js` o fluxo: criar música com rede bloqueada via `page.route('**')` → reabilitar rede → verificar sync via UI (toast de sucesso)
- Manter `45` como está — `page.route()` com payloads inválidos é técnica correta

**Arquivos a modificar:** `26-offline-sync.spec.js`
**Arquivos a deletar:** nenhum

---

### FASE 5 — Músicas & Editor

**Estado atual:** `04-editor-musicas.spec.js` com 67 testes reais — melhor coberto do projeto.

**Gaps identificados:**
- Cenário de erro ao salvar: `46` substitui `window.cifroConfirm` para simular cancelamento — nunca testado o dialog real
- Falha de rede ao salvar (`abort`): coberta via `46` com `page.route` que aborta — isso é legítimo, mas o teste usa DOM artificial
- Conflito de revisão no editor: coberto via API em `27`, mas sem teste de clique no editor real
- Importação do CifraClub: `page.route` interceptando o fetch — verificar se já está em `04`

**Ação:**
- Expandir `04-editor-musicas.spec.js`:
  - Simular falha de rede no save via `page.route('**/editor/api.php', route => route.abort())` → verificar toast de erro na tela
  - Simular HTTP 500 no save → verificar mensagem de erro
  - Usar `page.on('dialog', dialog => dialog.dismiss())` para testar cancelamento real do confirm nativo (se aplicável) ou verificar o `cifroConfirm` customizado via clique no botão "Cancelar" do dialog
- Deletar `46` após migração

**Arquivos a modificar:** `04-editor-musicas.spec.js`
**Arquivos a deletar:** `46-editor-residual-branches.spec.js`

---

### FASE 6 — Banda & Usuários

**Estado atual:** `06-usuarios.spec.js`, `07-bandas.spec.js`, `22-multiband-flow.spec.js` com boa cobertura real.

**Gaps identificados:**
- Fluxo de convite ponta a ponta: admin convida membro → token gerado → usuário acessa link → define senha → loga → aparece na banda — nunca testado como fluxo único
- Limite de membros por plano: verificar se `21-bandas-limite.spec.js` cobre negação de adição de membro além do limite

**Ação:**
- Criar `53-convite-ponta-a-ponta.spec.js`:
  - Admin cria usuário → endpoint retorna token → acessar `/definir-senha.php?token=X` → definir senha → login → verificar que usuário aparece na lista da banda
- Verificar `21-bandas-limite.spec.js` para limite de membros e adicionar caso se faltar

**Arquivos a criar:** `53-convite-ponta-a-ponta.spec.js`
**Arquivos a deletar:** nenhum

---

### FASE 7 — Modo Live

**Estado atual:** `13-live-mode.spec.js` com 48 testes reais — boa cobertura.

**Gaps identificados:**
- `47-live-residual-branches.spec.js`: testa branches do `live.js` em DOM injetado manualmente em `login.php` — deveria estar na página real `/live.php`
- Branches de erro (polling falha, assumir host sem ser host) testados em ambiente artificial

**Ação:**
- Mover os 3 testes de `47` para dentro de `13-live-mode.spec.js` usando a página real:
  - Substituir DOM injetado por navegação real para `/live.php`
  - Substituir `page.route` com stubs por interceptações reais dos endpoints live
  - Remover `window.LiveMode.assumirHost()` via evaluate — usar clique no botão real
- Deletar `47` após migração

**Arquivos a modificar:** `13-live-mode.spec.js`
**Arquivos a deletar:** `47-live-residual-branches.spec.js`

---

### FASE 8 — Playlists & Roteiros

**Estado atual:** Gap pequeno. Playlists cobertas em `04`, roteiros em `08`.

**Gaps identificados:**
- Visualização de playlist para público (link compartilhado): sem teste
- Roteiro com `visivel_ate` expirado: comportamento de acesso após vencimento sem teste

**Ação:**
- Expandir `08-roteiro.spec.js`:
  - Criar roteiro com validade futura → acessar como não-logado → deve carregar
  - Criar roteiro com validade passada → acessar como não-logado → deve bloquear
- Adicionar em `04-editor-musicas.spec.js` o fluxo de visualização de playlist pública

**Arquivos a modificar:** `08-roteiro.spec.js`, `04-editor-musicas.spec.js`
**Arquivos a deletar:** nenhum

---

### FASE 9 — Modo Ensaio

**Estado atual:** `32-rehearsal-real-flow.spec.js` é o spec mais completo e real do projeto.

**Gaps identificados:**
- `34-rehearsal-state.spec.js`: abre o painel por clique real (correto), mas todos os asserts são via `window.Rehearsal.state.normalizeState()` — nunca verifica o que aparece na UI
- Os testes do `34` validam a lógica interna do módulo de estado, não o comportamento visível

**Ação:**
- Avaliar cada teste do `34` e migrar asserts para verificar a UI:
  - Salvar estado → recarregar página → verificar que o valor persiste no slider/input visível
  - Estado corrompido no localStorage → verificar que o painel carrega com valores padrão sem crash
- Manter os testes que verificam comportamento não-visível como testes unitários JS puros em `tests/music-youtube-panel-state.test.js` (já existe)
- `37` e `48` — manter como estão (WaveSurfer / AudioContext não são migráveis)

**Arquivos a modificar:** `34-rehearsal-state.spec.js`
**Arquivos a deletar:** partes absorvidas por `tests/music-youtube-panel-state.test.js`

---

### FASE 10 — Configurações

**Estado atual:** `05-config.spec.js` com cobertura básica. Tema e tamanho de cifra cobertos via `evaluate()` no `31`.

**Gaps identificados:**
- Troca de tema (claro/escuro): toggle na UI → verificar que `data-theme` muda no `<html>`
- Ajuste de tamanho da cifra: slider/botão na tela → verificar que `font-size` muda
- Sync manual: botão "Sincronizar agora" → verificar toast de confirmação
- Essas ações existem na UI mas são chamadas via `window.cifroTheme.set()` no `31`

**Ação:**
- Expandir `05-config.spec.js`:
  - Clicar no toggle de tema → verificar `document.documentElement.dataset.theme`
  - Clicar nos botões de tamanho de cifra → verificar mudança visual
  - Clicar em "Sincronizar agora" → verificar toast ou indicador de status
- Deletar as seções correspondentes do `31`

**Arquivos a modificar:** `05-config.spec.js`
**Arquivos a deletar:** seções do `31-browser-branch-matrix.spec.js` (deletar o arquivo inteiro ao fim)

---

## Arquivos não-migráveis — manter como estão

| Arquivo | Razão |
|---|---|
| `37-rehearsal-audio-youtube-branches.spec.js` | WaveSurfer requer hardware de áudio |
| `38-offline-tools-branches.spec.js` | Internals do Service Worker não têm interface de usuário |
| `44-js-ui-fallbacks.spec.js` | `localStorage` bloqueado é cenário de privacidade/segurança do browser |
| `48-rehearsal-audio-pitch-residual.spec.js` | `AudioContext` e pitch shifting requerem hardware |
| `45-cifro-sync-validation.spec.js` | `page.route()` com payloads inválidos é técnica E2E legítima |
| `40-php-under80-coverage.spec.js` | Já são testes reais de API — apenas renomear/reclassificar |
| `42-php-endpoint-residual-branches.spec.js` | Já são testes reais de API boundary |

---

## Resultado esperado ao fim

| Métrica | Antes | Depois |
|---|---|---|
| Arquivos fake no projeto `coverage` | 10 | 3 (não-migráveis) |
| Testes que usam `page.evaluate()` para substituir clique | ~200 | ~0 |
| Cobertura garantida por clique real | ~40% | ~85% |
| Tempo de suite `cifro` | ~15 min | ~20 min (mais testes reais) |
| Confiança nos resultados | Baixa | Alta |

---

## Ordem de execução

```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 5 → Fase 6 → Fase 7 → Fase 4 → Fase 8 → Fase 9 → Fase 10
```
*(Fase 4 depois de 5 pois o sync depende do editor funcionar)*
