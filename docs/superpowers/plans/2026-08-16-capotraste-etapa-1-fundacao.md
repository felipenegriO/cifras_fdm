# Capotraste — Etapa 1: fundação e exibição

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada músico lê a mesma cifra nas formas mais fáceis do seu instrumento — capotraste no violão, transpose no teclado — sem alterar o tom que a banda toca.

**Architecture:** A cifra continua guardada no tom soante. O deslocamento é dado de apresentação: uma coluna nova em `musicas`, uma preferência por usuário em `usuarios.config`, e transposição aplicada só na hora de exibir, por `CifroChords.transposeHtml` que já existe. O modo live troca apenas o tom soante; o deslocamento nunca trafega.

**Tech Stack:** PHP 8 sem framework, MySQL, JS sem build (IIFE + globais), PHPUnit 9.6, `node --test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-16-capotraste-transposicao-instrumento-design.md`

## Global Constraints

- Valor de deslocamento: inteiro de `-12` a `12`. Positivo = instrumento sobe em relação às formas mostradas.
- Faixa manual: `violao` de 0 a 12; `teclado` e `outro` de −12 a 12. Violão nunca aceita negativo.
- Janela do cálculo automático: `violao` de 0 a 7; `teclado` e `outro` de −6 a 6.
- Instrumentos: `violao`, `teclado`, `outro`. Rótulos: **Capotraste**, **Transpose**, **Transposição**.
- Preferências: `simplificar`, `basico`, `cadastrado`, `nunca`. Ausente = não perguntado ainda.
- Empate no cálculo automático sempre favorece o valor de menor módulo, e 0 vence qualquer empate.
- Nomes de teste em português, em linguagem de negócio (é a praxe do projeto).
- Não rodar `git commit` — o autor do projeto commita. Os passos de commit deste plano ficam como marcação de ponto de parada; pare e avise em vez de commitar.

---

### Task 1: Regras de cálculo em `chords.js`

**Files:**
- Modify: `public/src/js/chords.js` (adicionar ao objeto exportado em `root.CifroChords`, linha 242)
- Test: `tests/chords.test.js` (acrescentar ao final)

**Interfaces:**
- Consumes: `extractChords`, `transposeHtml`, `normalizeKey`, `tonicOf`, `NOTES` — já existentes no mesmo arquivo.
- Produces:
  - `CifroChords.INSTRUMENTOS = ['violao', 'teclado', 'outro']`
  - `CifroChords.faixaManual(instrumento) → { min: number, max: number }`
  - `CifroChords.janelaAutomatica(instrumento) → { min: number, max: number }`
  - `CifroChords.rotuloDeslocamento(instrumento) → 'Capotraste' | 'Transpose' | 'Transposição'`
  - `CifroChords.aplicarDeslocamento(html, deslocamento) → string` — formas mostradas
  - `CifroChords.tomDasFormas(tomSoante, deslocamento) → string`
  - `CifroChords.sugerirDeslocamento(html, { instrumento, nivel }) → number`
  - `CifroChords.custoDeslocamento(html, deslocamento, { instrumento, nivel }) → number` — quantos acordes ainda atrapalham com aquele deslocamento. A Task 9 usa isso para o desempate a favor do cadastro.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao final de `tests/chords.test.js`:

```js
test('sugere capotraste que tira os sustenidos da cifra no violão', () => {
  // Si bemol maior: Bb, Eb, F, Gm — quatro acordes com acidente. Capo 3 leva
  // para formas de Sol (G, C, D, Em) e não sobra nenhum.
  const cifra = '<b>Bb Eb F Gm</b><br>letra<br><b>Bb F Bb</b>';
  const opcoes = { instrumento: 'violao', nivel: 'simplificar' };
  assert.equal(chords.sugerirDeslocamento(cifra, opcoes), 3);
  assert.equal(chords.custoDeslocamento(cifra, 3, opcoes), 0);
});

test('sugere capotraste que elimina a pestana no nível básico', () => {
  // Ré maior traz F#m e Bm (pestana). Capo 2 leva para C, Dm, Am, F.
  const cifra = '<b>D A Bm G</b><br>letra<br><b>F#m Bm A D</b>';
  assert.equal(chords.sugerirDeslocamento(cifra, { instrumento: 'violao', nivel: 'basico' }), 2);
});

test('no nível básico o capotraste some com o único acorde de pestana', () => {
  // C G Am F: só o F pede pestana. Capo 5 leva para formas de Sol, todas
  // abertas — o movimento que todo violonista iniciante conhece.
  const cifra = '<b>C G Am F</b><br>letra<br><b>G C</b>';
  const opcoes = { instrumento: 'violao', nivel: 'basico' };
  assert.equal(chords.custoDeslocamento(cifra, 0, opcoes), 1);
  assert.equal(chords.sugerirDeslocamento(cifra, opcoes), 5);
});

test('não propõe deslocamento quando a cifra já está fácil', () => {
  const cifra = '<b>C G Am Em</b><br>letra<br><b>Dm G C</b>';
  assert.equal(chords.sugerirDeslocamento(cifra, { instrumento: 'violao', nivel: 'simplificar' }), 0);
  assert.equal(chords.sugerirDeslocamento(cifra, { instrumento: 'violao', nivel: 'basico' }), 0);
});

test('o violão nunca recebe sugestão negativa', () => {
  const cifra = '<b>C# F# G#m B</b><br>letra<br><b>C# G# C#</b>';
  const sugerido = chords.sugerirDeslocamento(cifra, { instrumento: 'violao', nivel: 'simplificar' });
  assert.ok(sugerido >= 0 && sugerido <= 7, 'esperava valor entre 0 e 7, veio ' + sugerido);
});

test('o teclado recebe sugestão negativa quando descer é o caminho curto', () => {
  // Ré bemol: Db, Gb, Ab, Bbm. Transpose -1 leva para formas de Ré, que o
  // capotraste do violão jamais alcançaria.
  const cifra = '<b>Db Gb Ab Bbm</b><br>letra<br><b>Db Ab Db</b>';
  const opcoes = { instrumento: 'teclado', nivel: 'simplificar' };
  assert.equal(chords.sugerirDeslocamento(cifra, opcoes), -1);
});

test('entre dois deslocamentos igualmente bons vence o de menor módulo', () => {
  // Si maior resolve subindo 2 (formas de Lá) ou descendo 3 (formas de Ré).
  const cifra = '<b>B E F#m A</b><br>letra<br><b>B F# B</b>';
  const opcoes = { instrumento: 'teclado', nivel: 'simplificar' };
  assert.equal(chords.custoDeslocamento(cifra, -3, opcoes), 0);
  assert.equal(chords.custoDeslocamento(cifra, 2, opcoes), 0);
  assert.equal(chords.sugerirDeslocamento(cifra, opcoes), 2);
});

test('aplicar o deslocamento mostra as formas mais graves e preserva a letra', () => {
  const cifra = '<b>A D E</b><br>a letra continua igual';
  assert.equal(chords.aplicarDeslocamento(cifra, 2), '<b>G C D</b><br>a letra continua igual');
});

test('deslocamento zero devolve a cifra intacta', () => {
  const cifra = '<b>A D E</b><br>a letra continua igual';
  assert.equal(chords.aplicarDeslocamento(cifra, 0), cifra);
});

test('informa em que tom ficam as formas com o capotraste posto', () => {
  assert.equal(chords.tomDasFormas('A', 2), 'G');
  assert.equal(chords.tomDasFormas('Am', 2), 'Gm');
  assert.equal(chords.tomDasFormas('A', 0), 'A');
});

test('mede o custo de um deslocamento contando os acordes difíceis', () => {
  const cifra = '<b>D A Bm G F#m</b>';
  assert.equal(chords.custoDeslocamento(cifra, 0, { instrumento: 'violao', nivel: 'basico' }), 2);
  assert.equal(chords.custoDeslocamento(cifra, 2, { instrumento: 'violao', nivel: 'basico' }), 1);
});

test('a faixa manual do violão não desce abaixo de zero', () => {
  assert.deepEqual(chords.faixaManual('violao'), { min: 0, max: 12 });
  assert.deepEqual(chords.faixaManual('teclado'), { min: -12, max: 12 });
  assert.deepEqual(chords.faixaManual('outro'), { min: -12, max: 12 });
});

test('a janela do cálculo automático é menor que a faixa manual', () => {
  assert.deepEqual(chords.janelaAutomatica('violao'), { min: 0, max: 7 });
  assert.deepEqual(chords.janelaAutomatica('teclado'), { min: -6, max: 6 });
});

test('cada instrumento tem o seu rótulo', () => {
  assert.equal(chords.rotuloDeslocamento('violao'), 'Capotraste');
  assert.equal(chords.rotuloDeslocamento('teclado'), 'Transpose');
  assert.equal(chords.rotuloDeslocamento('outro'), 'Transposição');
});

test('instrumento desconhecido cai no comportamento neutro', () => {
  assert.deepEqual(chords.faixaManual('gaita'), { min: -12, max: 12 });
  assert.equal(chords.rotuloDeslocamento('gaita'), 'Transposição');
});
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
node --test tests/chords.test.js
```

