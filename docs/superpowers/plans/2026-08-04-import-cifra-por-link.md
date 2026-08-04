# Importação de cifra por link (CifraClub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No modal "Importar cifra" do editor, permitir que o usuário busque e preencha a cifra automaticamente colando um link do CifraClub, mantendo a opção atual de colar o conteúdo completo manualmente.

**Architecture:** Uma nova classe `CifraClubImportProvider` (substitui `DisabledCifraClubImportProvider`) faz fetch + parse do HTML via `DOMDocument`, com dependências de rede injetáveis (mesmo padrão de `YoutubeAudioDownloadService`) para ser testável sem rede real. Um resolver de host escolhe o provider certo. Um novo endpoint `import.php` expõe isso ao frontend. O modal do editor ganha duas abas — "Colar link" (nova) e "Colar cifra completa" (atual, sem mudanças) — e a aba de link reaproveita o preview/confirmação já existentes.

**Tech Stack:** PHP 8 (DOMDocument/DOMXPath, stream contexts), JS vanilla (editor.js, IIFE), PHPUnit.

## Global Constraints

- Apenas hosts `cifraclub.com.br` e `www.cifraclub.com.br` são aceitos (allowlist), igual à versão desativada.
- Timeout de rede: 8 segundos. Limite de tamanho de resposta: 2 MB (`max_length` no stream context).
- Endpoint novo segue exatamente o padrão de auth/CSRF de `public/src/backend/editor/api.php`: `require_band_role('gestor')`, exige `POST`, `require_csrf()`.
- O resultado do provider deve ter o formato `['title' => string, 'artist' => string, 'content' => string, 'metadata' => ['tom' => ?string, 'capo' => ?string, 'afinação' => ?string]]` — o mesmo já produzido por `parseImportedSong` no JS, para reaproveitar o preview existente sem alterar `confirmImport()`.
- Checkbox "Confirmo que tenho autorização..." continua obrigatório em ambos os modos antes de habilitar "Usar no editor".
- Trocar de aba no modal limpa o estado de preview/erro da aba anterior.

---

### Task 1: `CifraClubImportProvider` — validação de host e fetch injetável

**Files:**
- Create: `public/src/Services/CifraClubImportProvider.php`
- Test: `tests/php/CifraClubImportProviderTest.php`
- Modify: remove `public/src/Services/DisabledCifraClubImportProvider.php`
- Modify: remove `tests/php/DisabledCifraClubImportProviderTest.php`

**Interfaces:**
- Produces: `class CifraClubImportProvider implements ChordImportProvider { public function __construct(array $deps = []); public function import(string $url): array; }`
  - `$deps['httpGet']`: `callable(string $url, int $timeout): (string|false)` — injeta o fetch, default usa `file_get_contents` com stream context (timeout 8s, `max_length` 2MB, User-Agent `CifroFdm/1.0`).
  - Lança `InvalidArgumentException('URL de origem não permitida.')` para host fora da allowlist.
  - Lança `RuntimeException('Não foi possível acessar a página informada.')` quando `httpGet` retorna `false`.

Esta task cobre só a validação de host + o fetch (com dependência injetável). O parsing do HTML vem na Task 2.

- [ ] **Step 1: Escrever o teste de host inválido e de falha de rede**

```php
<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/Services/ChordImportProvider.php';
require_once __DIR__ . '/../../public/src/Services/CifraClubImportProvider.php';

final class CifraClubImportProviderTest extends TestCase
{
    public function testRejectsUnknownHosts(): void
    {
        $provider = new CifraClubImportProvider();
        $this->expectException(InvalidArgumentException::class);
        $provider->import('http://127.0.0.1/private');
    }

    public function testRejectsNonHttpScheme(): void
    {
        $provider = new CifraClubImportProvider();
        $this->expectException(InvalidArgumentException::class);
        $provider->import('ftp://www.cifraclub.com.br/artista/musica/');
    }

    public function testThrowsWhenFetchFails(): void
    {
        $provider = new CifraClubImportProvider(['httpGet' => function (string $url, int $timeout) {
            return false;
        }]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Não foi possível acessar a página informada.');
        $provider->import('https://www.cifraclub.com.br/artista/musica/');
    }
}
```

