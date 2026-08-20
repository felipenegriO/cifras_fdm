# Capotraste — Etapa 2: import do CifraClub

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando a cifra importada informar capotraste, o Cifrô entende, propõe salvar no tom real e nunca transpõe sem o usuário confirmar.

**Architecture:** O `CifraClubImportProvider` passa a achar o capotraste também fora do `<pre>` e devolve um inteiro normalizado. O preview do editor mostra o que vai acontecer e confere o resultado com o `Tom:` declarado na página; só transpõe com clique.

**Tech Stack:** PHP 8 sem framework, JS sem build, PHPUnit 9.6, `node --test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-16-capotraste-transposicao-instrumento-design.md`
**Etapa anterior:** `docs/superpowers/plans/2026-08-16-capotraste-etapa-1-fundacao.md`

## Global Constraints

- O CifraClub escreve o `Tom:` como o **tom que soa**; os acordes do corpo são as **formas**. Logo `tom soante = tom do corpo + capo`.
- Nada é transposto sem clique do usuário.
- Casa de capotraste válida no import: 1 a 12. Ausente, zero ou não reconhecido vale `null`.
- Nomes de teste em português, em linguagem de negócio.
- Não rodar `git commit` — o autor commita.

---

### Task 1: Ler a casa do capotraste escrita em texto livre

**Files:**
- Modify: `public/src/Services/TransposicaoInstrumento.php`
- Test: `tests/php/TransposicaoInstrumentoTest.php`

**Interfaces:**
- Produces: `TransposicaoInstrumento::casaDeCapo($texto): ?int`

O CifraClub escreve a casa de várias formas — `2`, `2ª casa`, `Capotraste na 2ª casa` — e o parser atual só entende o número puro.

- [ ] **Step 1: Escrever o teste que falha**

```php
    public function testEntendeACasaDoCapotrasteEscritaDeVariasFormas(): void
    {
        $this->assertSame(2, TransposicaoInstrumento::casaDeCapo('2'));
        $this->assertSame(2, TransposicaoInstrumento::casaDeCapo('2ª casa'));
        $this->assertSame(2, TransposicaoInstrumento::casaDeCapo('2a casa'));
        $this->assertSame(2, TransposicaoInstrumento::casaDeCapo('Capotraste na 2ª casa'));
        $this->assertSame(2, TransposicaoInstrumento::casaDeCapo('capo 2'));
        $this->assertSame(10, TransposicaoInstrumento::casaDeCapo('Capotraste na 10ª casa'));
    }

    public function testNaoEnxergaCapotrasteQuandoNaoHa(): void
    {
        $this->assertNull(TransposicaoInstrumento::casaDeCapo(''));
        $this->assertNull(TransposicaoInstrumento::casaDeCapo('sem capotraste'));
        $this->assertNull(TransposicaoInstrumento::casaDeCapo('Tom: C'));
        $this->assertNull(TransposicaoInstrumento::casaDeCapo('0'));
    }

    public function testRecusaCasaAlemDoBracoDoInstrumento(): void
    {
        $this->assertNull(TransposicaoInstrumento::casaDeCapo('13ª casa'));
        $this->assertNull(TransposicaoInstrumento::casaDeCapo('-2'));
    }
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npm run test:unit:php -- --filter TransposicaoInstrumentoTest
```

Esperado: FAIL — `Call to undefined method TransposicaoInstrumento::casaDeCapo()`.

- [ ] **Step 3: Implementar**

```php
    public const CAPO_MAX_IMPORT = 12;

    /**
     * Lê a casa do capotraste escrita em texto livre pela página de origem.
     * Devolve null quando não há capotraste, o valor é zero ou passa do braço.
     */
    public static function casaDeCapo($texto): ?int
    {
        if (!is_string($texto) && !is_int($texto)) {
            return null;
        }
        // O primeiro número da frase é a casa: "Capotraste na 2ª casa" → 2.
        if (preg_match('/(\d{1,2})/', (string) $texto, $match) !== 1) {
            return null;
        }
        $casa = (int) $match[1];
        return ($casa >= 1 && $casa <= self::CAPO_MAX_IMPORT) ? $casa : null;
    }
```