Esperado: FAIL — `chords.sugerirDeslocamento is not a function`.

- [ ] **Step 3: Implementar em `chords.js`**

Inserir antes de `root.CifroChords = {` (linha 242), depois de `keysForMode`:

```js
  const INSTRUMENTOS = ['violao', 'teclado', 'outro'];
  const FAIXA_MANUAL = {
    violao: { min: 0, max: 12 },
    teclado: { min: -12, max: 12 },
    outro: { min: -12, max: 12 }
  };
  // A janela do automático é menor que a faixa manual de propósito: fora dela o
  // resultado só se repete (deslocamento 8 dá as mesmas formas que -4), então
  // buscar mais longe produziria posição apertada sem nenhum ganho. Chegar lá é
  // decisão de quem toca, no controle manual.
  const JANELA_AUTOMATICA = {
    violao: { min: 0, max: 7 },
    teclado: { min: -6, max: 6 },
    outro: { min: -6, max: 6 }
  };
  const ROTULO = { violao: 'Capotraste', teclado: 'Transpose', outro: 'Transposição' };
  // Formas abertas do violão, por qualidade. Pestana é o que o nível básico evita.
  const RAIZES_ABERTAS_MAIOR = ['C', 'A', 'G', 'E', 'D'];
  const RAIZES_ABERTAS_MENOR = ['A', 'E', 'D'];
  // Tons de menos teclas pretas, para quem toca teclado.
  const RAIZES_POUCAS_TECLAS_PRETAS = ['C', 'G', 'F', 'D'];
  const RAIZES_POUCAS_TECLAS_PRETAS_MENOR = ['A', 'E', 'D'];

  function instrumentoValido(instrumento) {
    return INSTRUMENTOS.indexOf(String(instrumento)) !== -1 ? String(instrumento) : 'outro';
  }

  function faixaManual(instrumento) {
    const faixa = FAIXA_MANUAL[instrumentoValido(instrumento)];
    return { min: faixa.min, max: faixa.max };
  }

  function janelaAutomatica(instrumento) {
    const faixa = JANELA_AUTOMATICA[instrumentoValido(instrumento)];
    return { min: faixa.min, max: faixa.max };
  }

  function rotuloDeslocamento(instrumento) {
    return ROTULO[instrumentoValido(instrumento)];
  }

  // Deslocamento positivo = instrumento sobe, então as formas descem.
  function aplicarDeslocamento(html, deslocamento) {
    const valor = Number(deslocamento) || 0;
    return valor === 0 ? String(html || '') : transposeHtml(html, -valor);
  }

  function tomDasFormas(tomSoante, deslocamento) {
    const normalizado = normalizeKey(tomSoante);
    if (!normalizado) return '';
    const valor = Number(deslocamento) || 0;
    const indice = noteIndex(tonicOf(normalizado));
    if (indice === undefined) return '';
    const menor = normalizado.endsWith('m');
    return NOTES[(indice - valor + 1200) % 12] + (menor ? 'm' : '');
  }

  // Um acorde "atrapalha" quando o critério do instrumento diz que ele é difícil
  // de tocar. Só a raiz conta: D/F# é trivial e seria punido injustamente pelo
  // sustenido do baixo.
  function atrapalha(chord, instrumento, nivel) {
    const raiz = NOTES[chord.pitch];
    const temAcidente = raiz.length > 1;

    if (nivel !== 'basico') return temAcidente;

    if (chord.quality === 'diminished' || chord.quality === 'augmented') return true;

    if (instrumentoValido(instrumento) === 'violao') {
      const abertas = chord.quality === 'minor' ? RAIZES_ABERTAS_MENOR : RAIZES_ABERTAS_MAIOR;
      return abertas.indexOf(raiz) === -1;
    }

    const faceis = chord.quality === 'minor' ? RAIZES_POUCAS_TECLAS_PRETAS_MENOR : RAIZES_POUCAS_TECLAS_PRETAS;
    return faceis.indexOf(raiz) === -1;
  }

  function deslocarAcorde(chord, deslocamento) {
    return { pitch: (chord.pitch - deslocamento + 1200) % 12, quality: chord.quality };
  }

  function custoDeslocamento(html, deslocamento, opcoes) {
    const config = opcoes || {};
    const instrumento = instrumentoValido(config.instrumento);
    const nivel = config.nivel === 'basico' ? 'basico' : 'simplificar';
    const valor = Number(deslocamento) || 0;
    return extractChords(html).reduce(function (total, chord) {
      return total + (atrapalha(deslocarAcorde(chord, valor), instrumento, nivel) ? 1 : 0);
    }, 0);
  }

  function sugerirDeslocamento(html, opcoes) {
    const config = opcoes || {};
    const instrumento = instrumentoValido(config.instrumento);
    const nivel = config.nivel === 'basico' ? 'basico' : 'simplificar';
    const chords = extractChords(html);
    if (!chords.length) return 0;

    const janela = janelaAutomatica(instrumento);
    let melhor = 0;
    let melhorCusto = Infinity;

    for (let valor = janela.min; valor <= janela.max; valor += 1) {
      let custo = 0;
      chords.forEach(chord => {
        if (atrapalha(deslocarAcorde(chord, valor), instrumento, nivel)) custo += 1;
      });
      // Empate favorece o menor módulo, e o zero vence qualquer empate: assim o
      // sistema nunca propõe deslocamento sem ganho real.
      const melhorPorEmpate = custo === melhorCusto && Math.abs(valor) < Math.abs(melhor);
      if (custo < melhorCusto || melhorPorEmpate) {
        melhorCusto = custo;
        melhor = valor;
      }
    }

    return melhor;
  }
```

E acrescentar ao objeto exportado, dentro de `root.CifroChords = { ... }`:

```js
    INSTRUMENTOS: INSTRUMENTOS.slice(),
    aplicarDeslocamento,
    custoDeslocamento,
    faixaManual,
    janelaAutomatica,
    rotuloDeslocamento,
    sugerirDeslocamento,
    tomDasFormas,
```

Atenção à ordem de avaliação do laço: como ele começa em `janela.min`, para o teclado o primeiro candidato é `-6`. O desempate por menor módulo é o que garante que `0` continue vencendo quando o custo empata.

- [ ] **Step 4: Rodar para ver passar**

```bash
node --test tests/chords.test.js
```

Esperado: PASS em todos, inclusive nos testes que já existiam no arquivo.

- [ ] **Step 5: Ponto de parada**

Arquivos tocados: `public/src/js/chords.js`, `tests/chords.test.js`. Avise o autor para commitar antes de seguir.

---

### Task 2: Serviço `TransposicaoInstrumento` no PHP

**Files:**
- Create: `public/src/Services/TransposicaoInstrumento.php`
- Test: `tests/php/TransposicaoInstrumentoTest.php`

**Interfaces:**
- Produces:
  - `TransposicaoInstrumento::MIN = -12`, `::MAX = 12`
  - `TransposicaoInstrumento::normalizar($valor): ?int` — null quando inválido
  - `TransposicaoInstrumento::instrumentoValido(string $instrumento): bool`
  - `TransposicaoInstrumento::PREFERENCIAS = ['simplificar','basico','cadastrado','nunca']`
  - `TransposicaoInstrumento::INSTRUMENTOS = ['violao','teclado','outro']`
  - `TransposicaoInstrumento::rotulo(string $instrumento): string`

Este serviço existe para que a validação de faixa seja testável: `editor/api.php` é um script de endpoint e não dá para exercitar em unidade.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/php/TransposicaoInstrumentoTest.php`:

```php
<?php
use PHPUnit\Framework\TestCase;

final class TransposicaoInstrumentoTest extends TestCase
{
    public function testAceitaDeslocamentoDentroDaFaixaDeUmaOitava(): void
    {
        $this->assertSame(0, TransposicaoInstrumento::normalizar(0));
        $this->assertSame(2, TransposicaoInstrumento::normalizar(2));
        $this->assertSame(-6, TransposicaoInstrumento::normalizar(-6));
        $this->assertSame(12, TransposicaoInstrumento::normalizar(12));
        $this->assertSame(-12, TransposicaoInstrumento::normalizar(-12));
    }