- [ ] **Step 2: Rodar os testes e confirmar que falham (classe ainda não existe)**

Run: `vendor/bin/phpunit tests/php/CifraClubImportProviderTest.php`
Expected: FAIL — `Class "CifraClubImportProvider" not found`.

- [ ] **Step 3: Implementar validação de host + fetch injetável (sem parsing ainda)**

```php
<?php
class CifraClubImportProvider implements ChordImportProvider
{
    private const ALLOWED_HOSTS = ['cifraclub.com.br', 'www.cifraclub.com.br'];

    /** @var callable(string $url, int $timeout): (string|false) */
    private $httpGet;

    public function __construct(array $deps = [])
    {
        $this->httpGet = $deps['httpGet'] ?? function (string $url, int $timeout) {
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'user_agent' => 'CifroFdm/1.0 (+https://cifrasfdm.com.br)',
                    'timeout' => $timeout,
                    'ignore_errors' => true,
                    'max_redirects' => 3,
                ],
            ]);
            return @file_get_contents($url, false, $context, 0, 2 * 1024 * 1024);
        };
    }

    public function import(string $url): array
    {
        $this->assertAllowedUrl($url);
        $html = ($this->httpGet)($url, 8);
        if ($html === false || $html === '') {
            throw new RuntimeException('Não foi possível acessar a página informada.');
        }
        return $this->parseHtml($html, $url);
    }

    private function assertAllowedUrl(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string)($parts['scheme'] ?? ''));
        $host = strtolower((string)($parts['host'] ?? ''));
        if (!in_array($scheme, ['http', 'https'], true) || !in_array($host, self::ALLOWED_HOSTS, true)) {
            throw new InvalidArgumentException('URL de origem não permitida.');
        }
    }

    private function parseHtml(string $html, string $url): array
    {
        throw new RuntimeException('Não foi possível extrair a cifra desta página.');
    }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `vendor/bin/phpunit tests/php/CifraClubImportProviderTest.php`
Expected: PASS (3 testes).

- [ ] **Step 5: Remover a implementação desativada e seu teste**

```bash
git rm public/src/Services/DisabledCifraClubImportProvider.php tests/php/DisabledCifraClubImportProviderTest.php
```

- [ ] **Step 6: Commit**

```bash
git add public/src/Services/CifraClubImportProvider.php tests/php/CifraClubImportProviderTest.php
git commit -m "feat: substitui DisabledCifraClubImportProvider por CifraClubImportProvider com fetch injetável"
```

---

### Task 2: Parsing do HTML do CifraClub

**Files:**
- Modify: `public/src/Services/CifraClubImportProvider.php` (método `parseHtml`)
- Test: `tests/php/CifraClubImportProviderTest.php`
- Create: `tests/fixtures/cifraclub-sample.html`
- Create: `tests/fixtures/cifraclub-sem-cifra.html`

**Interfaces:**
- Consumes: `parseHtml(string $html, string $url): array` (esqueleto da Task 1).
- Produces: `import()` retorna `['title' => string, 'artist' => string, 'content' => string, 'metadata' => ['tom' => ?string, 'capo' => ?string, 'afinação' => ?string]]` — mesmo shape usado por `parseImportedSong` no frontend.

O CifraClub renderiza a cifra dentro de uma `<pre>` com classe `.cifra_cifra` (ou `#cifra_clean`), o título em `h1.t1`, o artista em `h2.t3 a`, e "Tom:" costuma aparecer como texto solto próximo ao topo do bloco de cifra. Como a estrutura real pode variar, o parser deve:
1. Buscar `<pre>` com atributo `id` contendo `cifra` (cobre `cifra_clean` e variações), pegando o `textContent` (preserva quebras de linha).
2. Título: primeiro `<h1>` da página (`textContent` limpo).
3. Artista: primeiro link dentro de um `<h2>` próximo ao título, ou texto do `<h2>` se não houver link.
4. Metadados (tom/capo/afinação): procurar dentro do `<pre>` extraído por linhas que casem com `/^(tom|capo|afina[cç][aã]o)\s*:\s*(.+)$/i` nas primeiras linhas (mesma regra do `parseImportedSong` do JS), removendo essas linhas do conteúdo final.
5. Se não encontrar o `<pre>` da cifra: `RuntimeException('Não foi possível extrair a cifra desta página.')`.

