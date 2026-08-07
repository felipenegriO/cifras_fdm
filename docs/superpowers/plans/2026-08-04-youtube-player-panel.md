# Player de vídeo do YouTube embutido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na tela de música, permitir colar o link de um vídeo do YouTube e assisti-lo embutido num painel lateral com três estados (aberto, minimizado, oculto), sem precisar trocar de aba — mantendo a busca em si (que não pode ser embutida) abrindo numa aba nova, como já é hoje.

**Architecture:** Um módulo JS puro (`music-youtube-panel-state.js`, sem DOM, testável via `node --test`) cuida da leitura/gravação do estado no `localStorage`. Um segundo módulo (`music-youtube-panel.js`) faz a manipulação de DOM: cria/destrói o `<iframe>` do embed, aplica classes de estado no painel, e liga os botões da interface. O painel e os novos controles da aba "Ferramentas" são markup estático adicionado a `music.php`. O parsing de link/ID do YouTube reaproveita `Rehearsal.youtube.extractYoutubeVideoId`/`fetchYoutubeMeta`, já existentes em `rehearsal.youtube.js` — esse script passa a ser carregado sempre (hoje só carrega sob demanda ao abrir o Modo Ensaio).

**Tech Stack:** JS vanilla (padrão IIFE `(function(root){...})(typeof window !== 'undefined' ? window : globalThis)` já usado em `chords.js`), Node `node --test` para os testes puros, CSS puro (variáveis do tema já existentes).

## Global Constraints

- A busca do YouTube continua abrindo em aba nova (`target="_blank"`) — **não** é embutida (tecnicamente inviável: YouTube bloqueia embed da página de busca via `X-Frame-Options`/`frame-ancestors`).
- Só a página de embed de um vídeo específico (`https://www.youtube.com/embed/{videoId}`) é embutida.
- Estado por música, chave `cifroYoutubePanel:{musicaId}` no `localStorage`, valor `{ "videoId": string, "title": string, "state": "open"|"minimized"|"hidden" }`.
- Ao carregar a tela de música: se houver estado salvo com `state !== "hidden"`, restaura o painel nesse estado (recriando o iframe). Se `state === "hidden"`, **não** recria o iframe automaticamente — só mostra o botão "Mostrar vídeo: {title}" na aba Ferramentas.
- Trocar de música (nova navegação para outra URL de `music.php?id=`) destrói o iframe da música anterior — o vídeo para de tocar.
- Painel desktop (`min-width: 768px`): fixo à direita, `width: 40vw` (min `320px`, max `480px`), altura total da tela.
- Painel mobile (`< 768px`): fixo na base, `width: 100vw`, `height: 60vh`.
- Miniatura minimizada: `220px × 124px` (16:9), canto inferior direito, com barra fina de restaurar/fechar.
- O mesmo elemento `<iframe>` nunca é recriado ao alternar entre aberto ↔ minimizado (só reposicionado via CSS) — só é destruído ao ocultar, fechar ou trocar de vídeo/música.

---

### Task 1: Módulo de estado puro (`music-youtube-panel-state.js`)

**Files:**
- Create: `public/src/js/music-youtube-panel-state.js`
- Test: `tests/music-youtube-panel-state.test.js`
- Modify: `package.json` (script `test:unit:js`)

**Interfaces:**
- Produces: `window.CifroYoutubePanelState` (e `globalThis.CifroYoutubePanelState` sob Node) com:
  - `VALID_STATES: ['open', 'minimized', 'hidden']`
  - `storageKey(musicaId: string|number): string` → `'cifroYoutubePanel:' + String(musicaId)`
  - `parseStored(raw: string|null): { videoId: string, title: string, state: 'open'|'minimized'|'hidden' } | null` — retorna `null` se `raw` for vazio, não for JSON válido, faltar `videoId` (string não vazia), ou `state` não for um dos `VALID_STATES`.
  - `serialize(entry: { videoId: string, title?: string, state: string }): string` — retorna a string JSON pronta pra gravar no `localStorage` (sempre inclui `title` como string, mesmo que vazia).