`-2` cai fora porque o regex ignora o sinal e captura `2`... **não**: `'-2'` casaria com `2` e devolveria 2, o que o teste proíbe. Recuse sinal antes do número:

```php
        if (preg_match('/(?<![\d-])(\d{1,2})/', (string) $texto, $match) !== 1) {
```

- [ ] **Step 4: Rodar para ver passar**

```bash
npm run test:unit:php -- --filter TransposicaoInstrumentoTest
```

- [ ] **Step 5: Ponto de parada**

---

### Task 2: Achar o capotraste fora do `<pre>`

**Files:**
- Modify: `public/src/Services/CifraClubImportProvider.php:92-122`
- Create: `tests/fixtures/cifraclub-capo-fora-do-pre.html`
- Modify: `tests/php/CifraClubImportProviderTest.php`

**Interfaces:**
- Consumes: `TransposicaoInstrumento::casaDeCapo()` da Task 1.
- Produces: `metadata['capo']` passa a ser `int|null` em vez da string crua. **Isso quebra o teste existente `testParsesTitleArtistContentAndMetadata`, que espera `'2'`** — atualize-o para `2`.

O layout atual do CifraClub mostra "Capotraste na 2ª casa" num elemento próprio, fora da cifra. O parser de hoje só olha as linhas de cabeçalho dentro do `<pre>`, então perde essa informação em toda página real.

- [ ] **Step 1: Criar a fixture do layout com capo fora do `<pre>`**

`tests/fixtures/cifraclub-capo-fora-do-pre.html`:

```html
<!DOCTYPE html>
<html>
<head><title>Exemplo</title></head>
<body>
  <h1 class="t1">Música com Capotraste</h1>
  <h2 class="t3"><a href="/artista-teste/">Artista Teste</a></h2>
  <div id="cifra_tom"><span>Tom: <a href="#">A</a></span></div>
  <div id="cifra_capo"><span>Capotraste na <b>2ª casa</b></span></div>
  <div class="cifra_cnt">
    <pre id="cifra_clean">[Intro] G  D  Em  C

G          D
Linha de exemplo da letra
Em              C
Outra linha de exemplo</pre>
  </div>
</body>
</html>
```

Repare: o corpo está em Sol (as formas) e a página declara tom Lá — Sol + 2 semitons = Lá, que é a checagem de consistência da Task 3.

- [ ] **Step 2: Escrever os testes que falham**

```php
    public function testLeCapotrasteDeclaradoForaDaCifra(): void
    {
        $html = file_get_contents(__DIR__ . '/../fixtures/cifraclub-capo-fora-do-pre.html');
        $provider = new CifraClubImportProvider(['httpGet' => fn() => $html]);

        $result = $provider->import('https://www.cifraclub.com.br/artista-teste/musica/');

        $this->assertSame(2, $result['metadata']['capo']);
        $this->assertSame('A', $result['metadata']['tom']);
        $this->assertStringContainsString('[Intro] G  D  Em  C', $result['content']);
    }

    public function testDevolveCapotrasteNuloQuandoAPaginaNaoInforma(): void
    {
        $html = <<<HTML
<!DOCTYPE html><html><body>
<h1>Sem capo</h1><h2>Artista</h2>
<div class="cifra_cnt"><pre id="cifra_clean">C  G  Am  F
letra</pre></div>
</body></html>
HTML;
        $provider = new CifraClubImportProvider(['httpGet' => fn() => $html]);
        $result = $provider->import('https://www.cifraclub.com.br/a/b/');

        $this->assertNull($result['metadata']['capo']);
    }
```

E atualize o teste existente:

```php
        $this->assertSame(2, $result['metadata']['capo']);
```