    public function testAceitaDeslocamentoEnviadoComoTexto(): void
    {
        $this->assertSame(3, TransposicaoInstrumento::normalizar('3'));
        $this->assertSame(-3, TransposicaoInstrumento::normalizar('-3'));
    }

    public function testRecusaDeslocamentoForaDaFaixa(): void
    {
        $this->assertNull(TransposicaoInstrumento::normalizar(13));
        $this->assertNull(TransposicaoInstrumento::normalizar(-13));
    }

    public function testRecusaValorQueNaoEhNumeroInteiro(): void
    {
        $this->assertNull(TransposicaoInstrumento::normalizar('dois'));
        $this->assertNull(TransposicaoInstrumento::normalizar(1.5));
        $this->assertNull(TransposicaoInstrumento::normalizar(null));
        $this->assertNull(TransposicaoInstrumento::normalizar([]));
    }

    public function testCampoVazioValeComoSemDeslocamento(): void
    {
        $this->assertSame(0, TransposicaoInstrumento::normalizar(''));
    }

    public function testReconheceOsInstrumentosSuportados(): void
    {
        $this->assertTrue(TransposicaoInstrumento::instrumentoValido('violao'));
        $this->assertTrue(TransposicaoInstrumento::instrumentoValido('teclado'));
        $this->assertTrue(TransposicaoInstrumento::instrumentoValido('outro'));
        $this->assertFalse(TransposicaoInstrumento::instrumentoValido('gaita'));
    }

    public function testCadaInstrumentoTemSeuRotulo(): void
    {
        $this->assertSame('Capotraste', TransposicaoInstrumento::rotulo('violao'));
        $this->assertSame('Transpose', TransposicaoInstrumento::rotulo('teclado'));
        $this->assertSame('Transposição', TransposicaoInstrumento::rotulo('outro'));
        $this->assertSame('Transposição', TransposicaoInstrumento::rotulo('gaita'));
    }
}
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npm run test:unit:php -- --filter TransposicaoInstrumentoTest
```

Esperado: FAIL — `Class "TransposicaoInstrumento" not found`. O autoload de `tests/php/bootstrap.php` já varre `public/src/Services`, então basta criar o arquivo.

- [ ] **Step 3: Implementar o serviço**

Criar `public/src/Services/TransposicaoInstrumento.php`:

```php
<?php
/**
 * TransposicaoInstrumento — o quanto o instrumento sobe em relação às formas
 * mostradas na tela. Positivo é capotraste no violão ou transpose para cima no
 * teclado; negativo só existe para quem transpõe eletronicamente.
 */
class TransposicaoInstrumento
{
    public const MIN = -12;
    public const MAX = 12;

    public const INSTRUMENTOS  = ['violao', 'teclado', 'outro'];
    public const PREFERENCIAS  = ['simplificar', 'basico', 'cadastrado', 'nunca'];

    private const ROTULOS = [
        'violao'  => 'Capotraste',
        'teclado' => 'Transpose',
        'outro'   => 'Transposição',
    ];

    /** Devolve o deslocamento normalizado, ou null quando o valor é inválido. */
    public static function normalizar($valor): ?int
    {
        if ($valor === '' || $valor === null) {
            return 0;
        }
        if (is_bool($valor) || is_array($valor)) {
            return null;
        }
        if (is_float($valor) && $valor != (int) $valor) {
            return null;
        }
        $inteiro = filter_var($valor, FILTER_VALIDATE_INT);
        if ($inteiro === false) {
            return null;
        }
        return ($inteiro >= self::MIN && $inteiro <= self::MAX) ? $inteiro : null;
    }

    public static function instrumentoValido(string $instrumento): bool
    {
        return in_array($instrumento, self::INSTRUMENTOS, true);
    }

    public static function rotulo(string $instrumento): string
    {
        return self::ROTULOS[$instrumento] ?? 'Transposição';
    }
}
```

Cuidado com um detalhe do PHP: `filter_var(1.5, FILTER_VALIDATE_INT)` devolve `false`, mas `filter_var(2.0, ...)` devolve `2`. A checagem de float acima existe para que `1.5` seja recusado antes, e `2.0` continue aceito.

- [ ] **Step 4: Rodar para ver passar**

```bash
npm run test:unit:php -- --filter TransposicaoInstrumentoTest
```

Esperado: PASS, 7 testes.

- [ ] **Step 5: Ponto de parada**

Arquivos: `public/src/Services/TransposicaoInstrumento.php`, `tests/php/TransposicaoInstrumentoTest.php`.

---

### Task 3: Coluna no banco e persistência

**Files:**
- Create: `migrations/20260816_musica_transposicao_instrumento.sql`
- Modify: `create_tables.sql:112-127` (bloco `CREATE TABLE musicas`)
- Modify: `public/src/Repositories/MusicaRepository.php:43-99` (`save` e `copy`)
- Modify: `public/src/backend/editor/api.php:104-112` (montagem do `$payload`)

**Interfaces:**
- Consumes: `TransposicaoInstrumento::normalizar()` da Task 2.
- Produces: coluna `musicas.transposicao_instrumento`, presente em todo `SELECT *` — logo no snapshot de `/api/sync/data.php` e no cache offline, sem mudança adicional.

- [ ] **Step 1: Escrever a migration**

Criar `migrations/20260816_musica_transposicao_instrumento.sql`:

```sql
-- Capotraste (violão) ou transpose (teclado) sugerido pelo cadastro da música.
-- Positivo = o instrumento sobe em relação às formas mostradas na tela; o som
-- que sai não muda. A cifra continua guardada sempre no tom soante, então as
-- músicas que já existem ficam corretas com o valor padrão 0.
ALTER TABLE musicas
  ADD COLUMN IF NOT EXISTS transposicao_instrumento TINYINT NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Não tocar em `create_tables.sql`**

A coluna fica **só na migration**. `create_tables.sql` é o baseline, e `scripts/setup/setup_e2e_db.php` aplica baseline e depois migrations, na mesma sequência da produção — declarar nos dois lugares faria o provisionamento de banco novo morrer com `1060 Duplicate column name`. O `IF NOT EXISTS` da migration é a rede de segurança para bases que já tenham a coluna.

- [ ] **Step 3: Aplicar a migration**

```bash
C:/xampp/php/php.exe scripts/setup/migrate.php
```

Esperado: a migration nova aparece como aplicada. Migrations já aplicadas não podem ter o conteúdo alterado depois — se precisar corrigir o SQL, crie outro arquivo em vez de editar este.

- [ ] **Step 4: Gravar a coluna no repositório**

Em `public/src/Repositories/MusicaRepository.php`, no `save()`, trocar o UPDATE e o INSERT:

```php
            $stmt = $this->pdo->prepare(
                'UPDATE musicas SET nome=?, artista=?, classificacao=?, cifra=?, bit=?, source_url=?, transposicao_instrumento=? WHERE id=? AND banda_id=?'
            );
            $stmt->execute([
                $musica['nome'],
                $musica['artista'] ?? '',
                $musica['classificacao'] ?? '',
                $musica['cifra'] ?? '',
                $musica['bit'] ?? '',
                $musica['source_url'] ?? null,
                (int)($musica['transposicao_instrumento'] ?? 0),
                (int)$musica['id'],
                $bandaId,
            ]);
```

```php
        $stmt = $this->pdo->prepare(
            'INSERT INTO musicas (banda_id, nome, artista, classificacao, cifra, bit, source_url, transposicao_instrumento) VALUES (?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $bandaId,
            $musica['nome'],
            $musica['artista'] ?? '',
            $musica['classificacao'] ?? '',
            $musica['cifra'] ?? '',
            $musica['bit'] ?? '',
            $musica['source_url'] ?? null,
            (int)($musica['transposicao_instrumento'] ?? 0),
        ]);
```

E no `copy()`, para a cópia não perder o capotraste:

```php
        $stmt = $this->pdo->prepare(
            'INSERT INTO musicas (banda_id, nome, artista, classificacao, cifra, bit, transposicao_instrumento)
             VALUES (?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $bandaId,
            'Cópia de ' . $original['nome'],
            $original['artista'],
            $original['classificacao'],
            $original['cifra'],
            $original['bit'],
            (int)($original['transposicao_instrumento'] ?? 0),
        ]);
```

- [ ] **Step 5: Validar na API do editor**

Em `public/src/backend/editor/api.php`, logo antes da montagem de `$payload` (depois da linha que calcula `$sourceUrl`):

```php
$transposicao = TransposicaoInstrumento::normalizar($data['transposicao_instrumento'] ?? 0);
if ($transposicao === null) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Deslocamento de instrumento inválido.']);
    exit;
}
```