Consumido pela Task 4 (`music-youtube-panel.js`), que faz as chamadas reais de `localStorage.getItem`/`setItem` usando essas funções puras.

- [ ] **Step 1: Escrever os testes**

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import '../public/src/js/music-youtube-panel-state.js';

const panelState = globalThis.CifroYoutubePanelState;

test('storageKey monta a chave prefixada pela música', () => {
  assert.equal(panelState.storageKey(42), 'cifroYoutubePanel:42');
  assert.equal(panelState.storageKey('abc'), 'cifroYoutubePanel:abc');
});

test('parseStored retorna null para entrada vazia ou ausente', () => {
  assert.equal(panelState.parseStored(null), null);
  assert.equal(panelState.parseStored(''), null);
});

test('parseStored retorna null para JSON inválido', () => {
  assert.equal(panelState.parseStored('{not json'), null);
});

test('parseStored retorna null quando falta videoId', () => {
  assert.equal(panelState.parseStored(JSON.stringify({ state: 'open' })), null);
  assert.equal(panelState.parseStored(JSON.stringify({ videoId: '', state: 'open' })), null);
});

test('parseStored retorna null para state fora de VALID_STATES', () => {
  assert.equal(panelState.parseStored(JSON.stringify({ videoId: 'abc123', state: 'tocando' })), null);
});

test('parseStored aceita entrada válida e preenche title vazio quando ausente', () => {
  const result = panelState.parseStored(JSON.stringify({ videoId: 'abc123def45', state: 'minimized' }));
  assert.deepEqual(result, { videoId: 'abc123def45', title: '', state: 'minimized' });
});

test('parseStored preserva o title quando presente', () => {
  const result = panelState.parseStored(JSON.stringify({ videoId: 'abc123def45', title: 'Minha música', state: 'open' }));
  assert.deepEqual(result, { videoId: 'abc123def45', title: 'Minha música', state: 'open' });
});

test('serialize produz JSON com title vazio como padrão', () => {
  const json = panelState.serialize({ videoId: 'abc123def45', state: 'open' });
  assert.deepEqual(JSON.parse(json), { videoId: 'abc123def45', title: '', state: 'open' });
});

test('serialize preserva o title informado', () => {
  const json = panelState.serialize({ videoId: 'abc123def45', title: 'Minha música', state: 'hidden' });
  assert.deepEqual(JSON.parse(json), { videoId: 'abc123def45', title: 'Minha música', state: 'hidden' });
});