- [ ] **Step 1: Criar as fixtures de HTML**

`tests/fixtures/cifraclub-sample.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Exemplo</title></head>
<body>
  <h1 class="t1">Música de Teste</h1>
  <h2 class="t3"><a href="/artista-teste/">Artista Teste</a></h2>
  <div class="cifra_cnt">
    <pre id="cifra_clean">Tom: C
Capo: 2

[Intro] C  G  Am  F

C          G
Linha de exemplo da letra
Am              F
Outra linha de exemplo</pre>
  </div>
</body>
</html>
```

`tests/fixtures/cifraclub-sem-cifra.html`:
```html
<!DOCTYPE html>
<html>
<head><title>Página sem cifra</title></head>
<body>
  <h1 class="t1">Página qualquer</h1>
  <p>Esta página não contém uma cifra.</p>
</body>
</html>
```

- [ ] **Step 2: Escrever os testes de parsing**

Adicionar em `tests/php/CifraClubImportProviderTest.php`:

```php
    public function testParsesTitleArtistContentAndMetadata(): void
    {
        $html = file_get_contents(__DIR__ . '/../fixtures/cifraclub-sample.html');
        $provider = new CifraClubImportProvider(['httpGet' => function () use ($html) {
            return $html;
        }]);

        $result = $provider->import('https://www.cifraclub.com.br/artista-teste/musica-de-teste/');

        $this->assertSame('Música de Teste', $result['title']);
        $this->assertSame('Artista Teste', $result['artist']);
        $this->assertSame('C', $result['metadata']['tom']);
        $this->assertSame('2', $result['metadata']['capo']);
        $this->assertStringContainsString('[Intro] C  G  Am  F', $result['content']);
        $this->assertStringContainsString('Linha de exemplo da letra', $result['content']);
        $this->assertStringNotContainsString('Tom: C', $result['content']);
    }

    public function testThrowsWhenPageHasNoCifraBlock(): void
    {
        $html = file_get_contents(__DIR__ . '/../fixtures/cifraclub-sem-cifra.html');
        $provider = new CifraClubImportProvider(['httpGet' => function () use ($html) {
            return $html;
        }]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Não foi possível extrair a cifra desta página.');
        $provider->import('https://www.cifraclub.com.br/artista/pagina/');
    }
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `vendor/bin/phpunit tests/php/CifraClubImportProviderTest.php`
Expected: FAIL em `testParsesTitleArtistContentAndMetadata` (content vazio / exception não esperada, já que `parseHtml` hoje sempre lança).

- [ ] **Step 4: Implementar `parseHtml`**

Substituir o método `parseHtml` em `public/src/Services/CifraClubImportProvider.php`:

```php
    private function parseHtml(string $html, string $url): array
    {
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8">' . $html);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $xpath = new DOMXPath($document);
        $preNode = $xpath->query('//pre[contains(@id, "cifra")]')->item(0);
        if (!$preNode) {
            throw new RuntimeException('Não foi possível extrair a cifra desta página.');
        }

        $title = '';
        $h1 = $xpath->query('//h1')->item(0);
        if ($h1) {
            $title = trim($h1->textContent);
        }

        $artist = '';
        $h2Link = $xpath->query('//h2//a')->item(0);
        if ($h2Link) {
            $artist = trim($h2Link->textContent);
        } else {
            $h2 = $xpath->query('//h2')->item(0);
            if ($h2) {
                $artist = trim($h2->textContent);
            }
        }

        $rawContent = str_replace("\r\n", "\n", $preNode->textContent);
        $lines = explode("\n", $rawContent);

        $metadata = [];
        $contentStart = 0;
        while ($contentStart < count($lines)) {
            $line = trim($lines[$contentStart]);
            if ($line === '') {
                $contentStart++;
                continue;
            }
            if (preg_match('/^(tom|capo|afina[cç][aã]o)\s*:\s*(.+)$/iu', $line, $match)) {
                $metadata[mb_strtolower($match[1], 'UTF-8')] = trim($match[2]);
                $contentStart++;
                continue;
            }
            break;
        }

        $content = trim(implode("\n", array_slice($lines, $contentStart)));
        if ($content === '') {
            throw new RuntimeException('Não foi possível extrair a cifra desta página.');
        }

        return [
            'title' => mb_substr($title, 0, 200),
            'artist' => mb_substr($artist, 0, 200),
            'content' => $content,
            'metadata' => [
                'tom' => $metadata['tom'] ?? null,
                'capo' => $metadata['capo'] ?? null,
                'afinação' => $metadata['afinação'] ?? $metadata['afinacao'] ?? null,
            ],
        ];
    }
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `vendor/bin/phpunit tests/php/CifraClubImportProviderTest.php`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add public/src/Services/CifraClubImportProvider.php tests/php/CifraClubImportProviderTest.php tests/fixtures/cifraclub-sample.html tests/fixtures/cifraclub-sem-cifra.html
git commit -m "feat: parseia título, artista, conteúdo e metadados do HTML do CifraClub"
```

---

### Task 3: Resolver de provider por host

**Files:**
- Create: `public/src/Services/ChordImportProviderResolver.php`
- Test: `tests/php/ChordImportProviderResolverTest.php`

**Interfaces:**
- Consumes: `CifraClubImportProvider` (Task 1/2), `ChordImportProvider` (interface existente).
- Produces: `class ChordImportProviderResolver { public static function forUrl(string $url): ChordImportProvider; }` — usado pelo endpoint na Task 4.

- [ ] **Step 1: Escrever o teste do resolver**

```php
<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/Services/ChordImportProvider.php';
require_once __DIR__ . '/../../public/src/Services/CifraClubImportProvider.php';
require_once __DIR__ . '/../../public/src/Services/ChordImportProviderResolver.php';