- [ ] **Step 3: Rodar para ver falhar**

```bash
npm run test:unit:php -- --filter CifraClubImportProviderTest
```

- [ ] **Step 4: Implementar**

Em `parseHtml()`, depois do bloco que lê os metadados de dentro do `<pre>`, e antes do `return`:

```php
        // O layout atual do CifraClub declara o capotraste num elemento próprio,
        // fora da cifra. As classes CSS são ofuscadas e instáveis, então
        // procuramos pelo texto, que é estável.
        $capo = TransposicaoInstrumento::casaDeCapo($metadata['capo'] ?? '');
        if ($capo === null) {
            $capo = self::capoDeclaradoNaPagina($xpath);
        }

        // Idem para o tom: fora do <pre> ele vem num elemento separado.
        $tom = $metadata['tom'] ?? null;
        if ($tom === null) {
            $tom = self::tomDeclaradoNaPagina($xpath);
        }
```

E o `return` passa a usar `'tom' => $tom` e `'capo' => $capo`.

Os dois auxiliares privados:

```php
    private static function capoDeclaradoNaPagina(DOMXPath $xpath): ?int
    {
        $nodes = $xpath->query(
            '//*[contains(translate(text(), "CAPOTRASE", "capotrase"), "capotraste")]'
            . ' | //*[@id="cifra_capo"]'
        );
        foreach ($nodes ?: [] as $node) {
            $casa = TransposicaoInstrumento::casaDeCapo(trim($node->textContent));
            if ($casa !== null) {
                return $casa;
            }
        }
        return null;
    }

    private static function tomDeclaradoNaPagina(DOMXPath $xpath): ?string
    {
        $nodes = $xpath->query('//*[@id="cifra_tom"]');
        foreach ($nodes ?: [] as $node) {
            if (preg_match('/tom:\s*([A-G][#b]?m?)/iu', trim($node->textContent), $match) === 1) {
                return $match[1];
            }
        }
        return null;
    }
```

O `translate()` no XPath é como se faz busca sem diferenciar maiúscula de minúscula em XPath 1.0, que é o que o `DOMXPath` do PHP suporta.

- [ ] **Step 5: Rodar para ver passar**

```bash
npm run test:unit:php -- --filter CifraClubImportProviderTest
```

- [ ] **Step 6: Ponto de parada**

---

### Task 3: Confirmação no preview do editor

**Files:**
- Modify: `public/src/Views/editor/editor.php` (modal de import, antes de `.import-modal__actions`)
- Modify: `public/src/js/editor.js` — `parseImportedSong`, `applyImportPreview`, `confirmImport`

**Interfaces:**
- Consumes: `metadata.capo` (int|null) e `metadata.tom` (string|null) da Task 2; `CifroChords.transposeHtml` e `.normalizeKey` da Etapa 1.
- Produces: nada para outras tasks.

O aviso vale tanto para a aba de link quanto para a de colar texto: `parseImportedSong` já lê `Capo:` do texto colado, e as duas abas passam pela mesma `applyImportPreview`.

- [ ] **Step 1: Marcação**

Antes de `<div class="import-modal__actions">`:

```html
      <div class="import-capo" id="importCapoBox" hidden>
        <label>
          <input type="checkbox" id="importAplicarCapo" checked>
          <span id="importCapoTexto"></span>
        </label>
        <p class="import-capo__aviso" id="importCapoAviso" role="alert" hidden></p>
      </div>
```

- [ ] **Step 2: Registrar os elementos**

No mapa `elements`:

```js
    importCapoBox: document.getElementById('importCapoBox'),
    importAplicarCapo: document.getElementById('importAplicarCapo'),
    importCapoTexto: document.getElementById('importCapoTexto'),
    importCapoAviso: document.getElementById('importCapoAviso'),
```

- [ ] **Step 3: Normalizar o capo também na aba de texto colado**

Em `parseImportedSong`, o `metadata` sai com strings. Converta a casa logo antes do `return`:

```js
    const capo = metadata.capo ? parseInt(String(metadata.capo).match(/(?<![\d-])(\d{1,2})/)?.[1] ?? '', 10) : NaN;
    metadata.capo = Number.isInteger(capo) && capo >= 1 && capo <= 12 ? capo : null;
```

- [ ] **Step 4: Montar a confirmação no preview**

Em `applyImportPreview`, depois de preencher `elements.importPreview`:

```js
    const capo = Number(parsed.metadata?.capo) || 0;
    const tomDoCorpo = detected?.key || '';
    elements.importCapoBox.hidden = !capo || !tomDoCorpo;
    elements.importCapoAviso.hidden = true;

    if (capo && tomDoCorpo) {
      // O CifraClub escreve o Tom: como o som que sai, e o corpo como as formas.
      const tomReal = window.CifroChords.tomDasFormas(tomDoCorpo, -capo);
      elements.importCapoTexto.textContent =
        `A página informa capotraste na ${capo}ª casa. Os acordes estão em ${tomDoCorpo}, então o tom real é ${tomReal}. Salvar no tom real com capotraste ${capo}.`;

      const tomDaPagina = window.CifroChords.normalizeKey(parsed.metadata?.tom || '');
      const confere = !tomDaPagina || tomDaPagina === window.CifroChords.normalizeKey(tomReal);
      elements.importAplicarCapo.checked = confere;
      if (!confere) {
        elements.importCapoAviso.textContent =
          `A página informa tom ${parsed.metadata.tom}, mas o corpo somado ao capotraste dá ${tomReal}. Confira antes de aplicar.`;
        elements.importCapoAviso.hidden = false;
      }
    }
```

`tomDasFormas(tom, -capo)` sobe o tom em `capo` semitons, porque a função desce quando o valor é positivo — aqui queremos o caminho inverso, das formas para o som.

- [ ] **Step 5: Aplicar na confirmação**

Em `confirmImport`, trocar a linha do conteúdo:

```js
    const capo = Number(parsed.metadata?.capo) || 0;
    const aplicarCapo = capo > 0 && elements.importAplicarCapo.checked;
    const conteudo = aplicarCapo
      ? window.CifroChords.transposeHtml(parsed.content, capo)
      : parsed.content;

    setContent(plainTextToHtml(conteudo));
    elements.transposicao.value = aplicarCapo ? capo : 0;
    atualizarLegendaTransposicao();
```

E o status final passa a informar o que foi feito:

```js
    setStatus(
      aplicarCapo
        ? `Cifra importada no tom real, com capotraste ${capo}. Confira antes de salvar.`
        : 'Cifra importada para revisão. Confira o conteúdo antes de salvar.',
      'success'
    );
```

- [ ] **Step 6: Conferir manualmente**

Abrir o editor, **Importar cifra → Colar cifra completa**, e colar:

```
Música de Teste - Artista
Tom: A
Capo: 2

G  D  Em  C
letra de exemplo
```

Esperado no preview: a frase de confirmação dizendo que o tom real é A, com a caixa marcada e sem aviso. Ao confirmar, o editor mostra a cifra em Lá e o campo de capotraste em 2.

- [ ] **Step 7: Ponto de parada**

---

### Task 4: Teste de ponta a ponta pela aba de texto colado

**Files:**
- Create: `tests/cifro/75-import-capotraste.spec.js`

A aba de colar texto exercita exatamente a mesma `applyImportPreview` e `confirmImport` da aba de link, sem depender da rede nem do CifraClub estar no ar.

- [ ] **Step 1: Escrever o spec**

```js
/**
 * 75-import-capotraste.spec.js
 * Importação que informa capotraste: o Cifrô propõe salvar no tom real, avisa
 * quando a conta não fecha e nunca transpõe sem confirmação.
 */
import { test, expect } from '../fixtures/coverage.js';

const CIFRA_COERENTE = `Música Com Capo - Artista Teste
Tom: A
Capo: 2