test('round-trip: parseStored(serialize(x)) preserva os dados', () => {
  const entry = { videoId: 'xyz987uvw65', title: 'Teste', state: 'minimized' };
  assert.deepEqual(panelState.parseStored(panelState.serialize(entry)), entry);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node --test tests/music-youtube-panel-state.test.js`
Expected: FAIL — `Cannot find module '../public/src/js/music-youtube-panel-state.js'` (arquivo ainda não existe).

- [ ] **Step 3: Implementar o módulo**

```javascript
(function (root) {
  const STORAGE_PREFIX = 'cifroYoutubePanel:';
  const VALID_STATES = ['open', 'minimized', 'hidden'];

  function storageKey(musicaId) {
    return STORAGE_PREFIX + String(musicaId);
  }

  function parseStored(raw) {
    if (!raw) return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.videoId !== 'string' || parsed.videoId === '') return null;
    if (typeof parsed.state !== 'string' || !VALID_STATES.includes(parsed.state)) return null;
    return {
      videoId: parsed.videoId,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      state: parsed.state
    };
  }

  function serialize(entry) {
    return JSON.stringify({
      videoId: entry.videoId,
      title: typeof entry.title === 'string' ? entry.title : '',
      state: entry.state
    });
  }

  root.CifroYoutubePanelState = {
    VALID_STATES: VALID_STATES.slice(),
    storageKey,
    parseStored,
    serialize
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node --test tests/music-youtube-panel-state.test.js`
Expected: PASS (10 testes).

- [ ] **Step 5: Registrar o teste no script de suíte JS**

Em `package.json`, o script `test:unit:js` hoje roda só `tests/chords.test.js`. Atualize para rodar os dois arquivos:

```json
"test:unit:js": "node --test tests/chords.test.js tests/music-youtube-panel-state.test.js",
```

- [ ] **Step 6: Rodar a suíte JS completa e confirmar que passa**

Run: `npm run test:unit:js`
Expected: PASS (todos os testes de `chords.test.js` + os 10 novos).

- [ ] **Step 7: Commit**

```bash
git add public/src/js/music-youtube-panel-state.js tests/music-youtube-panel-state.test.js package.json
git commit -m "feat: módulo de estado puro do painel de vídeo do YouTube"
```

---

### Task 2: Markup do painel e dos novos controles em `music.php`

**Files:**
- Modify: `public/src/Views/music.php`

**Interfaces:**
- Produces: elementos DOM com os IDs abaixo, consumidos pela Task 4:
  - `#youtubeVideoLinkInput` (input de texto)
  - `#btnTocarYoutubeAqui` (botão)
  - `#youtubeVideoLinkError` (div de erro inline, `hidden` por padrão)
  - `#youtubeShowPanelRow` (linha inteira do botão "Mostrar vídeo", `hidden` por padrão) contendo `#btnMostrarYoutube` (botão) e `#youtubeShowPanelTitle` (span com o título do vídeo)
  - `#youtubePlayerPanel` (painel raiz, sem classe `is-open`/`is-minimized` por padrão = oculto), com `#youtubePlayerPanelTitle` (título no header), `#youtubePlayerPanelBody` (container vazio onde a Task 4 insere o `<iframe>`), `#btnYoutubePanelMinimize`, `#btnYoutubePanelRestore`, `#btnYoutubePanelClose` (fecha a partir do estado aberto), `#btnYoutubePanelCloseMini` (fecha a partir do estado minimizado).
- Consumes: nenhuma (task só de markup) — mas depende de `Rehearsal.youtube` (Task 2 também troca o carregamento de `rehearsal.youtube.js` de sob-demanda para sempre-carregado).

O botão "Pesquisar no YouTube" (`#linkYou`) existente **não muda**.

- [ ] **Step 1: Adicionar o input/botão de "tocar aqui" e a linha de "mostrar vídeo" na seção de Ferramentas**

Em `public/src/Views/music.php`, localize o bloco (por volta da linha 217-223):

```html
                <details class="music-tool">
                    <summary>Ensaio com YouTube e áudio</summary>
                    <div class="music-tool__content">
                        <a href="" id="linkYou" target="_blank" rel="noopener" class="music-secondary-action music-full-action">Pesquisar no YouTube</a>
                        <button type="button" id="btnAtivarEnsaio" class="music-primary-action music-full-action">Abrir painel de ensaio</button>
                    </div>
                </details>
```

Substitua por (mantendo os dois elementos originais intactos e adicionando os novos logo abaixo):

```html
                <details class="music-tool">
                    <summary>Ensaio com YouTube e áudio</summary>
                    <div class="music-tool__content">
                        <a href="" id="linkYou" target="_blank" rel="noopener" class="music-secondary-action music-full-action">Pesquisar no YouTube</a>
                        <button type="button" id="btnAtivarEnsaio" class="music-primary-action music-full-action">Abrir painel de ensaio</button>

                        <div class="music-yt-inline-form">
                            <label for="youtubeVideoLinkInput" class="music-yt-inline-form__label">Colar link do vídeo</label>
                            <div class="music-yt-inline-form__row">
                                <input type="text" id="youtubeVideoLinkInput" class="music-yt-inline-form__input" placeholder="https://www.youtube.com/watch?v=...">
                                <button type="button" id="btnTocarYoutubeAqui" class="music-secondary-action">Tocar aqui</button>
                            </div>
                            <p id="youtubeVideoLinkError" class="music-yt-inline-form__error" hidden>Link do YouTube inválido.</p>
                        </div>

                        <div id="youtubeShowPanelRow" class="music-tool-actions" hidden style="grid-template-columns: 1fr;">
                            <button type="button" id="btnMostrarYoutube" class="music-secondary-action music-full-action">Mostrar vídeo: <span id="youtubeShowPanelTitle"></span></button>
                        </div>
                    </div>
                </details>
```

- [ ] **Step 2: Adicionar o markup do painel flutuante**

Ainda em `music.php`, logo antes da tag de fechamento `</body>` (ou, se preferir, logo após o fechamento da `<aside id="sideMenu">` na linha ~243 — qualquer lugar fora dos outros `<aside>` serve, pois o painel é posicionado via `position: fixed`), adicione:

```html
    <div id="youtubePlayerPanel" role="complementary" aria-label="Player de vídeo do YouTube">
        <div class="yt-panel__header">
            <span class="yt-panel__title" id="youtubePlayerPanelTitle"></span>
            <div class="yt-panel__header-actions">
                <button type="button" id="btnYoutubePanelMinimize" aria-label="Minimizar vídeo">−</button>
                <button type="button" id="btnYoutubePanelClose" aria-label="Ocultar vídeo">×</button>
            </div>
        </div>
        <div class="yt-panel__body" id="youtubePlayerPanelBody"></div>
        <div class="yt-panel__mini-bar">
            <button type="button" id="btnYoutubePanelRestore" aria-label="Restaurar vídeo">Restaurar</button>
            <button type="button" id="btnYoutubePanelCloseMini" aria-label="Ocultar vídeo">×</button>
        </div>
    </div>
```

- [ ] **Step 3: Trocar o carregamento de `rehearsal.youtube.js` de sob-demanda para sempre-carregado**

`rehearsal.youtube.js` não depende de wavesurfer/soundtouch (é um módulo puro de parsing/oEmbed) — hoje ele só é buscado dentro de `loadRehearsal()` (função `setupEnsaioButton`, por volta da linha 386-410), junto com o resto da cadeia pesada do Modo Ensaio. Ele precisa estar disponível **antes** de o usuário clicar em "Tocar aqui", então passa a ser um `<script>` normal da página.

Localize, próximo aos outros `<script src="...">` da página (por volta da linha 462-464, onde está `music-view.js`):

```html
    <script src="<?= asset_url('/src/js/music-view.js') ?>" defer></script>
```

Adicione logo acima (sem `defer`, para garantir que `window.Rehearsal.youtube` já exista quando `music-youtube-panel.js` rodar no `DOMContentLoaded`):

```html
    <script src="<?= asset_url('/src/js/rehearsal/rehearsal.youtube.js') ?>"></script>
    <script src="<?= asset_url('/src/js/music-youtube-panel-state.js') ?>"></script>
    <script src="<?= asset_url('/src/js/music-youtube-panel.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/music-view.js') ?>" defer></script>
```

(`music-youtube-panel.js` é criado na Task 4 — o `<script>` aqui referencia um arquivo que ainda não existe até lá; isso é esperado, só cause 404 silencioso até a Task 4 criar o arquivo, sem quebrar o resto da página.)

- [ ] **Step 4: Verificar sintaxe**

Run: `"/c/xampp/php/php.exe" -l public/src/Views/music.php`
Expected: `No syntax errors detected`.

- [ ] **Step 5: Commit**

```bash
git add public/src/Views/music.php
git commit -m "feat: markup do painel de vídeo do YouTube e dos novos controles em Ferramentas"
```

---

### Task 3: CSS do painel

**Files:**
- Modify: `public/src/css/music-view.css`

**Interfaces:**
- Consumes: os IDs/classes definidos na Task 2 (`#youtubePlayerPanel`, `.yt-panel__*`, `#youtubeShowPanelRow`, `.music-yt-inline-form*`).
- Produces: nada consumido por outra task — CSS puro.

- [ ] **Step 1: Adicionar os estilos**

No fim de `public/src/css/music-view.css`, adicione:

```css
/* ===== Player de vídeo do YouTube embutido ===== */

.music-yt-inline-form {
    display: grid;
    gap: 6px;
    margin-top: 4px;
}

.music-yt-inline-form__label {
    color: var(--text-2);
    font-size: 12px;
}

.music-yt-inline-form__row {
    display: flex;
    gap: 8px;
}

.music-yt-inline-form__input {
    flex: 1;
    min-width: 0;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--border-2);
    border-radius: 9px;
    background: var(--bg-2);
    color: var(--text-1);
    font: inherit;
    font-size: 13px;
}

.music-yt-inline-form__input:focus {
    outline: none;
    border-color: var(--brand);
}

.music-yt-inline-form__error {
    margin: 0;
    color: var(--danger, #ef4444);
    font-size: 12px;
}

#youtubePlayerPanel {
    display: none;
    position: fixed;
    z-index: 950;
    background: var(--bg-elevated, #1f1f25);
    color: var(--text-1);
    border: 1px solid var(--border-1);
    box-shadow: -18px 0 50px rgba(0, 0, 0, .35);
    flex-direction: column;
}

#youtubePlayerPanel.is-open,
#youtubePlayerPanel.is-minimized {
    display: flex;
}

/* Estado aberto: desktop */
#youtubePlayerPanel.is-open {
    top: 0;
    right: 0;
    bottom: 0;
    width: 40vw;
    min-width: 320px;
    max-width: 480px;
    border-left-width: 1px;
    border-top: none;
    border-right: none;
    border-bottom: none;
}

.yt-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-1);
}

.yt-panel__title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: var(--fw-medium);
}

.yt-panel__header-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}

.yt-panel__header-actions button,
.yt-panel__mini-bar button {
    min-width: 32px;
    min-height: 32px;
    border: 1px solid var(--border-2);
    border-radius: 7px;
    background: var(--bg-2);
    color: var(--text-1);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
}

.yt-panel__header-actions button:hover,
.yt-panel__mini-bar button:hover {
    background: var(--bg-3);
}

.yt-panel__body {
    flex: 1;
    min-height: 0;
}

.yt-panel__body iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
}

.yt-panel__mini-bar {
    display: none;
}

/* Estado minimizado: miniatura flutuante */
#youtubePlayerPanel.is-minimized {
    top: auto;
    left: auto;
    bottom: 16px;
    right: 16px;
    width: 220px;
    min-width: 0;
    max-width: none;
    height: 124px;
    border-radius: 10px;
    overflow: hidden;
    border-width: 1px;
}

#youtubePlayerPanel.is-minimized .yt-panel__header {
    display: none;
}

#youtubePlayerPanel.is-minimized .yt-panel__mini-bar {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 1;
    padding: 0;
    border: 0;
    background: transparent;
}

#youtubePlayerPanel.is-minimized {
    position: fixed;
}

#youtubePlayerPanel.is-minimized .yt-panel__body {
    height: 100%;
}

@media (max-width: 767px) {
    #youtubePlayerPanel.is-open {
        top: auto;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        min-width: 0;
        max-width: none;
        height: 60vh;
        border-left: none;
        border-top: 1px solid var(--border-1);
    }
}
```

- [ ] **Step 2: Verificação visual isolada**

Sem depender de login: crie um arquivo temporário fora do controle de versão (ex.: `public/yt-panel-style-check-tmp.html`, apagado ao final do passo) com o markup da Task 2 (painel + inputs) e `<link>` para `theme.css` e `music-view.css`. Abra no navegador (Browser pane), aplique a classe `is-open` via `javascript_tool`, confirme visualmente a largura/posicionamento à direita; troque para `is-minimized` e confirme o encolhimento para o canto inferior direito. Apague o arquivo temporário ao final — não faz parte do commit desta task.

- [ ] **Step 3: Commit**

```bash
git add public/src/css/music-view.css
git commit -m "feat: estilos do painel de vídeo do YouTube (aberto/minimizado/responsivo)"
```

---

### Task 4: Wiring de DOM (`music-youtube-panel.js`)

**Files:**
- Create: `public/src/js/music-youtube-panel.js`

**Interfaces:**
- Consumes:
  - `window.CifroYoutubePanelState` (Task 1): `storageKey`, `parseStored`, `serialize`.
  - `window.Rehearsal.youtube` (já existente em `rehearsal.youtube.js`): `extractYoutubeVideoId(input): string|null`, `fetchYoutubeMeta(videoId): Promise<{title, thumbnailUrl}|null>`.
  - Elementos DOM da Task 2 (todos os IDs listados na interface daquela task).
  - `urlParams.get('id')` — o id da música atual já é lido em `music.php` numa variável local `songId` (linha ~707); como este é um arquivo JS separado, releia `new URLSearchParams(window.location.search).get('id')` diretamente dentro deste módulo (não depende de nenhuma variável de `music.php`).
- Produces: nenhuma função pública é consumida por outro arquivo — é o wiring final, roda sozinho em `DOMContentLoaded`.

- [ ] **Step 1: Implementar o módulo**

```javascript
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        const panelState = window.CifroYoutubePanelState;
        const youtubeModule = window.Rehearsal && window.Rehearsal.youtube;
        if (!panelState || !youtubeModule) return;

        const musicaId = new URLSearchParams(window.location.search).get('id');
        if (!musicaId) return;

        const panel = document.getElementById('youtubePlayerPanel');
        const panelTitle = document.getElementById('youtubePlayerPanelTitle');
        const panelBody = document.getElementById('youtubePlayerPanelBody');
        const btnMinimize = document.getElementById('btnYoutubePanelMinimize');
        const btnRestore = document.getElementById('btnYoutubePanelRestore');
        const btnClose = document.getElementById('btnYoutubePanelClose');
        const btnCloseMini = document.getElementById('btnYoutubePanelCloseMini');
        const linkInput = document.getElementById('youtubeVideoLinkInput');
        const btnTocarAqui = document.getElementById('btnTocarYoutubeAqui');
        const linkError = document.getElementById('youtubeVideoLinkError');
        const showPanelRow = document.getElementById('youtubeShowPanelRow');
        const btnMostrar = document.getElementById('btnMostrarYoutube');
        const showPanelTitle = document.getElementById('youtubeShowPanelTitle');
        if (!panel || !panelTitle || !panelBody) return;

        let current = null; // { videoId, title, state }

        function persist() {
            if (!current) return;
            localStorage.setItem(panelState.storageKey(musicaId), panelState.serialize(current));
        }

        function destroyIframe() {
            panelBody.replaceChildren();
        }

        function createIframe(videoId) {
            const iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube.com/embed/' + encodeURIComponent(videoId);
            iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
            iframe.setAttribute('allowfullscreen', '');
            panelBody.replaceChildren(iframe);
        }

        function updateShowPanelRow() {
            if (!showPanelRow || !btnMostrar || !showPanelTitle) return;
            if (current && current.state === 'hidden') {
                showPanelTitle.textContent = current.title || current.videoId;
                showPanelRow.hidden = false;
            } else {
                showPanelRow.hidden = true;
            }
        }

        function applyStateToDom() {
            panel.classList.remove('is-open', 'is-minimized');
            if (!current) return;
            if (current.state === 'open') {
                panel.classList.add('is-open');
            } else if (current.state === 'minimized') {
                panel.classList.add('is-minimized');
            }
            panelTitle.textContent = current.title || '';
            updateShowPanelRow();
        }

        function setState(nextState, options) {
            options = options || {};
            if (!current) return;
            const cameFromHidden = current.state === 'hidden';
            current = Object.assign({}, current, { state: nextState });
            if (nextState === 'hidden') {
                destroyIframe();
            } else if (cameFromHidden || options.forceRecreateIframe) {
                createIframe(current.videoId);
            }
            persist();
            applyStateToDom();
        }

        function loadVideo(videoId, title) {
            current = { videoId, title: title || '', state: 'open' };
            createIframe(videoId);
            persist();
            applyStateToDom();
        }

        function showLinkError(message) {
            if (!linkError) return;
            linkError.textContent = message;
            linkError.hidden = false;
        }

        function clearLinkError() {
            if (!linkError) return;
            linkError.hidden = true;
        }

        if (btnTocarAqui && linkInput) {
            btnTocarAqui.addEventListener('click', function () {
                clearLinkError();
                const videoId = youtubeModule.extractYoutubeVideoId(linkInput.value);
                if (!videoId) {
                    showLinkError('Link do YouTube inválido.');
                    return;
                }
                loadVideo(videoId, '');
                youtubeModule.fetchYoutubeMeta(videoId).then(function (meta) {
                    if (!meta || !current || current.videoId !== videoId) return;
                    current = Object.assign({}, current, { title: meta.title });
                    persist();
                    applyStateToDom();
                });
            });
        }

        if (btnMinimize) btnMinimize.addEventListener('click', function () { setState('minimized'); });
        if (btnRestore) btnRestore.addEventListener('click', function () { setState('open'); });
        if (btnClose) btnClose.addEventListener('click', function () { setState('hidden'); });
        if (btnCloseMini) btnCloseMini.addEventListener('click', function () { setState('hidden'); });

        // Clique na miniatura (fora dos botões da mini-bar) restaura.
        panel.addEventListener('click', function (event) {
            if (!panel.classList.contains('is-minimized')) return;
            if (event.target.closest('.yt-panel__mini-bar')) return;
            setState('open');
        });

        if (btnMostrar) {
            btnMostrar.addEventListener('click', function () {
                if (!current) return;
                setState('open', { forceRecreateIframe: true });
            });
        }

        // Restaura o estado salvo ao carregar a página.
        const stored = panelState.parseStored(localStorage.getItem(panelState.storageKey(musicaId)));
        if (stored) {
            current = stored;
            if (stored.state === 'hidden') {
                applyStateToDom();
            } else {
                createIframe(stored.videoId);
                applyStateToDom();
            }
        }
    });
})();
```

- [ ] **Step 2: Verificar sintaxe**

Run: `node --check public/src/js/music-youtube-panel.js`
Expected: sem saída (sucesso).

- [ ] **Step 3: Commit**

```bash
git add public/src/js/music-youtube-panel.js
git commit -m "feat: wiring do painel de vídeo do YouTube (abrir/minimizar/ocultar/restaurar)"
```

---

### Task 5: Verificação manual end-to-end

**Files:** nenhum (task de verificação).

- [ ] **Step 1: Rodar a suíte JS e PHP completas**

Run: `npm run test:unit:js` — Expected: todos os testes passam (incluindo os 10 novos da Task 1).
Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit` — Expected: mesma baseline de sempre (erros pré-existentes só em `GoogleJwtVerifierTest`, nada novo).

- [ ] **Step 2: `php -l` e `node --check` em todos os arquivos tocados**

```bash
"/c/xampp/php/php.exe" -l public/src/Views/music.php
node --check public/src/js/music-youtube-panel-state.js
node --check public/src/js/music-youtube-panel.js
```
Expected: todos limpos.

- [ ] **Step 3: Verificação no navegador (login real do usuário — fora do escopo desta sessão)**

Documentar para o usuário testar manualmente:
1. Abrir uma música, ir em Ajustes → Ferramentas → "Ensaio com YouTube e áudio".
2. Colar um link de vídeo do YouTube válido em "Colar link do vídeo", clicar "Tocar aqui" — painel abre à direita (desktop) ou na base (mobile), vídeo toca.
3. Clicar em minimizar (`−`) — painel encolhe para miniatura no canto inferior direito, vídeo continua tocando.
4. Clicar na miniatura — painel volta ao estado aberto.
5. Clicar em ocultar (`×`) — painel some, aparece "Mostrar vídeo: {título}" na aba Ferramentas.
6. Clicar em "Mostrar vídeo" — painel reabre com o mesmo vídeo (do início).
7. Recarregar a página com o painel aberto — painel deve restaurar automaticamente no mesmo estado.
8. Colar um link inválido (ex.: `https://google.com`) — mensagem "Link do YouTube inválido." aparece, painel não abre.
9. Navegar para outra música — painel/vídeo da música anterior não deve continuar tocando.

- [ ] **Step 4: Commit final (se algum ajuste for necessário)**

```bash
git add -A
git commit -m "fix: ajustes pós-verificação do painel de vídeo do YouTube"
```
(Pular se nada precisou de ajuste.)