final class ChordImportProviderResolverTest extends TestCase
{
    public function testResolvesCifraClubProviderForCifraClubHost(): void
    {
        $provider = ChordImportProviderResolver::forUrl('https://www.cifraclub.com.br/artista/musica/');
        $this->assertInstanceOf(CifraClubImportProvider::class, $provider);
    }

    public function testRejectsUnknownHost(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ChordImportProviderResolver::forUrl('https://www.outrosite.com.br/artista/musica/');
    }

    public function testRejectsInvalidUrl(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ChordImportProviderResolver::forUrl('não é uma url');
    }
}
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `vendor/bin/phpunit tests/php/ChordImportProviderResolverTest.php`
Expected: FAIL — `Class "ChordImportProviderResolver" not found`.

- [ ] **Step 3: Implementar o resolver**

```php
<?php
class ChordImportProviderResolver
{
    public static function forUrl(string $url): ChordImportProvider
    {
        $parts = parse_url($url);
        $host = strtolower((string)($parts['host'] ?? ''));
        if ($host === 'cifraclub.com.br' || $host === 'www.cifraclub.com.br') {
            return new CifraClubImportProvider();
        }
        throw new InvalidArgumentException('Nenhum provedor de importação disponível para este link.');
    }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `vendor/bin/phpunit tests/php/ChordImportProviderResolverTest.php`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add public/src/Services/ChordImportProviderResolver.php tests/php/ChordImportProviderResolverTest.php
git commit -m "feat: adiciona resolver de provider de importação por host"
```