G  D  Em  C
letra de exemplo`;

const CIFRA_INCOERENTE = `Música Torta - Artista Teste
Tom: F
Capo: 2

G  D  Em  C
letra de exemplo`;

async function abrirPreviewDeTexto(page, texto) {
  await page.goto('/editor.php', { waitUntil: 'domcontentloaded' });
  await page.click('#importSongButton');
  await page.click('#importTabTextButton');
  await page.fill('#importContent', texto);
  await page.click('#previewImportButton');
  await expect(page.locator('#importPreview')).toBeVisible();
}

test.describe('Importação com capotraste', () => {
  test('propõe salvar no tom real quando a página informa capotraste', async ({ page }) => {
    await abrirPreviewDeTexto(page, CIFRA_COERENTE);

    await expect(page.locator('#importCapoBox')).toBeVisible();
    await expect(page.locator('#importCapoTexto')).toContainText('2ª casa');
    await expect(page.locator('#importCapoTexto')).toContainText('tom real é A');
    await expect(page.locator('#importAplicarCapo')).toBeChecked();
    await expect(page.locator('#importCapoAviso')).toBeHidden();

    await page.click('#confirmImportButton');
    await expect(page.locator('#transposicaoInstrumento')).toHaveValue('2');
  });

  test('recusar a sugestão importa a cifra como veio', async ({ page }) => {
    await abrirPreviewDeTexto(page, CIFRA_COERENTE);
    await page.uncheck('#importAplicarCapo');
    await page.click('#confirmImportButton');

    await expect(page.locator('#transposicaoInstrumento')).toHaveValue('0');
  });

  test('avisa e não marca a sugestão quando o tom da página não bate', async ({ page }) => {
    await abrirPreviewDeTexto(page, CIFRA_INCOERENTE);

    await expect(page.locator('#importCapoAviso')).toBeVisible();
    await expect(page.locator('#importCapoAviso')).toContainText('Confira antes de aplicar');
    await expect(page.locator('#importAplicarCapo')).not.toBeChecked();
  });
});
```

- [ ] **Step 2: Rodar**

```bash
npx playwright test --project=cifro tests/cifro/75-import-capotraste.spec.js --reporter=list
```

Não deixe outro servidor ocupando a porta 8090 — o Playwright sobe o dele com o banco de teste, e reusar um servidor de desenvolvimento faz os testes baterem no banco errado.

- [ ] **Step 3: Documentação**

- `docs/api.md`: registrar que `editor/import.php` devolve `metadata.capo` como inteiro ou nulo.
- `docs/testes.md`: acrescentar `tests/cifro/75-import-capotraste.spec.js` e a fixture nova à tabela do capotraste.
- `docs/funcionalidades.md`: uma linha em F-032 sobre a importação.

- [ ] **Step 4: Suíte completa**

```bash
npm run test:unit
```

- [ ] **Step 5: Ponto de parada**

Etapa 2 completa. A Etapa 3 (personalização por músico e resolução de conflito) recebe o seu próprio plano.

## O que a execução ensinou

- **O editor não fica em `/editor.php`.** A URL é `/src/backend/editor/editor.php`, como em `tests/cifro/04-editor-musicas.spec.js:10`. Errar isso custa um timeout de 90s por teste.
- **Conferir o campo de capotraste não prova nada sozinho.** O teste precisa ler o conteúdo do TinyMCE (`window.tinymce.get('cifraInput').getContent()`) e checar que as formas de Sol viraram Lá — senão passaria mesmo que a transposição não acontecesse.
- **`metadata['capo']` mudou de string para inteiro.** O teste `testParsesTitleArtistContentAndMetadata`, que existia antes, esperava `'2'` e precisou virar `2`.
- **A caixa de confirmação precisa ser escondida ao trocar de aba** no modal de import, senão o aviso de uma cifra sobra na tela para a seguinte.