E incluir no array `$payload`:

```php
    'transposicao_instrumento' => $transposicao,
```

- [ ] **Step 6: Conferir de ponta a ponta**

```bash
npm run test:unit:php
```

Esperado: PASS. Depois, com o servidor de pé, salvar uma música pelo editor e conferir no banco:

```bash
C:/xampp/mysql/bin/mysql.exe -u root cifras_fdm -e "DESCRIBE musicas;"
```

Esperado: a coluna `transposicao_instrumento` aparece como `tinyint`, `NO`, default `0`.

- [ ] **Step 7: Ponto de parada**

Arquivos: migration, `create_tables.sql`, `MusicaRepository.php`, `editor/api.php`.

---

### Task 4: Preferência e instrumento em `usuarios.config`

**Files:**
- Modify: `public/src/Services/UserConfigValidator.php`
- Test: `tests/php/UserConfigValidatorTest.php` (criar se não existir; conferir antes com `ls tests/php`)

**Interfaces:**
- Consumes: `TransposicaoInstrumento::INSTRUMENTOS` e `::PREFERENCIAS` da Task 2.
- Produces: as chaves `instrumento` e `transposicaoPreferencia` aceitas por `salvar_config.php`. Nenhuma mudança é necessária no endpoint: ele já itera sobre a whitelist do validador.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `tests/php/UserConfigValidatorTest.php` (ou criar o arquivo com este conteúdo):

```php
<?php
use PHPUnit\Framework\TestCase;

final class UserConfigValidatorTest extends TestCase
{
    public function testAceitaOsInstrumentosSuportados(): void
    {
        $this->assertSame('violao', UserConfigValidator::validate('instrumento', 'violao'));
        $this->assertSame('teclado', UserConfigValidator::validate('instrumento', 'teclado'));
        $this->assertSame('outro', UserConfigValidator::validate('instrumento', 'outro'));
    }

    public function testRecusaInstrumentoDesconhecido(): void
    {
        $this->assertNull(UserConfigValidator::validate('instrumento', 'gaita'));
        $this->assertNull(UserConfigValidator::validate('instrumento', 123));
    }

    public function testAceitaAsQuatroPreferenciasDeCapotraste(): void
    {
        foreach (['simplificar', 'basico', 'cadastrado', 'nunca'] as $preferencia) {
            $this->assertSame($preferencia, UserConfigValidator::validate('transposicaoPreferencia', $preferencia));
        }
    }

    public function testRecusaPreferenciaDesconhecida(): void
    {
        $this->assertNull(UserConfigValidator::validate('transposicaoPreferencia', 'sempre'));
    }

    public function testAsChavesNovasSaoSalvaveis(): void
    {
        $this->assertTrue(UserConfigValidator::isKeySuportada('instrumento'));
        $this->assertTrue(UserConfigValidator::isKeySuportada('transposicaoPreferencia'));
    }
}
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npm run test:unit:php -- --filter UserConfigValidatorTest
```

Esperado: FAIL — `validate('instrumento', ...)` devolve null porque a chave cai no `default`.

- [ ] **Step 3: Implementar no validador**

Em `public/src/Services/UserConfigValidator.php`, dentro do `match` de `validate()`, antes do `default`:

```php
            'instrumento' => self::validateInstrumento($value),
            'transposicaoPreferencia' => self::validatePreferenciaTransposicao($value),
```

Trocar a lista de `isKeySuportada()`:

```php
        return in_array($key, [
            'tema', 'cifraSize', 'scrollSpeed', 'keepAwake', 'ajudaDesativada',
            'instrumento', 'transposicaoPreferencia',
        ], true);
```

E acrescentar os dois métodos privados:

```php
    private static function validateInstrumento($value): ?string
    {
        return is_string($value) && TransposicaoInstrumento::instrumentoValido($value) ? $value : null;
    }

    private static function validatePreferenciaTransposicao($value): ?string
    {
        return is_string($value) && in_array($value, TransposicaoInstrumento::PREFERENCIAS, true) ? $value : null;
    }
```

Como `UserConfigValidator.php` não tem `require`, e o autoload dos testes e do app resolvem `Services/`, a referência a `TransposicaoInstrumento` funciona nos dois contextos.

- [ ] **Step 4: Rodar para ver passar**

```bash
npm run test:unit:php -- --filter UserConfigValidatorTest
```

Esperado: PASS, 5 testes.

- [ ] **Step 5: Ponto de parada**

Arquivos: `UserConfigValidator.php`, `tests/php/UserConfigValidatorTest.php`.

---

### Task 5: Config do usuário disponível no JS

**Files:**
- Modify: `public/src/backend/bootstrap.php` (junto dos demais helpers de usuário, perto de `help_center_disabled_for_user`)
- Modify: `public/src/Views/index.php:344` (linha do `window.CIFRO_USER_ID`)
- Modify: `public/src/Views/music.php` (linha equivalente do `window.CIFRO_USER_ID`; localizar com grep)
- Modify: `public/src/Views/editor/editor.php:150`

**Interfaces:**
- Produces: `window.CIFRO_CONFIG = { instrumento, transposicaoPreferencia }` — objeto sempre presente; as chaves valem `null` quando o usuário ainda não escolheu. Tasks 6, 7, 8 e 9 dependem dele.

Sem isso, cada tela teria que buscar a preferência por `fetch`, o que não funciona offline — e a tela de música precisa dela já no primeiro render.

- [ ] **Step 1: Criar o helper no bootstrap**

Em `public/src/backend/bootstrap.php`, logo depois de `help_center_visible_for_user()`:

```php
/**
 * Preferências de capotraste/transpose do usuário, para injetar no JS.
 * Chave ausente vale null: é o que dispara o modal de primeiro acesso.
 */
function cifro_transposicao_config(?array $user = null): array {
    $user ??= $_SESSION['usuario'] ?? [];
    $config = $user['config'] ?? [];
    $instrumento = $config['instrumento'] ?? null;
    $preferencia = $config['transposicaoPreferencia'] ?? null;
    return [
        'instrumento' => is_string($instrumento) && TransposicaoInstrumento::instrumentoValido($instrumento) ? $instrumento : null,
        'transposicaoPreferencia' => is_string($preferencia) && in_array($preferencia, TransposicaoInstrumento::PREFERENCIAS, true) ? $preferencia : null,
    ];
}
```

- [ ] **Step 2: Injetar nas três telas**

Em `public/src/Views/index.php`, na linha que já define `window.CIFRO_USER_ID`, acrescentar ao final da mesma tag `<script>`:

```php
window.CIFRO_CONFIG = <?= json_encode(cifro_transposicao_config(), JSON_UNESCAPED_UNICODE) ?>;
```

Repetir exatamente a mesma adição em `public/src/Views/music.php` e em `public/src/Views/editor/editor.php:150`. Localizar as linhas com:

```bash
grep -n "window.CIFRO_USER_ID" public/src/Views/index.php public/src/Views/music.php public/src/Views/editor/editor.php
```

- [ ] **Step 3: Conferir no navegador**

Subir o servidor e abrir a home logada; no console:

```js
window.CIFRO_CONFIG
```

Esperado: `{ instrumento: null, transposicaoPreferencia: null }` para um usuário que ainda não escolheu.

- [ ] **Step 4: Ponto de parada**

Arquivos: `bootstrap.php`, `index.php`, `music.php`, `editor/editor.php`.

---

### Task 6: Campo de capotraste no cadastro da música

**Files:**
- Modify: `public/src/Views/editor/editor.php:64-80` (bloco `#songDetails`, ao lado de "Tom padrão")
- Modify: `public/src/js/editor.js:14-45` (mapa `elements`), `:229-240` (`selectSong`), `:377-386` (`payload`)

**Interfaces:**
- Consumes: `CifroChords.faixaManual`, `.rotuloDeslocamento`, `.sugerirDeslocamento`, `.tomDasFormas` (Task 1); `window.CIFRO_CONFIG` (Task 5); a validação de `editor/api.php` (Task 3).
- Produces: o campo `transposicao_instrumento` no payload de salvamento.

- [ ] **Step 1: Marcação no `#songDetails`**

Em `public/src/Views/editor/editor.php`, logo depois do `<label class="compact-field compact-field--key" for="tomPadrao">…</label>`:

```html
          <label class="compact-field compact-field--capo" for="transposicaoInstrumento">
            <span id="transposicaoLabel">Capotraste</span>
            <input id="transposicaoInstrumento" type="number" step="1" value="0" inputmode="numeric" aria-describedby="transposicaoHint">
          </label>
          <div class="compact-field compact-field--capo-actions">
            <button type="button" class="btn btn--secondary" id="sugerirTransposicao">Sugerir</button>
            <small id="transposicaoHint" aria-live="polite"></small>
          </div>
```