---

### Task 4: Endpoint `import.php`

**Files:**
- Create: `public/src/backend/editor/import.php`

**Interfaces:**
- Consumes: `ChordImportProviderResolver::forUrl()` (Task 3), helpers de `bootstrap.php` (`require_band_role`, `require_csrf`, `send_no_cache_headers`).
- Produces: contrato HTTP `POST /src/backend/editor/import.php` com body `{"url": string}`, respostas descritas abaixo — consumido pelo frontend na Task 5.

Este endpoint é uma casca fina de auth/CSRF + delegação ao resolver (mesmo padrão de `public/src/backend/editor/api.php`, já sem lógica de negócio própria — toda a lógica testável (validação de host, fetch, parsing) já está coberta pelos testes de `CifraClubImportProvider` e `ChordImportProviderResolver` nas Tasks 1–3). Por isso não tem teste unitário próprio; é validado via `php -l` (Step 3) e na verificação manual end-to-end da Task 6.

- [ ] **Step 1: Olhar o arquivo de referência**

Reabra `public/src/backend/editor/api.php` e confirme o cabeçalho padrão: `require_once bootstrap.php`, `header('Content-Type: application/json')`, `send_no_cache_headers()`, `require_band_role('gestor')`, checagem de método `POST`, `require_csrf()`, leitura de `php://input` com `json_decode`.

- [ ] **Step 2: Implementar o endpoint**

```php
<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
send_no_cache_headers();
require_band_role('gestor');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método não permitido.']);
    exit;
}
require_csrf();

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON inválido: ' . json_last_error_msg()]);
    exit;
}

$url = trim((string)($data['url'] ?? ''));
if ($url === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Informe um link de origem.']);
    exit;
}

try {
    $provider = ChordImportProviderResolver::forUrl($url);
    $result = $provider->import($url);
    echo json_encode([
        'ok' => true,
        'title' => $result['title'],
        'artist' => $result['artist'],
        'content' => $result['content'],
        'metadata' => $result['metadata'],
        'source' => $url,
    ]);
} catch (InvalidArgumentException|RuntimeException $e) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
```

- [ ] **Step 3: Verificar carregamento das classes**

O autoloader de `bootstrap.php` já resolve `Services/{Class}.php` automaticamente — `CifraClubImportProvider`, `ChordImportProvider`, `ChordImportProviderResolver` serão carregados sob demanda. Confirme rodando:

Run: `php -l public/src/backend/editor/import.php`
Expected: `No syntax errors detected`.

- [ ] **Step 4: Commit**

```bash
git add public/src/backend/editor/import.php
git commit -m "feat: adiciona endpoint POST import.php para busca automática de cifra por link"
```

---

### Task 5: Frontend — abas "Colar link" e "Colar cifra completa"

**Files:**
- Modify: `public/src/Views/editor/editor.php:116-132` (markup do modal)
- Modify: `public/src/js/editor.js` (novos handlers + adaptação de `openImport`/`closeImport`)
- Modify: `public/src/css/editor.css:212-221` (estilos das abas)

**Interfaces:**
- Consumes: `POST /src/backend/editor/import.php` (Task 4), contrato de resposta `{ok, title, artist, content, metadata, source}` ou `{ok:false, error}`.
- Consumes internamente: `previewImport()`, `confirmImport()`, `elements.importModal.dataset.preview` (formato já existente: `{...parsed, source}` onde `parsed = {title, artist, content, metadata}`).
- Produces: nenhuma interface nova para outras tasks — esta é a task final da feature.

- [ ] **Step 1: Atualizar o markup do modal em `editor.php`**

Substituir o bloco `116-132` por:

```html
  <div class="import-modal" id="importModal" role="dialog" aria-modal="true" aria-labelledby="importModalTitle" hidden>
    <div class="import-modal__box">
      <h2 id="importModalTitle">Importar cifra</h2>
      <div class="import-modal__tabs" role="tablist">
        <button type="button" class="import-modal__tab is-active" id="importTabLinkButton" role="tab" aria-selected="true" aria-controls="importTabLink">Colar link</button>
        <button type="button" class="import-modal__tab" id="importTabTextButton" role="tab" aria-selected="false" aria-controls="importTabText">Colar cifra completa</button>
      </div>

      <div class="import-modal__panel" id="importTabLink" role="tabpanel">
        <p>Cole o link de uma cifra do CifraClub e a aplicação busca o conteúdo automaticamente.</p>
        <label for="importUrlInput">Link do CifraClub</label>
        <input id="importUrlInput" type="url" placeholder="https://www.cifraclub.com.br/...">
        <button type="button" class="btn btn--secondary" id="fetchImportButton">Buscar cifra</button>
        <div class="import-fetch-error" id="importFetchError" role="alert" hidden></div>
      </div>

      <div class="import-modal__panel" id="importTabText" hidden role="tabpanel">
        <p>Cole o conteúdo da cifra. Um link pode ser guardado como referência, mas não é acessado automaticamente.</p>
        <label for="importSourceUrl">Link de origem (opcional)</label>
        <input id="importSourceUrl" type="url" placeholder="https://www.cifraclub.com.br/...">
        <label for="importContent">Conteúdo da cifra</label>
        <textarea id="importContent" rows="14" placeholder="Nome da música&#10;Artista&#10;Tom: C&#10;&#10;C  G  Am  F"></textarea>
        <button type="button" class="btn btn--secondary" id="previewImportButton">Gerar preview</button>
      </div>

      <label class="import-rights"><input id="importRights" type="checkbox"> Confirmo que tenho autorização para usar este conteúdo.</label>
      <div class="import-preview" id="importPreview" role="status" aria-live="polite" hidden></div>
      <div class="import-modal__actions">
        <button type="button" class="btn btn--secondary" id="cancelImportButton">Cancelar</button>
        <button type="button" class="btn btn--primary" id="confirmImportButton" disabled>Usar no editor</button>
      </div>
    </div>
  </div>
```

Nota: removi o `</input>` inválido do markup original (era um bug pré-existente — `<input>` é void element).

- [ ] **Step 2: Adicionar os estilos das abas em `editor.css`**

Inserir após a linha `221` (`.import-modal__actions { ... }`):

```css
.import-modal__tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-1); }
.import-modal__tab { padding: 8px 14px; border: none; background: none; color: var(--text-2); cursor: pointer; border-bottom: 2px solid transparent; font: inherit; }
.import-modal__tab.is-active { color: var(--text-1); border-bottom-color: var(--accent-1, var(--text-1)); font-weight: var(--fw-medium); }
.import-modal__panel[hidden] { display: none; }
.import-fetch-error { padding: 10px 12px; border: 1px solid var(--border-1); border-radius: var(--radius-sm); background: var(--bg-2); color: var(--danger-1, #c0392b); }
```

- [ ] **Step 3: Atualizar `elements` em `editor.js`**

Em `editor.js:14-41`, substituir o bloco `elements` para incluir os novos ids e remover a referência ao antigo `previewImportButton` duplicado (mantém o mesmo id, já que ele continua existindo só na aba de texto):