- [ ] **Step 2: Registrar os elementos no `editor.js`**

No mapa `elements` (após `key: document.getElementById('tomPadrao'),`):

```js
    transposicao: document.getElementById('transposicaoInstrumento'),
    transposicaoLabel: document.getElementById('transposicaoLabel'),
    transposicaoHint: document.getElementById('transposicaoHint'),
    sugerirTransposicao: document.getElementById('sugerirTransposicao'),
```

- [ ] **Step 3: Rótulo, faixa e legenda**

Acrescentar perto de `renderCategories()`:

```js
  function instrumentoDoUsuario() {
    return (window.CIFRO_CONFIG && window.CIFRO_CONFIG.instrumento) || 'outro';
  }

  function configurarCampoTransposicao() {
    // O rótulo segue o instrumento de quem edita, mas a faixa é a união: o
    // cadastro vale para a banda inteira, não só para quem digitou.
    elements.transposicaoLabel.textContent = window.CifroChords.rotuloDeslocamento(instrumentoDoUsuario());
    elements.transposicao.min = '-12';
    elements.transposicao.max = '12';
  }

  function atualizarLegendaTransposicao() {
    const valor = Number(elements.transposicao.value) || 0;
    const tom = detectedKey(getContent())?.key || '';
    if (!valor || !tom) {
      elements.transposicaoHint.textContent = '';
      return;
    }
    elements.transposicaoHint.textContent = 'formas em ' + window.CifroChords.tomDasFormas(tom, valor);
  }
```

Chamar `configurarCampoTransposicao()` uma vez na inicialização, junto das demais chamadas de setup do módulo.

- [ ] **Step 4: Carregar, sugerir e salvar**

Em `selectSong(song)`, junto de `elements.bpm.value = song.bit || '';`:

```js
    elements.transposicao.value = Number(song.transposicao_instrumento) || 0;
```

Depois da atribuição, chamar `atualizarLegendaTransposicao()`.

O arquivo já tem `snapshot()` e `detectDirty()` para saber se há alterações não salvas. Em vez de chamar `setDirty(true)` na mão, acrescente o campo ao `snapshot()` — assim o indicador de "não salvo" liga e desliga sozinho, igual aos demais campos:

```js
      cifra: getContent(),
      source_url: state.importSourceUrl,
      transposicao_instrumento: elements.transposicao.value
```

E ligue os eventos junto dos demais listeners:

```js
  elements.transposicao?.addEventListener('input', () => {
    atualizarLegendaTransposicao();
    detectDirty();
  });
  elements.sugerirTransposicao?.addEventListener('click', () => {
    const nivel = window.CIFRO_CONFIG?.transposicaoPreferencia === 'basico' ? 'basico' : 'simplificar';
    elements.transposicao.value = window.CifroChords.sugerirDeslocamento(getContent(), {
      instrumento: instrumentoDoUsuario(),
      nivel
    });
    atualizarLegendaTransposicao();
    detectDirty();
  });
```

Zerar o campo também em `newSong()`, senão o valor da música anterior vaza para a nova.

No objeto `payload` de `saveSong()`:

```js
      transposicao_instrumento: Number(elements.transposicao.value) || 0,
```

- [ ] **Step 5: Conferir no navegador**

Abrir o editor, escolher uma música em Ré com F#m e Bm, clicar em **Sugerir**. Esperado: o campo mostra `2` e a legenda diz `formas em C`. Salvar, recarregar a página, reabrir a música: o valor `2` continua lá.

- [ ] **Step 6: Ponto de parada**

Arquivos: `editor/editor.php`, `editor.js`.

---

### Task 7: Modal de primeiro acesso na home

**Files:**
- Modify: `public/src/Views/index.php:319-340` (ao lado do `betaWelcomeModal`) e o bloco `<script>` em `:355-375`

**Interfaces:**
- Consumes: `window.CIFRO_CONFIG` (Task 5), `salvar_config.php` (Task 4), Bootstrap 4 (`$().modal`, `data-dismiss`) já carregado nesta tela.
- Produces: as duas chaves gravadas em `usuarios.config`.

- [ ] **Step 1: Marcação do modal**

Em `public/src/Views/index.php`, logo depois do bloco do `betaWelcomeModal`:

```html
    <div class="modal fade" id="capoSetupModal" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="capoSetupModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="capoSetupModalLabel">Como você toca?</h5>
                </div>
                <div class="modal-body">
                    <div data-capo-step="1">
                        <p>O Cifrô pode simplificar os acordes para o seu instrumento sem mudar o tom que a banda toca.</p>
                        <p><strong>O que você toca?</strong></p>
                        <div class="btn-group-vertical btn-block" role="group" aria-label="Instrumento">
                            <button type="button" class="btn btn-outline-primary" data-capo-instrumento="violao">Violão ou guitarra</button>
                            <button type="button" class="btn btn-outline-primary" data-capo-instrumento="teclado">Teclado ou piano</button>
                            <button type="button" class="btn btn-outline-primary" data-capo-instrumento="outro">Outro instrumento ou voz</button>
                        </div>
                    </div>
                    <div data-capo-step="2" hidden>
                        <p><strong>Quando o Cifrô deve usar <span data-capo-termo>capotraste</span>?</strong></p>
                        <div class="btn-group-vertical btn-block" role="group" aria-label="Preferência">
                            <button type="button" class="btn btn-outline-primary" data-capo-preferencia="simplificar">
                                Sempre simplificar
                                <small class="d-block text-muted">Evita acordes com sustenido e bemol. Música em Si♭ vira formas de Lá.</small>
                            </button>
                            <button type="button" class="btn btn-outline-primary" data-capo-preferencia="basico">
                                Nível básico
                                <small class="d-block text-muted" data-capo-basico-desc>Busca só formas abertas, sem pestana.</small>
                            </button>
                            <button type="button" class="btn btn-outline-primary" data-capo-preferencia="cadastrado">
                                Só quando a música pedir
                                <small class="d-block text-muted">Usa apenas o que estiver cadastrado na música.</small>
                            </button>
                            <button type="button" class="btn btn-outline-primary" data-capo-preferencia="nunca">
                                Nunca usar
                                <small class="d-block text-muted">Mostra sempre a cifra no tom original.</small>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <small class="text-muted mr-auto">Dá para mudar isso quando quiser em Configurações.</small>
                    <button type="button" class="btn btn-secondary" data-dismiss="modal" id="capoSetupLater">Decidir depois</button>
                </div>
            </div>
        </div>
    </div>
```

- [ ] **Step 2: Comportamento**

No bloco `<script>` da mesma tela, junto do trecho do `betaWelcomeModal`:

```js
        // Capotraste/transpose: pergunta o instrumento e a preferência de quem
        // ainda não escolheu. "Decidir depois" não grava nada, então a pergunta
        // volta no próximo acesso — mas só uma vez por sessão, para não repetir
        // a cada volta para a home.
        $(function () {
            var SESSAO_KEY = 'cifroCapoSetupPerguntado';
            var config = window.CIFRO_CONFIG || {};
            if (config.instrumento && config.transposicaoPreferencia) return;
            try {
                if (sessionStorage.getItem(SESSAO_KEY)) return;
                sessionStorage.setItem(SESSAO_KEY, '1');
            } catch (error) {
                // sessionStorage indisponível — segue e mostra o modal.
            }

            var escolhido = { instrumento: config.instrumento || null };

            function termoDoInstrumento(instrumento) {
                return instrumento === 'violao' ? 'capotraste'
                    : instrumento === 'teclado' ? 'transpose' : 'transposição';
            }

            function descricaoBasico(instrumento) {
                return instrumento === 'violao'
                    ? 'Busca só formas abertas, sem pestana.'
                    : 'Busca o tom com menos teclas pretas.';
            }

            async function salvar(chave, valor) {
                try {
                    var resposta = await fetch('/src/backend/users/salvar_config.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ config: { [chave]: valor } })
                    });
                    var dados = await resposta.json();
                    return resposta.ok && dados.sucesso;
                } catch (error) {
                    return false;
                }
            }

            $('#capoSetupModal').on('click', '[data-capo-instrumento]', async function () {
                escolhido.instrumento = this.dataset.capoInstrumento;
                $('#capoSetupModal [data-capo-termo]').text(termoDoInstrumento(escolhido.instrumento));
                $('#capoSetupModal [data-capo-basico-desc]').text(descricaoBasico(escolhido.instrumento));
                $('#capoSetupModal [data-capo-step="1"]').attr('hidden', true);
                $('#capoSetupModal [data-capo-step="2"]').removeAttr('hidden');
                await salvar('instrumento', escolhido.instrumento);
            });

            $('#capoSetupModal').on('click', '[data-capo-preferencia]', async function () {
                var preferencia = this.dataset.capoPreferencia;
                var salvo = await salvar('transposicaoPreferencia', preferencia);
                if (salvo) {
                    window.CIFRO_CONFIG = {
                        instrumento: escolhido.instrumento,
                        transposicaoPreferencia: preferencia
                    };
                }
                $('#capoSetupModal').modal('hide');
                if (window.cifroToast) {
                    cifroToast(salvo ? 'Preferência salva' : 'Não foi possível salvar agora', salvo ? 'success' : 'error');
                }
            });

            $('#capoSetupModal').modal('show');
        });
```