```javascript
  const elements = {
    shell: document.getElementById('editorShell'),
    list: document.getElementById('musicas'),
    listState: document.getElementById('libraryState'),
    count: document.getElementById('songCount'),
    search: document.getElementById('buscaMusica'),
    title: document.getElementById('titulo'),
    artist: document.getElementById('artista'),
    bpm: document.getElementById('bit'),
    key: document.getElementById('tomPadrao'),
    classification: document.getElementById('classificacao'),
    dirtyIndicator: document.getElementById('dirtyIndicator'),
    saveButton: document.getElementById('saveButton'),
    saveButtonLabel: document.getElementById('saveButtonLabel'),
    deleteButton: document.getElementById('deleteSongButton'),
    status: document.getElementById('status'),
    previewModal: document.getElementById('previewModal'),
    previewFrame: document.getElementById('previewFrame'),
    previewModalTitle: document.getElementById('previewModalTitle'),
    importModal: document.getElementById('importModal'),
    importTabLinkButton: document.getElementById('importTabLinkButton'),
    importTabTextButton: document.getElementById('importTabTextButton'),
    importTabLink: document.getElementById('importTabLink'),
    importTabText: document.getElementById('importTabText'),
    importUrlInput: document.getElementById('importUrlInput'),
    fetchImportButton: document.getElementById('fetchImportButton'),
    importFetchError: document.getElementById('importFetchError'),
    importSourceUrl: document.getElementById('importSourceUrl'),
    importContent: document.getElementById('importContent'),
    importRights: document.getElementById('importRights'),
    importPreview: document.getElementById('importPreview'),
    confirmImportButton: document.getElementById('confirmImportButton'),
    textarea: document.getElementById('cifraInput'),
    editorError: document.getElementById('editorLoadError')
  };
```

- [ ] **Step 4: Adicionar troca de abas e busca por link em `editor.js`**

Logo antes da função `openImport()` (linha `522` no arquivo original), adicionar:

```javascript
  function switchImportTab(tab) {
    const isLink = tab === 'link';
    elements.importTabLinkButton.classList.toggle('is-active', isLink);
    elements.importTabLinkButton.setAttribute('aria-selected', String(isLink));
    elements.importTabTextButton.classList.toggle('is-active', !isLink);
    elements.importTabTextButton.setAttribute('aria-selected', String(!isLink));
    elements.importTabLink.hidden = !isLink;
    elements.importTabText.hidden = isLink;
    elements.importFetchError.hidden = true;
    elements.importPreview.hidden = true;
    elements.importModal.dataset.preview = '';
    elements.confirmImportButton.disabled = true;
  }

  function applyImportPreview(parsed, source) {
    elements.importModal.dataset.preview = JSON.stringify({ ...parsed, source });
    const detected = detectedKey(parsed.content);
    elements.importPreview.textContent = `${parsed.title}${parsed.artist ? ` — ${parsed.artist}` : ''} · ${parsed.content.split('\n').length} linhas${detected?.key ? ` · tom ${detected.key}` : ''}`;
    elements.importPreview.hidden = false;
    elements.confirmImportButton.disabled = !elements.importRights.checked;
  }

  async function fetchImportFromUrl() {
    elements.importFetchError.hidden = true;
    elements.importPreview.hidden = true;
    elements.confirmImportButton.disabled = true;

    const url = elements.importUrlInput.value.trim();
    if (!url) {
      elements.importFetchError.textContent = 'Informe um link do CifraClub.';
      elements.importFetchError.hidden = false;
      return;
    }
    if (!elements.importRights.checked) {
      elements.importFetchError.textContent = 'Confirme que você tem autorização para usar o conteúdo.';
      elements.importFetchError.hidden = false;
      return;
    }

    elements.fetchImportButton.disabled = true;
    elements.fetchImportButton.textContent = 'Buscando...';
    try {
      const response = await fetch('import.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await parseJsonResponse(response);
      applyImportPreview({ title: data.title, artist: data.artist, content: data.content, metadata: data.metadata }, data.source);
    } catch (error) {
      elements.importFetchError.innerHTML = '';
      const message = document.createElement('span');
      message.textContent = (error.message || 'Não foi possível buscar a cifra.') + ' ';
      const switchLink = document.createElement('button');
      switchLink.type = 'button';
      switchLink.className = 'link-button';
      switchLink.textContent = 'Colar cifra completa manualmente';
      switchLink.addEventListener('click', () => switchImportTab('text'));
      elements.importFetchError.appendChild(message);
      elements.importFetchError.appendChild(switchLink);
      elements.importFetchError.hidden = false;
    } finally {
      elements.fetchImportButton.disabled = false;
      elements.fetchImportButton.textContent = 'Buscar cifra';
    }
  }
```