O CSRF é resolvido por `cifro-csrf.js`, que já embrulha o `fetch` global nesta tela — por isso a chamada não precisa montar o cabeçalho na mão. Confirme com `grep -n "fetch" public/src/js/cifro-csrf.js` antes de seguir; se o wrapper não cobrir, acrescentar o header a partir de `document.querySelector('meta[name="csrf-token"]')`.

- [ ] **Step 3: Conferir no navegador**

Zerar a config de um usuário de teste:

```bash
C:/xampp/mysql/bin/mysql.exe -u root cifras_fdm -e "UPDATE usuarios SET config = JSON_REMOVE(COALESCE(config,'{}'), '$.instrumento', '$.transposicaoPreferencia') WHERE email = 'SEU_EMAIL';"
```

Abrir a home: o modal aparece no passo 1. Escolher "Teclado" e conferir que o passo 2 fala em *transpose* e que o nível básico menciona teclas pretas. Escolher uma preferência, recarregar: o modal não volta. Repetir com "Decidir depois", abrir nova aba anônima: o modal volta.

- [ ] **Step 4: Ponto de parada**

Arquivo: `index.php`.

---

### Task 8: Seção nas Configurações

**Files:**
- Modify: `public/src/Views/config.php:216-236` (depois da seção "Cifra") e o bloco de script em `:480-500`

**Interfaces:**
- Consumes: `cfgGet`, `cfgGetEnum`, `cfgSave`, `showSaveResult` — helpers já definidos nesta tela.
- Produces: nada além das duas chaves já salvas.

- [ ] **Step 1: Marcação**

Depois do fechamento da `<section>` de "Cifra", acrescentar:

```html
        <!-- ===== Instrumento e capotraste ===== -->
        <section class="config-section" aria-labelledby="sec-capotraste">
            <header class="config-section__header"><h2 class="config-section__title" id="sec-capotraste">Instrumento e capotraste</h2></header>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">O que você toca</p>
                    <p class="config-row__desc">Define o nome e os limites do ajuste: capotraste no violão, transpose no teclado.</p>
                </div>
                <div class="config-row__control">
                    <select id="cfgInstrumento" aria-label="Instrumento">
                        <option value="violao">Violão ou guitarra</option>
                        <option value="teclado">Teclado ou piano</option>
                        <option value="outro">Outro instrumento ou voz</option>
                    </select>
                </div>
            </div>

            <div class="config-row">
                <div class="config-row__label">
                    <p class="config-row__title">Quando usar <span id="cfgCapoTermo">capotraste</span></p>
                    <p class="config-row__desc" id="cfgCapoDesc">Simplificar evita acordes com sustenido e bemol.</p>
                </div>
                <div class="config-row__control">
                    <select id="cfgTransposicaoPreferencia" aria-label="Preferência de capotraste">
                        <option value="simplificar">Sempre simplificar</option>
                        <option value="basico">Nível básico</option>
                        <option value="cadastrado">Só quando a música pedir</option>
                        <option value="nunca">Nunca usar</option>
                    </select>
                </div>
            </div>
        </section>
```

- [ ] **Step 2: Comportamento**

Dentro da IIFE de configurações, junto dos demais blocos:

```js
            // ---- Instrumento e capotraste ----
            var instrumentoSel = document.getElementById('cfgInstrumento');
            var capoSel = document.getElementById('cfgTransposicaoPreferencia');
            var capoTermo = document.getElementById('cfgCapoTermo');
            var capoDesc = document.getElementById('cfgCapoDesc');

            function termoDoInstrumento(instrumento) {
                return instrumento === 'violao' ? 'capotraste'
                    : instrumento === 'teclado' ? 'transpose' : 'transposição';
            }

            function aplicarVocabulario() {
                var instrumento = instrumentoSel.value;
                capoTermo.textContent = termoDoInstrumento(instrumento);
                capoDesc.textContent = instrumento === 'violao'
                    ? 'Nível básico busca só formas abertas, sem pestana.'
                    : 'Nível básico busca o tom com menos teclas pretas.';
            }

            instrumentoSel.value = cfgGetEnum('instrumento', ['violao', 'teclado', 'outro'], 'outro');
            capoSel.value = cfgGetEnum('transposicaoPreferencia', ['simplificar', 'basico', 'cadastrado', 'nunca'], 'cadastrado');
            aplicarVocabulario();

            instrumentoSel.addEventListener('change', async function () {
                aplicarVocabulario();
                var saved = await cfgSave('instrumento', instrumentoSel.value);
                showSaveResult(saved, 'Instrumento salvo');
            });

            capoSel.addEventListener('change', async function () {
                var saved = await cfgSave('transposicaoPreferencia', capoSel.value);
                showSaveResult(saved, 'Preferência salva');
            });
```

- [ ] **Step 3: Conferir no navegador**

Abrir Configurações, trocar de "Violão" para "Teclado": o texto muda de *capotraste* para *transpose* e a descrição do nível básico passa a falar de teclas pretas, sem recarregar. Trocar a preferência, recarregar a página e conferir que os dois campos voltam com o valor salvo.

- [ ] **Step 4: Ponto de parada**

Arquivo: `config.php`.

---

### Task 9: Exibição e controles na tela de música

**Files:**
- Modify: `public/src/Views/music.php:82-96` (barra rápida), `:110-121` (linha do Tom nos Ajustes), `:264-267` (header), `:1919-1967` (`renderSong`), `:2057-2090` (botões de tom)

**Interfaces:**
- Consumes: Task 1 inteira, `window.CIFRO_CONFIG` (Task 5), `song.transposicao_instrumento` (Task 3).
- Produces: `cifraDiv.dataset.tomSoante` — string com o tom soante corrente, consumida pela Task 10.

Esta é a maior tarefa do plano. `music.php` já tem `getRawCifraHtml()`, `setCifraHtml()`, `identificarTom()` e `transporCifraHtml()`; a lógica nova se apoia neles em vez de reimplementar.

- [ ] **Step 1: Marcação da linha nos Ajustes**

Em `public/src/Views/music.php`, logo depois da `<div class="music-control-row">` do Tom:

```html
                <div class="music-control-row">
                    <div class="music-control-label">
                        <strong id="capoLabel">Capotraste</strong>
                        <span id="capoInfo" class="live-status"></span>
                    </div>
                    <div class="music-inline-stepper" role="group" aria-label="Capotraste">
                        <button type="button" id="decrease-capo" aria-label="Diminuir capotraste">−</button>
                        <span id="capoValor" aria-live="polite">0</span>
                        <button type="button" id="increase-capo" aria-label="Aumentar capotraste">+</button>
                    </div>
                </div>
                <button type="button" id="capoAutomatico" class="music-control-proxy">Automático</button>
```

- [ ] **Step 2: Botão na barra rápida**

Dentro de `<div class="music-bottom-bar__group music-bottom-bar__secondary" …>`, acrescentar:

```html
            <button type="button" id="quickCapo" class="music-bottom-bar__btn" aria-label="Pôr ou tirar capotraste" aria-pressed="false">Capo</button>
```

- [ ] **Step 3: Estado e aplicação**

Dentro do `$(document).ready` de `music.php`, depois de `const cifraDiv = document.getElementById('song-cifra');`:

```js
            const capo = {
                valor: 0,
                automatico: true,   // false depois que o músico mexe na mão
                tomSoante: ''
            };

            function instrumentoDoUsuario() {
                return (window.CIFRO_CONFIG && window.CIFRO_CONFIG.instrumento) || 'outro';
            }

            function preferenciaDeCapo() {
                return (window.CIFRO_CONFIG && window.CIFRO_CONFIG.transposicaoPreferencia) || 'cadastrado';
            }

            // Ordem de decisão da spec: preferência do usuário, com desempate a
            // favor do cadastro — se o valor cadastrado for tão bom quanto o
            // calculado, vence o cadastro, que carrega conhecimento humano
            // sobre a música.
            function capoInicial(cifraHtml) {
                const cadastrado = Number(song.transposicao_instrumento) || 0;
                const preferencia = preferenciaDeCapo();
                if (preferencia === 'nunca') return 0;
                if (preferencia === 'cadastrado') return limitarCapo(cadastrado);

                const instrumento = instrumentoDoUsuario();
                const nivel = preferencia === 'basico' ? 'basico' : 'simplificar';
                const calculado = window.CifroChords.sugerirDeslocamento(cifraHtml, { instrumento, nivel });
                if (!cadastrado) return calculado;

                const custoCadastrado = window.CifroChords.custoDeslocamento(cifraHtml, cadastrado, { instrumento, nivel });
                const custoCalculado = window.CifroChords.custoDeslocamento(cifraHtml, calculado, { instrumento, nivel });
                return limitarCapo(custoCadastrado <= custoCalculado ? cadastrado : calculado);
            }

            function limitarCapo(valor) {
                const faixa = window.CifroChords.faixaManual(instrumentoDoUsuario());
                return Math.max(faixa.min, Math.min(faixa.max, Number(valor) || 0));
            }

            function renderizarCifraComCapo() {
                const base = window.__cifraSoanteHtml || '';
                const exibida = window.CifroChords.aplicarDeslocamento(base, capo.valor);
                if (window.__modoSomenteLetra) {
                    setCifraHtml(stripChordLinesKeepTags(exibida));
                } else {
                    setCifraHtml(exibida);
                }
                atualizarIndicadores();
            }

            function atualizarIndicadores() {
                const rotulo = window.CifroChords.rotuloDeslocamento(instrumentoDoUsuario());
                document.getElementById('capoLabel').textContent = rotulo;
                document.getElementById('capoValor').textContent = String(capo.valor);
                document.getElementById('quickCapo').setAttribute('aria-pressed', capo.valor !== 0 ? 'true' : 'false');

                // O indicador de tom mostra SEMPRE o tom soante: repertório, live
                // e conversa entre músicos falam do som que sai, não da forma.
                $("#tom").text(window.__modoSomenteLetra ? '' : capo.tomSoante);
                cifraDiv.dataset.tomSoante = capo.tomSoante || '';

                const formas = capo.valor && capo.tomSoante
                    ? rotulo.toLowerCase() + ' ' + capo.valor + ' · formas em ' + window.CifroChords.tomDasFormas(capo.tomSoante, capo.valor)
                    : '';
                document.getElementById('capoInfo').textContent = formas;
                document.getElementById('song-tom-display').textContent =
                    [capo.tomSoante, capo.valor ? rotulo.toLowerCase() + ' ' + capo.valor : ''].filter(Boolean).join(' · ');
            }

            function definirCapo(valor, manual) {
                capo.valor = limitarCapo(valor);
                if (manual) capo.automatico = false;
                renderizarCifraComCapo();
            }
```

- [ ] **Step 4: Ligar no `renderSong`**

Em `renderSong()`, substituir o trecho que hoje faz o render inicial e escreve o tom. O `window.__cifraOriginalHtml` continua sendo a cifra **soante** — passa a existir também `window.__cifraSoanteHtml` com o mesmo papel e nome explícito:

```js
                // Render inicial
                window.__cifraSoanteHtml = cifraInicial;
                window.__cifraOriginalHtml = cifraInicial;
                window.__modoSomenteLetra = localStorage.getItem('modoSomenteLetra') === '1';
                capo.tomSoante = identificarTom(cifraInicial);
                capo.valor = capoInicial(cifraInicial);
                capo.automatico = true;
                renderizarCifraComCapo();
```

Remover o bloco antigo que fazia `setCifraHtml(cifraInicial)` seguido do `if (savedMode) { … } else { $("#tom").text(...) }` — `renderizarCifraComCapo()` cobre os dois casos.

- [ ] **Step 5: Eventos dos controles**

Junto dos listeners de tom:

```js
            document.getElementById('increase-capo').addEventListener('click', () => {
                if (window.__modoSomenteLetra) return;
                definirCapo(capo.valor + 1, true);
            });

            document.getElementById('decrease-capo').addEventListener('click', () => {
                if (window.__modoSomenteLetra) return;
                definirCapo(capo.valor - 1, true);
            });

            document.getElementById('capoAutomatico').addEventListener('click', () => {
                if (window.__modoSomenteLetra) return;
                capo.automatico = true;
                definirCapo(capoInicial(window.__cifraSoanteHtml), false);
            });

            document.getElementById('quickCapo').addEventListener('click', () => {
                if (window.__modoSomenteLetra) return;
                // Põe e tira: alterna entre a casa sugerida e zero.
                definirCapo(capo.valor !== 0 ? 0 : capoInicial(window.__cifraSoanteHtml), true);
            });
```

- [ ] **Step 6: Tom e capo convivendo**

Nos dois listeners de tom (`increase-tom` e `decrease-tom`), o alvo da transposição passa a ser a cifra **soante**, não a exibida. Substituir o corpo dos dois pelo mesmo padrão, mudando só o sinal:

```js
            function transporTomSoante(passo) {
                if (window.__modoSomenteLetra) return;
                for (let tentativa = 0; tentativa < 12; tentativa += 1) {
                    const atual = window.__cifraSoanteHtml;
                    const tom = identificarTom(atual);
                    const transposta = transporCifraHtml(atual, passo);
                    const tomNovo = identificarTom(transposta);
                    if (tom === tomNovo) continue;

                    window.__cifraSoanteHtml = transposta;
                    window.__cifraOriginalHtml = transposta;
                    capo.tomSoante = tomNovo;
                    // Em automático a casa é recalculada para o tom novo; posta
                    // na mão, ela fica onde o músico deixou.
                    if (capo.automatico) capo.valor = capoInicial(transposta);
                    renderizarCifraComCapo();
                    setTomInfo('Tom ajustado manualmente: ' + tomNovo + ' | não é salvo no repertório automaticamente', 'waiting');
                    document.dispatchEvent(new CustomEvent('cifro:tom-changed', { detail: { tom: tomNovo } }));
                    break;
                }
            }

            increaseBtnTom.addEventListener('click', () => transporTomSoante(1));
            decreaseBtnTom.addEventListener('click', () => transporTomSoante(-1));
```

- [ ] **Step 7: Conferir no navegador**

Abrir uma música em Ré com um usuário `violao` + `basico`. Esperado: o indicador mostra `Tom: D` e ao lado `capotraste 2 · formas em C`, e a cifra na tela está em Dó. Clicar em **Capo** na barra rápida: volta para Ré na tela e o indicador de tom continua `D`. Aumentar o tom: vira `D#` e a casa é recalculada. Mexer no stepper e aumentar o tom de novo: a casa **não** é recalculada.

- [ ] **Step 8: Ponto de parada**

Arquivo: `music.php`.

---

### Task 10: Live publica o tom soante

**Files:**
- Modify: `public/src/js/live.js:150-168` (`currentPageState`)

**Interfaces:**
- Consumes: `cifraDiv.dataset.tomSoante` (Task 9).
- Produces: nada novo; corrige o que já existe.

Hoje o live monta a URL publicada lendo o **texto** do elemento `#tom`. Com o capotraste na tela, depender de um rótulo de interface fica frágil: o dataset é explícito e não muda de significado.

- [ ] **Step 1: Trocar a origem do tom**

Em `public/src/js/live.js`, dentro de `currentPageState()`, no ramo de `music.php`:

```js
            const id = params.get('id') || '';
            // O tom publicado é sempre o SOANTE. O capotraste/transpose de cada
            // aparelho é escolha pessoal e nunca trafega no live: host com capo 2
            // e seguidor sem capo tocam a mesma música, cada um com a sua forma.
            const cifraDiv = document.getElementById('song-cifra');
            const tomSoante = String(cifraDiv?.dataset.tomSoante || document.getElementById('tom')?.textContent || '').trim();
            const playlistTom = tomSoante || params.get('playlistTom') || '';
```

O resto da função fica igual.

- [ ] **Step 2: Conferir com dois navegadores**

Abrir a mesma música em dois perfis: um com preferência `basico` e instrumento `violao`, outro com `nunca`. Iniciar o live no primeiro. Esperado: os dois indicadores de **Tom** mostram o mesmo valor, e as cifras na tela estão em tons diferentes. Transpor o tom no host: o seguidor acompanha o tom soante e mantém o próprio capo.

- [ ] **Step 3: Ponto de parada**

Arquivo: `live.js`.

---

### Task 11: Testes de ponta a ponta e documentação

**Files:**
- Create: `tests/cifro/74-capotraste.spec.js` (74 é o próximo número livre; o último é `73-minha-banda.spec.js`)
- Modify: `docs/modelo-de-dados.md`, `docs/funcionalidades.md`, `docs/testes.md`, `backlog.md`

**Interfaces:**
- Consumes: tudo das tasks anteriores.

- [ ] **Step 1: Escrever o spec de ponta a ponta**

Criar `tests/cifro/74-capotraste.spec.js`. O padrão do diretório é `storageState` no arquivo de sessão e fixture criada pela própria API — copiado de `tests/cifro/03-music-view.spec.js:9-39`:

```js
/**
 * 74-capotraste.spec.js
 * Capotraste e transposição de instrumento: preferência do usuário, cadastro
 * da música, controles na tela e independência entre quem apresenta e quem
 * acompanha no modo live.
 */
import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';

test.use({ storageState: 'tests/.auth/user.json' });

// A cifra da fixture está em Ré e traz F#m e Bm: é o caso em que o nível
// básico do violão tem ganho real (capo 2 troca as duas por Dm e Am).
const CIFRA_FIXTURE = '<b>D A Bm G</b><br>letra da fixture<br><b>F#m Bm A D</b>';

async function getCsrf(page) {
  const response = await page.request.get('/api/csrf.php');
  const body = await response.json();
  return body.csrf_token || '';
}

async function musicaComPestana(page) {
  const response = await page.request.get('/api/sync/data.php');
  const data = await response.json();
  const existente = data.musicas?.find(item => item?.nome === '__CAPOTRASTE_FIXTURE__');
  if (existente?.id) return existente.id;

  const csrf = await getCsrf(page);
  const created = await page.request.post('/src/backend/editor/api.php', {
    data: JSON.stringify({
      nome: '__CAPOTRASTE_FIXTURE__',
      artista: 'Teste',
      cifra: CIFRA_FIXTURE,
      classificacao: '',
      bit: '',
      transposicao_instrumento: 0,
    }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  expect(created.ok()).toBeTruthy();
  const body = await created.json();
  expect(body.id).toBeTruthy();
  return body.id;
}

function esquecerPreferencia() {
  dbQuery(
    "UPDATE usuarios SET config = JSON_REMOVE(COALESCE(config,'{}'), '$.instrumento', '$.transposicaoPreferencia')"
  );
}

async function definirPreferencia(page, instrumento, preferencia) {
  await page.goto('/config.php');
  await page.selectOption('#cfgInstrumento', instrumento);
  await page.selectOption('#cfgTransposicaoPreferencia', preferencia);
  await expect(page.locator('#cfgTransposicaoPreferencia')).toHaveValue(preferencia);
}

test('o modal de primeiro acesso pergunta o instrumento e grava a preferência', async ({ page }) => {
  esquecerPreferencia();
  await page.goto('/index.php');
  await expect(page.locator('#capoSetupModal')).toBeVisible();
  await page.click('[data-capo-instrumento="violao"]');
  await expect(page.locator('#capoSetupModal [data-capo-termo]')).toHaveText('capotraste');
  await page.click('[data-capo-preferencia="basico"]');
  await expect(page.locator('#capoSetupModal')).toBeHidden();

  await page.reload();
  await expect(page.locator('#capoSetupModal')).toBeHidden();
});

test('decidir depois faz a pergunta voltar no acesso seguinte', async ({ page, context }) => {
  esquecerPreferencia();
  await page.goto('/index.php');
  await page.click('#capoSetupLater');
  await expect(page.locator('#capoSetupModal')).toBeHidden();

  const outraAba = await context.newPage();
  await outraAba.goto('/index.php');
  await expect(outraAba.locator('#capoSetupModal')).toBeVisible();
  await outraAba.close();
});

test('o indicador de tom mostra o tom soante e o capotraste aparece ao lado', async ({ page }) => {
  await definirPreferencia(page, 'violao', 'basico');
  await page.goto('/music.php?id=' + (await musicaComPestana(page)));
  await page.click('#menuButton');
  const tom = await page.locator('#tom').textContent();
  expect(tom.trim()).not.toBe('');
  await expect(page.locator('#capoLabel')).toHaveText('Capotraste');
});

test('pôr e tirar o capotraste não muda o tom soante exibido', async ({ page }) => {
  await definirPreferencia(page, 'violao', 'basico');
  await page.goto('/music.php?id=' + (await musicaComPestana(page)));
  const tomAntes = (await page.locator('#tom').textContent()).trim();

  await page.click('#menuButton');
  await page.click('#increase-capo');
  await expect(page.locator('#capoValor')).not.toHaveText('0');
  expect((await page.locator('#tom').textContent()).trim()).toBe(tomAntes);

  await page.click('#capoAutomatico');
  expect((await page.locator('#tom').textContent()).trim()).toBe(tomAntes);
});

test('quem nunca usa capotraste vê a cifra no tom original', async ({ page }) => {
  await definirPreferencia(page, 'violao', 'nunca');
  await page.goto('/music.php?id=' + (await musicaComPestana(page)));
  await page.click('#menuButton');
  await expect(page.locator('#capoValor')).toHaveText('0');
});
```

Os dois primeiros testes apagam a preferência do usuário de sessão, então rode este arquivo isolado ou deixe-o por último: rodando em paralelo com outros specs, o modal apareceria por cima deles.

- [ ] **Step 2: Rodar**

```bash
npx playwright test --project=cifro tests/cifro/74-capotraste.spec.js
```

Esperado: PASS nos cinco.

- [ ] **Step 3: Atualizar a documentação**

- `docs/modelo-de-dados.md`: acrescentar `transposicao_instrumento` ao conteúdo de `musicas` na tabela de entidades, e citar as duas chaves novas na seção "Campos JSON".
- `docs/funcionalidades.md`: uma seção curta descrevendo o conceito (o valor é neutro, o rótulo muda por instrumento) e as quatro preferências.
- `docs/testes.md`: registrar `tests/php/TransposicaoInstrumentoTest.php`, os testes novos de `tests/chords.test.js` e `tests/cifro/74-capotraste.spec.js`.
- `backlog.md`: no NOTE-001, anotar que o item "tom e capo preferidos" será atendido pela tabela `usuario_musica` da Etapa 3 deste trabalho.

- [ ] **Step 4: Suíte completa**

```bash
npm run test:unit
```

Esperado: PASS em PHP e JS. Rodar também o smoke de ponta a ponta:

```bash
npm run test:e2e:smoke
```

- [ ] **Step 5: Ponto de parada**

Etapa 1 completa. As Etapas 2 (import do CifraClub) e 3 (personalização por músico e conflito) ganham planos próprios.

---

## O que a execução ensinou

Anotado para quem for executar as Etapas 2 e 3:

- **As regras automáticas são mais espertas do que eu previa.** Si♭ no violão dá capo 3 (formas de Sol, zero acidentes), não capo 1; C G Am F no nível básico dá capo 5, tirando o F. Escrever a expectativa do teste "no olho" errou três vezes; conferir o resultado musicalmente antes de fixar o número.
- **O `create_tables.sql` é só baseline.** Coluna nova vai na migration e em lugar nenhum mais, porque `setup_e2e_db.php` aplica baseline e depois migrations.
- **Editar uma migration já aplicada trava o runner** com "checksum divergente". Se precisar corrigir o SQL depois de aplicar localmente, atualize a linha em `schema_migrations` ou crie outra migration.
- **Não suba servidor próprio na porta 8090** enquanto roda Playwright: ele reusa a porta e os testes passam a bater no banco de desenvolvimento em vez do de teste. Os sintomas são lentidão e falhas que não reproduzem.
- **A barra rápida vem oculta no desktop.** Para testar o botão de pôr e tirar, ligue `musicShowQuickBar` por `addInitScript` antes de navegar, em vez de caçar o switch dentro da gaveta.
- **A gaveta de ajustes entra deslizando.** Clicar num stepper logo após abrir o menu gera teste intermitente; espere o controle ficar visível.

## Etapas seguintes

Não estão neste plano, e cada uma recebe o seu quando esta for aceita:

- **Etapa 2 — Import do CifraClub:** extrair o capo também fora do `<pre>`, confirmar no preview, e a trava que compara o `Tom:` da página com o tom do corpo somado ao capo.
- **Etapa 3 — Personalização por músico:** tabela `usuario_musica`, endpoint de escrita, entrada no snapshot de sync e no IndexedDB, e a tela de pendências com resolução de conflito em três pontas.