- [ ] **Step 5: Ajustar `previewImport()` para usar `applyImportPreview` e `openImport`/`closeImport` para resetar as abas**

Substituir a função `previewImport()` existente (linha `534-549` no arquivo original) por:

```javascript
  function previewImport() {
    try {
      const parsed = parseImportedSong(elements.importContent.value);
      const source = validateImportUrl(elements.importSourceUrl.value);
      if (!elements.importRights.checked) throw new Error('Confirme que você tem autorização para usar o conteúdo.');
      applyImportPreview(parsed, source);
    } catch (error) {
      elements.importPreview.textContent = error.message;
      elements.importPreview.hidden = false;
      elements.confirmImportButton.disabled = true;
    }
  }
```

Substituir `openImport()` (linha `522-527`) por:

```javascript
  function openImport() {
    elements.importModal.hidden = false;
    switchImportTab('link');
    elements.importUrlInput.value = '';
    elements.importUrlInput.focus();
  }
```

- [ ] **Step 6: Registrar os novos listeners**

Perto de `document.getElementById('previewImportButton')?.addEventListener('click', previewImport);` (linha `749` no arquivo original), adicionar:

```javascript
    elements.importTabLinkButton?.addEventListener('click', () => switchImportTab('link'));
    elements.importTabTextButton?.addEventListener('click', () => switchImportTab('text'));
    elements.fetchImportButton?.addEventListener('click', fetchImportFromUrl);
```

- [ ] **Step 7: Adicionar estilo mínimo para o botão de troca de aba inline (`link-button`)**

Em `editor.css`, junto aos estilos adicionados no Step 2:

```css
.link-button { background: none; border: none; padding: 0; color: var(--accent-1, #2563eb); text-decoration: underline; cursor: pointer; font: inherit; }
```

- [ ] **Step 8: Commit**

```bash
git add public/src/Views/editor/editor.php public/src/js/editor.js public/src/css/editor.css
git commit -m "feat: adiciona aba de importação de cifra por link no modal do editor"
```

---

### Task 6: Verificação end-to-end

**Files:** nenhum (task de verificação manual/automatizada).

- [ ] **Step 1: Rodar toda a suíte PHP**

Run: `vendor/bin/phpunit`
Expected: todos os testes passam, incluindo os novos de `CifraClubImportProvider`, `ChordImportProviderResolver`.

- [ ] **Step 2: Rodar `php -l` em todos os arquivos tocados**

```bash
php -l public/src/Services/CifraClubImportProvider.php
php -l public/src/Services/ChordImportProviderResolver.php
php -l public/src/backend/editor/import.php
```
Expected: `No syntax errors detected` em cada um.

- [ ] **Step 3: Verificação visual no navegador**

Usando o preview do projeto (dev server local do PHP, ex.: `php -S localhost:8000 -t public`):
1. Login, abrir o editor de músicas, clicar em "Importar cifra".
2. Confirmar que a aba "Colar link" abre por padrão.
3. Colar uma URL real de uma música do CifraClub (ex.: `https://www.cifraclub.com.br/<artista>/<musica>/`), marcar o checkbox de autorização, clicar "Buscar cifra".
4. Confirmar que o preview aparece com título/artista/linhas e que "Usar no editor" fica habilitado.
5. Clicar "Usar no editor" e confirmar que título, artista e conteúdo aparecem preenchidos no editor.
6. Testar um link de host não suportado (ex.: `https://www.google.com`) e confirmar que aparece a mensagem de erro com o botão "Colar cifra completa manualmente", e que clicar nele troca para a aba de texto.
7. Trocar para a aba "Colar cifra completa", confirmar que o fluxo de colar manualmente continua idêntico ao anterior (gerar preview, usar no editor).

- [ ] **Step 4: Commit final (se houver ajustes da verificação)**

```bash
git add -A
git commit -m "fix: ajustes pós-verificação da importação por link"
```
(Pular este commit se nada precisou de ajuste.)
