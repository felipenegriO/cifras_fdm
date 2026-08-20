# Clareza da funcionalidade de Categorias — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o usuário novo entender o que é categoria, como cadastrar e para que serve — sem alterar o modelo de dados.

**Architecture:** Oito tarefas independentes sobre código existente. Uma correção de servidor (nome equivalente não duplica), uma correção de comportamento na home (o chip passa a filtrar por categoria em vez de escrever na busca) e seis mudanças de apresentação: vocabulário, estado vazio com kits, contagem por linha, criação a partir do editor, checklist de configuração e artigo de ajuda. Nenhuma migração de banco.

**Tech Stack:** PHP 8 sem framework (views por `render_view`/`render_partial`, autoload por `spl_autoload_register` em `public/src/backend/bootstrap.php`), JavaScript sem build, PHPUnit 9.6 (`tests/php`), Playwright (`tests/cifro`, projeto `cifro`).

**Spec:** [docs/superpowers/specs/2026-08-19-categorias-clareza-design.md](../specs/2026-08-19-categorias-clareza-design.md)

## Global Constraints

- **Não commitar.** Ao fim de cada tarefa, pare e reporte o que mudou e o resultado dos testes. Quem commita é o Felipe.
- **O esquema do banco não muda.** Nada de migração, nada de coluna nova, nada de tabela nova. `musicas.classificacao` continua `VARCHAR(100)` com o **nome** da categoria.
- **Uma música tem no máximo uma categoria.**
- **Criar, renomear e excluir categoria continua restrito a gestor+** (`require_band_role('gestor')` em `public/src/backend/categorias/api.php`). Esconder botão nunca é autorização — a regra do servidor permanece intacta.
- **Nomes de teste em português de negócio.** Ex.: `testNomeEquivalenteNaoCriaCategoriaRepetida`, `'chip de categoria lista apenas músicas daquela categoria'`.
- **A home não muda visualmente.** Sem chip novo, sem layout novo. Só o resultado do clique é corrigido.
- **Textos de interface, exatos (copiar literalmente):**
  - Rótulo do campo no editor: `Categoria`
  - Opção vazia do campo: `Sem categoria`
  - Título do estado vazio: `Organize as músicas do seu jeito`
  - Texto do estado vazio: `Categoria é como sua banda agrupa as músicas. O critério é você que escolhe — comece por um destes:`
  - Rodapé do estado vazio: `Depois de criadas, elas viram filtros na tela inicial e uma opção no editor de cada música.`
  - Kits: `Pelo momento do culto` → Abertura, Adoração, Ministração, Encerramento · `Pelo estilo da música` → Lenta, Animada, Congregacional · `Pela ocasião` → Natal, Páscoa, Infantil
  - Aviso de permissão no editor: `Só gestores criam categorias novas.`
  - Banda sem categorias, gestor: `Sua banda ainda não tem categorias.` + link `Criar agora`
  - Banda sem categorias, músico: `Sua banda ainda não tem categorias.`
  - Item de criação no select: `+ Nova categoria…`

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `public/src/Views/editor/editor.php` | rótulo e opção vazia do campo | 1, 5 |
| `public/src/js/editor.js` | montagem do select, criação inline, avisos | 1, 5 |
| `public/src/Services/CategoriaDuplicadaException.php` | **novo** — conflito de nome equivalente carregando a categoria existente | 2 |
| `public/src/Repositories/CategoriaRepository.php` | normalização de nome, busca de equivalente, contagem | 2, 3, 7 |
| `public/src/backend/categorias/api.php` | traduzir o conflito para 409 com a categoria existente | 2 |
| `public/src/js/categorias.js` | lista com contagem, exclusão bloqueada, kits | 3, 4 |
| `public/src/Views/partials/banda/aba-categorias.php` | marcação do estado vazio e dos kits | 4 |
| `public/src/Views/index.php` | filtro de categoria separado da busca | 6 |
| `public/src/Controllers/BandaAdminController.php` | dados do checklist | 7 |
| `public/src/Services/BandaChecklistConfiguracao.php` | **novo** — regra pura de quais passos estão pendentes | 7 |
| `public/src/Views/banda/minha-banda.php` | bloco do checklist | 7 |
| `public/src/Services/HelpCenterService.php` | artigo `categorias` | 8 |

---

### Task 1: Vocabulário — "Categoria" e "Sem categoria"

**Files:**
- Modify: `public/src/Views/editor/editor.php:80-85`
- Modify: `public/src/js/editor.js:63`
- Test: `tests/cifro/25-categorias.spec.js:97-102`

**Interfaces:**
- Consumes: nada.
- Produces: o texto `Sem categoria` como primeira opção de `#classificacao` e o rótulo `Categoria`. As tarefas 5 e 6 assumem esses textos.

- [ ] **Step 1: Ajustar o teste existente para o vocabulário novo**

Em `tests/cifro/25-categorias.spec.js`, substitua o teste `exibe categorias cadastradas na home e no editor` inteiro por:

```javascript
test('exibe categorias cadastradas na home e no editor', async ({ page }) => {
  await page.goto('/index.php');
  await expect(page.locator('.filter-group .chip')).not.toHaveCount(0);

  await page.goto('/src/backend/editor/editor.php');
  await expect(page.locator('#classificacao option')).not.toHaveCount(0);
  await expect(page.locator('#classificacao option').first()).toHaveText('Sem categoria');
  await expect(page.locator('label[for="classificacao"]')).toContainText('Categoria');
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js -g "exibe categorias cadastradas"
```

Esperado: FALHA, com o texto recebido `Não classificada` onde se esperava `Sem categoria`.

- [ ] **Step 3: Trocar o rótulo e a opção na view**

Em `public/src/Views/editor/editor.php`, o bloco atual:

```php
          <label class="compact-field compact-field--classification" for="classificacao">
            <span>Classificação</span>
            <select id="classificacao">
              <option value="">Não classificada</option>
            </select>
          </label>
```

passa a ser:

```php
          <label class="compact-field compact-field--classification" for="classificacao">
            <span>Categoria</span>
            <select id="classificacao">
              <option value="">Sem categoria</option>
            </select>
          </label>
```

- [ ] **Step 4: Trocar o texto na remontagem do select**

Em `public/src/js/editor.js`, linha 63, dentro de `renderCategories()`:

```javascript
    elements.classification.replaceChildren(new Option('Sem categoria', ''));
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js -g "exibe categorias cadastradas"
```

Esperado: 1 passed.

- [ ] **Step 6: Parar e reportar** (sem commit — ver Global Constraints)

---

### Task 2: Nome equivalente não cria categoria repetida

Hoje o índice `UNIQUE (banda_id, nome)` é exato: "adoração" e "Adoração" viram duas categorias, e as músicas se dividem entre elas. O servidor passa a comparar ignorando caixa e acento.

**Files:**
- Create: `public/src/Services/CategoriaDuplicadaException.php`
- Modify: `public/src/Repositories/CategoriaRepository.php`
- Modify: `public/src/backend/categorias/api.php`
- Test: `tests/php/CategoriaRepositoryTest.php` (novo)

**Interfaces:**
- Consumes: `CategoriaRepository::save(array $categoria, string $bandaId): int` (existente).
- Produces:
  - `CategoriaRepository::normalizarNome(string $nome): string` — estático, minúsculas sem acento, espaços colapsados.
  - `CategoriaRepository::findEquivalente(string $nome, string $bandaId): ?array` — devolve `['id' => int, 'nome' => string]` ou `null`.
  - `CategoriaRepository::countByBanda(string $bandaId): int` — usado pela Task 7.
  - `CategoriaDuplicadaException::getCategoriaExistente(): array` — `['id' => int, 'nome' => string]`.
  - Resposta 409 da API com o campo `categoria` preenchido — consumido pelas tarefas 4 e 5.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/php/CategoriaRepositoryTest.php`:

```php
<?php

use PHPUnit\Framework\TestCase;

final class CategoriaRepositoryTest extends TestCase
{
    private PDO $pdo;
    private string $bandaId;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();

        $this->bandaId = 'categoria-banda-' . bin2hex(random_bytes(8));
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?,?,?)')
            ->execute([$this->bandaId, 'Banda das Categorias', 'mensal']);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) $this->pdo->rollBack();
    }

    public function testNomeEquivalenteNaoCriaCategoriaRepetida(): void
    {
        $repo = new CategoriaRepository();
        $idOriginal = $repo->save(['nome' => 'Adoração'], $this->bandaId);

        try {
            $repo->save(['nome' => 'adoracao'], $this->bandaId);
            self::fail('salvar nome equivalente deveria acusar duplicidade');
        } catch (CategoriaDuplicadaException $e) {
            self::assertSame($idOriginal, (int) $e->getCategoriaExistente()['id']);
            self::assertSame('Adoração', $e->getCategoriaExistente()['nome']);
        }

        self::assertSame(1, $repo->countByBanda($this->bandaId));
    }

    public function testNomeNovoContinuaSendoCriado(): void
    {
        $repo = new CategoriaRepository();
        $repo->save(['nome' => 'Adoração'], $this->bandaId);
        $repo->save(['nome' => 'Ministração'], $this->bandaId);

        self::assertSame(2, $repo->countByBanda($this->bandaId));
    }

    public function testRenomearParaOProprioNomeNaoAcusaDuplicidade(): void
    {
        $repo = new CategoriaRepository();
        $id = $repo->save(['nome' => 'Adoração'], $this->bandaId);

        self::assertSame($id, $repo->save(['id' => $id, 'nome' => 'ADORAÇÃO'], $this->bandaId));
    }

    public function testContagemDeMusicasPorCategoria(): void
    {
        $repo = new CategoriaRepository();
        $repo->save(['nome' => 'Adoração'], $this->bandaId);
        $insert = $this->pdo->prepare('INSERT INTO musicas (banda_id, nome, artista, classificacao) VALUES (?,?,?,?)');
        $insert->execute([$this->bandaId, 'Música A', 'Artista', 'Adoração']);
        $insert->execute([$this->bandaId, 'Música B', 'Artista', 'Adoração']);
        $insert->execute([$this->bandaId, 'Música C', 'Artista', '']);

        self::assertSame(1, $repo->countByBanda($this->bandaId));
    }
}
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm run test:unit:php -- --filter CategoriaRepositoryTest
```

Esperado: FALHA com `Error: Class "CategoriaDuplicadaException" not found` (ou `Call to undefined method CategoriaRepository::countByBanda`).

- [ ] **Step 3: Criar a exceção**

Crie `public/src/Services/CategoriaDuplicadaException.php`:

```php
<?php
/**
 * Nome equivalente a uma categoria que já existe na banda, ignorando caixa e
 * acento. Carrega a categoria existente para que a interface possa selecioná-la
 * em vez de insistir em criar uma segunda.
 */
class CategoriaDuplicadaException extends RuntimeException {
    private array $existente;

    public function __construct(array $existente) {
        parent::__construct('Já existe uma categoria com esse nome.');
        $this->existente = $existente;
    }

    /** @return array{id:int,nome:string} */
    public function getCategoriaExistente(): array {
        return ['id' => (int) $this->existente['id'], 'nome' => (string) $this->existente['nome']];
    }
}
```

- [ ] **Step 4: Implementar normalização, busca de equivalente e contagem**

Em `public/src/Repositories/CategoriaRepository.php`, acrescente à classe:

```php
    /**
     * Mapa explícito em vez de iconv//TRANSLIT: o resultado do TRANSLIT muda
     * conforme a biblioteca C do sistema, e a comparação precisa dar o mesmo
     * resultado no XAMPP do desenvolvimento e no servidor de produção.
     */
    private const ACENTOS = [
        'á'=>'a','à'=>'a','ã'=>'a','â'=>'a','ä'=>'a',
        'é'=>'e','è'=>'e','ê'=>'e','ë'=>'e',
        'í'=>'i','ì'=>'i','î'=>'i','ï'=>'i',
        'ó'=>'o','ò'=>'o','õ'=>'o','ô'=>'o','ö'=>'o',
        'ú'=>'u','ù'=>'u','û'=>'u','ü'=>'u',
        'ç'=>'c','ñ'=>'n',
    ];

    public static function normalizarNome(string $nome): string {
        $semEspacoDuplo = preg_replace('/\s+/u', ' ', trim($nome));
        return strtr(mb_strtolower($semEspacoDuplo, 'UTF-8'), self::ACENTOS);
    }

    /** @return array{id:int,nome:string}|null */
    public function findEquivalente(string $nome, string $bandaId, int $ignorarId = 0): ?array {
        $stmt = $this->pdo->prepare('SELECT id, nome FROM categorias WHERE banda_id = ?');
        $stmt->execute([$bandaId]);
        $alvo = self::normalizarNome($nome);
        foreach ($stmt->fetchAll() as $categoria) {
            if ((int) $categoria['id'] === $ignorarId) continue;
            if (self::normalizarNome((string) $categoria['nome']) === $alvo) {
                return ['id' => (int) $categoria['id'], 'nome' => (string) $categoria['nome']];
            }
        }
        return null;
    }

    public function countByBanda(string $bandaId): int {
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM categorias WHERE banda_id = ?');
        $stmt->execute([$bandaId]);
        return (int) $stmt->fetchColumn();
    }
```

Ainda em `save()`, a verificação entra nos dois caminhos. No caminho de **atualização**, logo depois de confirmar que a categoria existe (após o `if ($nomeAnterior === false) { ... }`):

```php
                $equivalente = $this->findEquivalente($nome, $bandaId, $id);
                if ($equivalente !== null) throw new CategoriaDuplicadaException($equivalente);
```

No caminho de **criação**, imediatamente antes do `INSERT`:

```php
        $equivalente = $this->findEquivalente($nome, $bandaId);
        if ($equivalente !== null) throw new CategoriaDuplicadaException($equivalente);

        $stmt = $this->pdo->prepare('INSERT INTO categorias (banda_id, nome) VALUES (?, ?)');
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
npm run test:unit:php -- --filter CategoriaRepositoryTest
```

Esperado: `OK (4 tests)`.

- [ ] **Step 6: Traduzir o conflito para 409 na API**

Em `public/src/backend/categorias/api.php`, acrescente um `catch` **antes** do `catch (PDOException $e)` (a ordem importa: `CategoriaDuplicadaException` estende `RuntimeException`, então precisa vir antes do `catch (RuntimeException $e)` também):

```php
} catch (CategoriaDuplicadaException $e) {
    http_response_code(409);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'categoria' => $e->getCategoriaExistente(),
    ], JSON_UNESCAPED_UNICODE);
}
```

- [ ] **Step 7: Escrever o teste de ponta a ponta do conflito**

Acrescente a `tests/cifro/25-categorias.spec.js`:

```javascript
test('nome equivalente com acento ou caixa diferente devolve a categoria existente', async ({ page }) => {
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
  const nome = `__EQUIV_Adoração_${Date.now()}__`;

  const first = await page.request.post(API, { headers, data: JSON.stringify({ nome }) });
  expect(first.status()).toBe(200);
  const created = await first.json();

  try {
    const equivalent = await page.request.post(API, {
      headers,
      data: JSON.stringify({ nome: nome.replace('Adoração', 'adoracao') }),
    });
    expect(equivalent.status()).toBe(409);
    const body = await equivalent.json();
    expect(body.categoria.id).toBe(created.id);
    expect(body.categoria.nome).toBe(nome);
  } finally {
    await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: created.id }) });
  }
});
```

- [ ] **Step 8: Rodar e confirmar que passa**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js
```

Esperado: todos os testes do arquivo passam, incluindo o pré-existente `nome duplicado retorna 409 e conflito de revisão retorna 409`.

- [ ] **Step 9: Parar e reportar**

---

### Task 3: Contagem de músicas por categoria e exclusão bloqueada com motivo visível

**Files:**
- Modify: `public/src/js/categorias.js`
- Modify: `public/src/Views/partials/banda/aba-categorias.php` (estilo da contagem)
- Test: `tests/cifro/25-categorias.spec.js`

**Interfaces:**
- Consumes: `window.songs` e `cifroSync.load(bandaId)` de `public/src/js/cifro-sync.js`; `CategoriaRepository::normalizarNome` reproduzida em JavaScript.
- Produces: `function contarMusicas(nome): number` e `function rotuloContagem(total): string` dentro de `categorias.js`. A Task 4 renderiza no mesmo arquivo.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `tests/cifro/25-categorias.spec.js`:

```javascript
test('lista de categorias mostra quantas músicas cada uma tem', async ({ page }) => {
  await page.goto('/minha-banda.php?aba=categorias');
  const primeira = page.locator('.category-row').first();
  await expect(primeira).toBeVisible();
  await expect(primeira.locator('.category-count')).toHaveText(/(\d+ músicas?|1 música|nenhuma música)/);
});

test('categoria em uso mostra o motivo antes de tentar excluir', async ({ page }) => {
  const marcador = `__EM_USO_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
  const criada = await (await page.request.post(API, { headers, data: JSON.stringify({ nome: marcador }) })).json();

  try {
    // Uma música fictícia com essa categoria, injetada no payload de sync: o
    // teste mede a interface, não o cadastro real de músicas.
    await page.route('**/api/sync/data.php', async route => {
      const response = await route.fetch();
      const body = await response.json();
      body.musicas = [{ id: 90003, nome: 'Música do teste', artista: 'Teste', classificacao: marcador, cifra: 'C', bit: '' }];
      return route.fulfill({ response, body: JSON.stringify(body) });
    });

    await page.goto('/minha-banda.php?aba=categorias');
    const linha = page.locator('.category-row', { hasText: marcador });
    await expect(linha.locator('.category-count')).toHaveText('1 música');
    await expect(linha.getByRole('button', { name: 'Excluir' })).toBeDisabled();

    await page.unroute('**/api/sync/data.php');
  } finally {
    await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: criada.id }) });
  }
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js -g "quantas músicas|motivo antes de tentar excluir"
```

Esperado: FALHA — `.category-count` não existe.

- [ ] **Step 3: Contar as músicas no cliente**

Em `public/src/js/categorias.js`, acrescente logo abaixo da declaração `let categories = [];`:

```javascript
  const ACENTOS = { 'á':'a','à':'a','ã':'a','â':'a','ä':'a','é':'e','è':'e','ê':'e','ë':'e','í':'i','ì':'i','î':'i','ï':'i','ó':'o','ò':'o','õ':'o','ô':'o','ö':'o','ú':'u','ù':'u','û':'u','ü':'u','ç':'c','ñ':'n' };

  // Mesma regra do servidor (CategoriaRepository::normalizarNome): a contagem
  // precisa casar com o que o back-end considera a mesma categoria.
  function normalizarNome(nome) {
    return String(nome || '').trim().replace(/\s+/g, ' ').toLowerCase()
      .replace(/[áàãâäéèêëíìîïóòõôöúùûüçñ]/g, letra => ACENTOS[letra] || letra);
  }

  function contarMusicas(nome) {
    const alvo = normalizarNome(nome);
    const musicas = Array.isArray(window.songs) ? window.songs : [];
    return musicas.filter(musica => normalizarNome(musica.classificacao) === alvo).length;
  }

  function rotuloContagem(total) {
    if (total === 0) return 'nenhuma música';
    return total === 1 ? '1 música' : total + ' músicas';
  }
```

- [ ] **Step 4: Renderizar a contagem e travar a exclusão**

Em `render()`, dentro do `categories.forEach`, logo depois de `name.textContent = category.nome;`, acrescente:

```javascript
      const total = contarMusicas(category.nome);
      const count = document.createElement('span');
      count.className = 'category-count';
      count.textContent = rotuloContagem(total);
```

e substitua a criação do botão de excluir por:

```javascript
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--danger';
      remove.textContent = 'Excluir';
      if (total > 0) {
        remove.disabled = true;
        remove.title = category.nome + ' está em uso por ' + rotuloContagem(total) + '.';
        remove.setAttribute('aria-label', 'Excluir ' + category.nome + ' — em uso por ' + rotuloContagem(total));
      } else {
        remove.addEventListener('click', () => deleteCategory(category));
      }
```

e troque a montagem da linha para incluir a contagem:

```javascript
      row.append(name, count, actions);
```

- [ ] **Step 5: Garantir que `window.songs` está carregado antes de renderizar**

Em `load()`, antes do `const data = await request();`:

```javascript
      await cifroSync.load(window.CIFRO_BAND_ID);
```

- [ ] **Step 6: Dar estilo à contagem**

Em `public/src/Views/partials/banda/aba-categorias.php`, dentro do `<style>`, acrescente:

```css
  .category-count { flex: 0 0 auto; font-size: var(--text-sm); color: var(--text-2); white-space: nowrap; }
  .category-row .btn[disabled] { opacity: .5; cursor: not-allowed; }
```

E replique as mesmas duas regras no `<style>` de `public/src/Views/categorias.php`, que compartilha o mesmo JavaScript.

- [ ] **Step 7: Rodar e confirmar que passa**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js
```

Esperado: todos passam. Atenção ao teste pré-existente `cancela edição e cancela exclusão sem remover` — ele cria uma categoria nova (sem músicas), então o botão continua habilitado e ele deve seguir passando sem alteração.

- [ ] **Step 8: Parar e reportar**

---

### Task 4: Estado vazio da aba Categorias com os três kits

**Files:**
- Modify: `public/src/Views/partials/banda/aba-categorias.php`
- Modify: `public/src/js/categorias.js`
- Test: `tests/cifro/25-categorias.spec.js`

**Interfaces:**
- Consumes: `request(payload)` e `load()` de `categorias.js`; resposta 409 com `categoria` da Task 2.
- Produces: `async function aplicarKit(nomes)` — cria os nomes em sequência, encadeando `content_revision`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `tests/cifro/25-categorias.spec.js`:

```javascript
test('banda sem categorias vê os três kits de exemplo', async ({ page }) => {
  await page.route('**/src/backend/categorias/api.php', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, categorias: [] }) });
    }
    return route.continue();
  });

  await page.goto('/minha-banda.php?aba=categorias');
  await expect(page.getByText('Organize as músicas do seu jeito')).toBeVisible();
  await expect(page.locator('.category-kit')).toHaveCount(3);
  await expect(page.getByText('Pelo momento do culto')).toBeVisible();
  await expect(page.getByText('Depois de criadas, elas viram filtros na tela inicial e uma opção no editor de cada música.')).toBeVisible();

  await page.unroute('**/src/backend/categorias/api.php');
});

test('aplicar um kit cria todas as categorias do conjunto', async ({ page }) => {
  const sufixo = Date.now();
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
  const criadas = [];

  await page.route('**/src/backend/categorias/api.php', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, categorias: [] }) });
    }
    return route.continue();
  });

  try {
    await page.goto('/minha-banda.php?aba=categorias');
    await page.locator('.category-kit', { hasText: 'Pelo estilo da música' }).getByRole('button').click();
    await expect(page.locator('.cifro-toast, .toast')).toContainText('categorias criadas');

    await page.unroute('**/src/backend/categorias/api.php');
    const lista = await (await page.request.get(API)).json();
    for (const nome of ['Lenta', 'Animada', 'Congregacional']) {
      const encontrada = lista.categorias.find(item => item.nome === nome);
      expect(encontrada, `categoria ${nome} deveria existir`).toBeTruthy();
      criadas.push(encontrada.id);
    }
  } finally {
    for (const id of criadas) {
      await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id }) });
    }
  }
});
```

Se a banda de teste já tiver `Lenta`, `Animada` ou `Congregacional`, o segundo teste ainda passa: o kit pula equivalentes e a categoria pré-existente é encontrada na lista. O `finally` só apaga o que a lista devolveu — categorias em uso por músicas voltarão erro de exclusão, o que não falha o teste porque a resposta não é verificada.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js -g "kits de exemplo|aplicar um kit"
```

Esperado: FALHA — o texto `Organize as músicas do seu jeito` não existe.

- [ ] **Step 3: Marcação e estilo do estado vazio**

Em `public/src/Views/partials/banda/aba-categorias.php`, acrescente ao `<style>`:

```css
  .category-onboarding { border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--bg-1); padding: var(--space-5); margin-bottom: var(--space-4); }
  .category-onboarding h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .category-onboarding p { margin: 0 0 var(--space-4); color: var(--text-2); font-size: var(--text-sm); line-height: 1.5; }
  .category-kit { border: 1px solid var(--border-1); border-radius: var(--radius-sm); padding: var(--space-3); margin-bottom: var(--space-3); }
  .category-kit__title { font-weight: var(--fw-medium); font-size: var(--text-sm); margin-bottom: var(--space-2); }
  .category-kit__chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
  .category-kit__chip { font-size: var(--text-xs); padding: 2px var(--space-2); border-radius: 999px; border: 1px solid var(--border-1); color: var(--text-2); }
  .category-onboarding__foot { margin: var(--space-4) 0 0; font-size: var(--text-xs); }
```

E, logo antes do `<form class="category-form" ...>`, acrescente o contêiner que o JavaScript preenche:

```php
<div id="categoryOnboarding" hidden></div>
```

Replique as mesmas adições em `public/src/Views/categorias.php` (mesmo `<style>` e o mesmo `<div>` antes do formulário), já que as duas telas compartilham `categorias.js`.

- [ ] **Step 4: Renderizar os kits e aplicá-los**

Em `public/src/js/categorias.js`, acrescente depois de `rotuloContagem`:

```javascript
  const onboarding = document.getElementById('categoryOnboarding');
  const KITS = [
    { titulo: 'Pelo momento do culto', nomes: ['Abertura', 'Adoração', 'Ministração', 'Encerramento'] },
    { titulo: 'Pelo estilo da música', nomes: ['Lenta', 'Animada', 'Congregacional'] },
    { titulo: 'Pela ocasião', nomes: ['Natal', 'Páscoa', 'Infantil'] }
  ];

  function renderOnboarding() {
    if (!onboarding) return;
    onboarding.hidden = categories.length > 0;
    if (categories.length > 0) { onboarding.replaceChildren(); return; }

    const caixa = document.createElement('div');
    caixa.className = 'category-onboarding';

    const titulo = document.createElement('h2');
    titulo.textContent = 'Organize as músicas do seu jeito';
    const texto = document.createElement('p');
    texto.textContent = 'Categoria é como sua banda agrupa as músicas. O critério é você que escolhe — comece por um destes:';
    caixa.append(titulo, texto);

    KITS.forEach(kit => {
      const bloco = document.createElement('div');
      bloco.className = 'category-kit';
      const nome = document.createElement('div');
      nome.className = 'category-kit__title';
      nome.textContent = kit.titulo;
      const chips = document.createElement('div');
      chips.className = 'category-kit__chips';
      kit.nomes.forEach(item => {
        const chip = document.createElement('span');
        chip.className = 'category-kit__chip';
        chip.textContent = item;
        chips.appendChild(chip);
      });
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'btn btn--primary';
      botao.textContent = 'Usar estas ' + kit.nomes.length;
      botao.addEventListener('click', () => aplicarKit(kit.nomes, botao));
      bloco.append(nome, chips, botao);
      caixa.appendChild(bloco);
    });

    // O formulário livre já existe logo abaixo deste bloco na marcação; esta
    // linha é só a costura entre os kits e ele.
    const livre = document.createElement('p');
    livre.className = 'category-onboarding__foot';
    livre.textContent = 'Ou crie a sua no campo abaixo.';
    const rodape = document.createElement('p');
    rodape.className = 'category-onboarding__foot';
    rodape.textContent = 'Depois de criadas, elas viram filtros na tela inicial e uma opção no editor de cada música.';
    caixa.append(livre, rodape);

    onboarding.replaceChildren(caixa);
  }

  // Cria em sequência: cada resposta devolve a revisão nova, que precisa ir na
  // chamada seguinte. Nome equivalente a um que já existe é pulado (409), não
  // interrompe o kit.
  async function aplicarKit(nomes, botao) {
    botao.disabled = true;
    let criadas = 0;
    try {
      for (const nome of nomes) {
        try {
          await request({ nome });
          criadas += 1;
        } catch (error) {
          if (!error.jaExiste) throw error;
        }
      }
      await cifroSync.sync(window.CIFRO_BAND_ID, { force: true });
      await load();
      if (window.cifroToast) cifroToast(criadas + ' categorias criadas.', 'success');
    } catch (error) {
      await load();
      if (window.cifroToast) cifroToast(error.message, 'error');
    } finally {
      botao.disabled = false;
    }
  }
```

- [ ] **Step 5: Marcar o erro de duplicidade para o kit poder pular**

Ainda em `categorias.js`, em `request()`, substitua a linha do `throw`:

```javascript
    if (!response.ok || !data.ok) {
      const erro = new Error(data.error || 'Não foi possível concluir a operação.');
      erro.jaExiste = response.status === 409 && !!data.categoria;
      erro.categoria = data.categoria || null;
      throw erro;
    }
```

- [ ] **Step 6: Chamar a renderização do estado vazio**

Em `render()`, na primeira linha do corpo da função:

```javascript
    renderOnboarding();
```

O bloco `if (!categories.length)` que hoje escreve `Nenhuma categoria cadastrada.` permanece — ele passa a ser a linha discreta abaixo do onboarding, não a tela inteira.

- [ ] **Step 7: Rodar e confirmar que passa**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js
```

Esperado: todos passam, incluindo o pré-existente `exibe mensagem de lista vazia e trata falha ao carregar/salvar`.

- [ ] **Step 8: Parar e reportar**

---

### Task 5: Criar categoria a partir do editor e explicar quem pode

**Files:**
- Modify: `public/src/Views/editor/editor.php`
- Modify: `public/src/js/editor.js`
- Test: `tests/cifro/25-categorias.spec.js`

**Interfaces:**
- Consumes: `window.CIFRO_PODE_EDITAR_CONTEUDO` (novo, exposto pela view); resposta 409 com `categoria` da Task 2.
- Produces: nada consumido por tarefas seguintes.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `tests/cifro/25-categorias.spec.js`:

```javascript
test('gestor cria categoria sem sair do editor', async ({ page }) => {
  const nome = `__EDITOR_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  try {
    await page.goto('/src/backend/editor/editor.php');
    await page.locator('#classificacao').selectOption({ label: '+ Nova categoria…' });
    await page.locator('#novaCategoriaNome').fill(nome);
    await page.getByRole('button', { name: 'Criar categoria' }).click();

    await expect(page.locator('#classificacao')).toHaveValue(nome);
  } finally {
    const lista = await (await page.request.get(API)).json();
    const criada = (lista.categorias || []).find(item => item.nome === nome);
    if (criada) await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: criada.id }) });
  }
});

test('banda sem categorias explica o que fazer no editor', async ({ page }) => {
  await page.addInitScript(() => { window.__FORCAR_SEM_CATEGORIAS__ = true; });
  await page.route('**/api/sync/data.php', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.categorias = [];
    return route.fulfill({ response, body: JSON.stringify(body) });
  });

  await page.goto('/src/backend/editor/editor.php');
  await expect(page.locator('#categoriaAviso')).toContainText('Sua banda ainda não tem categorias.');

  await page.unroute('**/api/sync/data.php');
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js -g "sem sair do editor|explica o que fazer no editor"
```

Esperado: FALHA — a opção `+ Nova categoria…` não existe.

- [ ] **Step 3: Expor o papel e os elementos novos na view**

Em `public/src/Views/editor/editor.php`, o bloco do campo (já ajustado na Task 1) passa a ser:

```php
          <label class="compact-field compact-field--classification" for="classificacao">
            <span>Categoria</span>
            <select id="classificacao">
              <option value="">Sem categoria</option>
            </select>
            <small id="categoriaAviso" aria-live="polite" hidden></small>
            <span id="novaCategoriaCampo" hidden>
              <input id="novaCategoriaNome" type="text" maxlength="100" placeholder="Nome da categoria" autocomplete="off">
              <button type="button" class="btn btn--secondary" id="novaCategoriaSalvar">Criar categoria</button>
            </span>
          </label>
```

E, junto das outras globais já definidas na view (`window.CIFRO_USER_ID`, `window.CIFRO_BAND_ID`), acrescente:

```php
<script>window.CIFRO_PODE_EDITAR_CONTEUDO = <?= can_edit_content() ? 'true' : 'false' ?>;</script>
```

A flag é só para a interface. A autorização real continua em `require_band_role('gestor')` dentro de `public/src/backend/categorias/api.php`.

- [ ] **Step 4: Montar a opção de criar e os avisos**

Em `public/src/js/editor.js`, acrescente aos `elements` (junto de `classification`):

```javascript
    categoriaAviso: document.getElementById('categoriaAviso'),
    novaCategoriaCampo: document.getElementById('novaCategoriaCampo'),
    novaCategoriaNome: document.getElementById('novaCategoriaNome'),
    novaCategoriaSalvar: document.getElementById('novaCategoriaSalvar'),
```

E substitua `renderCategories()` inteira por:

```javascript
  const NOVA_CATEGORIA = '__nova__';

  function podeCriarCategoria() {
    return window.CIFRO_PODE_EDITAR_CONTEUDO === true;
  }

  function renderCategories() {
    const selected = elements.classification.value;
    const categorias = Array.isArray(window.categorias) ? window.categorias : [];
    elements.classification.replaceChildren(new Option('Sem categoria', ''));
    categorias.forEach(category => {
      elements.classification.add(new Option(category.nome, category.nome));
    });
    if (podeCriarCategoria()) {
      elements.classification.add(new Option('+ Nova categoria…', NOVA_CATEGORIA));
    }
    elements.classification.value = selected === NOVA_CATEGORIA ? '' : selected;
    renderCategoriaAviso(categorias.length);
  }

  function renderCategoriaAviso(total) {
    const aviso = elements.categoriaAviso;
    if (!aviso) return;
    aviso.replaceChildren();
    if (total > 0) {
      if (!podeCriarCategoria()) aviso.textContent = 'Só gestores criam categorias novas.';
      aviso.hidden = !aviso.textContent;
      return;
    }
    aviso.append(document.createTextNode('Sua banda ainda não tem categorias.'));
    if (podeCriarCategoria()) {
      const link = document.createElement('a');
      link.href = (window.APP_BASE || '') + '/minha-banda.php?aba=categorias';
      link.textContent = 'Criar agora';
      aviso.append(document.createTextNode(' '), link);
    }
    aviso.hidden = false;
  }

  function abrirCampoNovaCategoria() {
    elements.novaCategoriaCampo.hidden = false;
    elements.novaCategoriaNome.value = '';
    elements.novaCategoriaNome.focus();
  }

  async function criarCategoria() {
    const nome = elements.novaCategoriaNome.value.trim();
    if (!nome) return;
    const api = (window.APP_BASE || '') + '/src/backend/categorias/api.php';
    elements.novaCategoriaSalvar.disabled = true;
    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      });
      const data = await response.json().catch(() => ({}));
      // 409 com categoria significa que já existe uma equivalente: seleciona a
      // que existe em vez de insistir em criar uma segunda.
      if (!response.ok && !(response.status === 409 && data.categoria)) {
        throw new Error(data.error || 'Não foi possível criar a categoria.');
      }
      const criada = data.categoria || { nome };
      await cifroSync.sync(window.CIFRO_BAND_ID, { force: true });
      renderCategories();
      elements.classification.value = criada.nome;
      elements.novaCategoriaCampo.hidden = true;
      if (window.cifroToast) cifroToast('Categoria "' + criada.nome + '" selecionada.', 'success');
    } catch (error) {
      if (window.cifroToast) cifroToast(error.message, 'error');
    } finally {
      elements.novaCategoriaSalvar.disabled = false;
    }
  }

  elements.classification.addEventListener('change', () => {
    if (elements.classification.value === NOVA_CATEGORIA) abrirCampoNovaCategoria();
    else elements.novaCategoriaCampo.hidden = true;
  });
  elements.novaCategoriaSalvar.addEventListener('click', criarCategoria);
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js
```

Esperado: todos passam.

- [ ] **Step 6: Conferir que o editor continua salvando a música**

```bash
npx playwright test --project=cifro tests/cifro/04-editor-musicas.spec.js
```

Esperado: todos passam. Se algum teste selecionava `#classificacao` por índice, ajuste-o para selecionar por rótulo — o item `+ Nova categoria…` entrou no fim da lista para gestores.

- [ ] **Step 7: Parar e reportar**

---

### Task 6: O chip da home passa a filtrar por categoria

**Files:**
- Modify: `public/src/Views/index.php:496-510` e `:576-586`
- Test: `tests/cifro/25-categorias.spec.js`

**Interfaces:**
- Consumes: `window.categorias` e `window.songs` de `cifro-sync.js`.
- Produces: nada consumido por tarefas seguintes.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `tests/cifro/25-categorias.spec.js`:

```javascript
test('chip de categoria lista apenas músicas daquela categoria', async ({ page }) => {
  const marcador = `__CHIP_${Date.now()}__`;
  const csrfResponse = await page.request.get('/api/csrf.php');
  const { csrf_token: csrf } = await csrfResponse.json();
  const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

  const criada = await (await page.request.post(API, { headers, data: JSON.stringify({ nome: marcador }) })).json();

  try {
    await page.route('**/api/sync/data.php', async route => {
      const response = await route.fetch();
      const body = await response.json();
      body.musicas = [
        { id: 90001, nome: 'Dentro da categoria', artista: 'Teste', classificacao: marcador, cifra: 'C G', bit: '' },
        { id: 90002, nome: 'Fora da categoria', artista: 'Teste', classificacao: '', cifra: 'letra com ' + marcador, bit: '' }
      ];
      body.categorias = [{ id: criada.id, nome: marcador }];
      return route.fulfill({ response, body: JSON.stringify(body) });
    });

    await page.goto('/index.php');
    await page.locator('.filter-group .chip', { hasText: marcador }).click();

    await expect(page.locator('#music-list')).toContainText('Dentro da categoria');
    await expect(page.locator('#music-list')).not.toContainText('Fora da categoria');
    await expect(page.locator('#search')).toHaveValue('');

    await page.locator('.filter-group .chip', { hasText: 'Todas' }).click();
    await expect(page.locator('#music-list')).toContainText('Fora da categoria');

    await page.unroute('**/api/sync/data.php');
  } finally {
    await page.request.post(API, { headers, data: JSON.stringify({ action: 'delete', id: criada.id }) });
  }
});
```

A música `Fora da categoria` carrega o marcador **dentro da cifra**: é exatamente o falso positivo que o comportamento atual produz.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js -g "chip de categoria lista apenas"
```

Esperado: FALHA — `Fora da categoria` aparece na lista e `#search` está preenchido com o marcador.

- [ ] **Step 3: Separar o filtro de categoria do texto de busca**

Em `public/src/Views/index.php`, substitua as funções `aplicarFiltro` e `marcarChipAtivo` (bloco atual das linhas 496-510) por:

```javascript
        var categoriaAtiva = '';

        function normalizarCategoria(valor) {
            return normalizeString(String(valor || '').trim());
        }

        function aplicarFiltro(classificacao) {
            categoriaAtiva = String(classificacao || '');
            sessionStorage.setItem('cifroHomeCategory', categoriaAtiva);
            marcarChipAtivo(categoriaAtiva);
            renderList($("#search").val() || '');
        }

        function marcarChipAtivo(classificacao) {
            document.querySelectorAll('.filter-group .chip').forEach(function (el) {
                el.classList.remove('chip--active');
            });
            var alvo = classificacao === '' ? 'Todas' : classificacao;
            var target = Array.from(document.querySelectorAll('.filter-group .chip')).find(function (el) {
                return el.textContent.trim().localeCompare(alvo, 'pt-BR', { sensitivity: 'base' }) === 0;
            });
            if (target) target.classList.add('chip--active');
        }
```

- [ ] **Step 4: Combinar categoria e texto na filtragem**

Ainda em `public/src/Views/index.php`, dentro de `renderList`, substitua o `songs.filter(...)` por:

```javascript
                var alvoCategoria = normalizarCategoria(categoriaAtiva);
                const filteredSongs = songs.filter(song => {
                    const casaTexto =
                        normalizeString(song.nome || '').includes(normalizedFilter) ||
                        normalizeString(song.artista || '').includes(normalizedFilter) ||
                        normalizeString(song.classificacao || '').includes(normalizedFilter) ||
                        normalizeString(song.cifra || '').includes(normalizedFilter);
                    const casaCategoria =
                        alvoCategoria === '' || normalizarCategoria(song.classificacao) === alvoCategoria;
                    return casaTexto && casaCategoria;
                });
```

- [ ] **Step 5: Restaurar a categoria guardada ao abrir a home**

Em `renderCategoryFilters()`, depois de montar os chips (no fim da função), acrescente:

```javascript
            marcarChipAtivo(categoriaAtiva || sessionStorage.getItem('cifroHomeCategory') || '');
```

E no `$(document).ready`, logo após `await cifroSync.load(window.CIFRO_BAND_ID);`:

```javascript
            categoriaAtiva = sessionStorage.getItem('cifroHomeCategory') || '';
```

- [ ] **Step 6: Rodar e confirmar que passa**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js -g "chip de categoria lista apenas"
```

Esperado: 1 passed.

- [ ] **Step 7: Conferir que a home não regrediu**

```bash
npx playwright test --project=cifro tests/cifro/02-home-cifras.spec.js
```

Esperado: todos passam.

- [ ] **Step 8: Parar e reportar**

---

### Task 7: Checklist "Configure sua banda"

**Files:**
- Create: `public/src/Services/BandaChecklistConfiguracao.php`
- Modify: `public/src/Controllers/BandaAdminController.php`
- Modify: `public/src/Views/banda/minha-banda.php`
- Test: `tests/php/BandaChecklistConfiguracaoTest.php` (novo), `tests/cifro/25-categorias.spec.js`

**Interfaces:**
- Consumes: `UserRepository::countByBanda`, `PlaylistRepository::countByBanda`, `CategoriaRepository::countByBanda` (criada na Task 2).
- Produces: `BandaChecklistConfiguracao::passos(int $membros, int $categorias, int $repertorios): array` — lista de `['id'=>string,'rotulo'=>string,'aba'=>string,'concluido'=>bool]`; e `::concluido(...)`: `bool`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/php/BandaChecklistConfiguracaoTest.php`:

```php
<?php

use PHPUnit\Framework\TestCase;

final class BandaChecklistConfiguracaoTest extends TestCase
{
    public function testBandaRecemCriadaTemOsTresPassosPendentes(): void
    {
        $passos = BandaChecklistConfiguracao::passos(1, 0, 0);

        self::assertCount(3, $passos);
        foreach ($passos as $passo) self::assertFalse($passo['concluido']);
        self::assertSame(['membros', 'categorias', 'repertorios'], array_column($passos, 'id'));
        self::assertFalse(BandaChecklistConfiguracao::concluido(1, 0, 0));
    }

    public function testCriarCategoriaConcluiApenasOPassoDeCategorias(): void
    {
        $passos = array_column(BandaChecklistConfiguracao::passos(1, 2, 0), 'concluido', 'id');

        self::assertTrue($passos['categorias']);
        self::assertFalse($passos['membros']);
        self::assertFalse($passos['repertorios']);
    }

    public function testBandaComMembroCategoriaERepertorioEstaConcluida(): void
    {
        self::assertTrue(BandaChecklistConfiguracao::concluido(2, 1, 1));
    }

    public function testCadaPassoApontaParaSuaAba(): void
    {
        $abas = array_column(BandaChecklistConfiguracao::passos(1, 0, 0), 'aba', 'id');

        self::assertSame(BandaAdminTabs::MEMBROS, $abas['membros']);
        self::assertSame(BandaAdminTabs::CATEGORIAS, $abas['categorias']);
        self::assertSame(BandaAdminTabs::REPERTORIOS, $abas['repertorios']);
    }
}
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm run test:unit:php -- --filter BandaChecklistConfiguracaoTest
```

Esperado: FALHA com `Class "BandaChecklistConfiguracao" not found`.

- [ ] **Step 3: Implementar a regra**

Crie `public/src/Services/BandaChecklistConfiguracao.php`:

```php
<?php
/**
 * BandaChecklistConfiguracao — o que ainda falta configurar numa banda.
 *
 * Regra pura, sem HTTP e sem banco: quem chama traz as contagens. Assim a
 * decisão de "o que está pendente" fica testável sem browser, no mesmo espírito
 * de BandaAdminTabs.
 *
 * Alcance conhecido: o checklist vive na tela Minha Banda, então só é visto por
 * quem entra lá. O músico que usa apenas a Home não o encontra — decisão
 * registrada no design de 2026-08-19.
 */
class BandaChecklistConfiguracao
{
    /** @return list<array{id:string,rotulo:string,aba:string,concluido:bool}> */
    public static function passos(int $membros, int $categorias, int $repertorios): array
    {
        return [
            ['id' => 'membros',     'rotulo' => 'Convidar músicos',           'aba' => BandaAdminTabs::MEMBROS,     'concluido' => $membros > 1],
            ['id' => 'categorias',  'rotulo' => 'Criar categorias',           'aba' => BandaAdminTabs::CATEGORIAS,  'concluido' => $categorias > 0],
            ['id' => 'repertorios', 'rotulo' => 'Montar o primeiro repertório', 'aba' => BandaAdminTabs::REPERTORIOS, 'concluido' => $repertorios > 0],
        ];
    }

    public static function concluido(int $membros, int $categorias, int $repertorios): bool
    {
        foreach (self::passos($membros, $categorias, $repertorios) as $passo) {
            if (!$passo['concluido']) return false;
        }
        return true;
    }
}
```

`BandaAdminTabs` já vive em `public/src/Services/BandaAdminTabs.php`, o mesmo diretório do arquivo novo, e é resolvido pelo `spl_autoload_register` de `public/src/backend/bootstrap.php` e pelo de `tests/php/bootstrap.php`. Nada a registrar.

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm run test:unit:php -- --filter BandaChecklistConfiguracaoTest
```

Esperado: `OK (4 tests)`.

- [ ] **Step 5: Levar as contagens para a view**

Em `public/src/Controllers/BandaAdminController.php`, dentro de `show()`, antes do `render_view`:

```php
        $bandaId      = current_band_id();
        $membros      = (new UserRepository())->countByBanda($bandaId);
        $categorias   = (new CategoriaRepository())->countByBanda($bandaId);
        $repertorios  = (new PlaylistRepository())->countByBanda($bandaId);
        $checklist    = BandaChecklistConfiguracao::concluido($membros, $categorias, $repertorios)
            ? []
            : BandaChecklistConfiguracao::passos($membros, $categorias, $repertorios);
```

e acrescente `'checklist' => $checklist,` ao array passado para `render_view('banda/minha-banda', [...])`.

- [ ] **Step 6: Desenhar o bloco na view**

Em `public/src/Views/banda/minha-banda.php`, acrescente ao `<style>`:

```css
    .mb-checklist { border: 1px solid var(--border-1); border-radius: var(--radius-md); background: var(--bg-1); padding: var(--space-4); margin-bottom: var(--space-5); }
    .mb-checklist h2 { margin: 0 0 var(--space-3); font-size: var(--text-base); }
    .mb-checklist ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .mb-checklist li { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); }
    .mb-checklist li[data-concluido="1"] { color: var(--text-2); }
```

E, logo depois de `<p class="mb-banda">...</p>` e antes de `<nav class="mb-abas" ...>`:

```php
    <?php if (!empty($checklist)): ?>
      <section class="mb-checklist" aria-label="Configuração da banda">
        <h2>Configure sua banda</h2>
        <ul>
          <?php foreach ($checklist as $passo): ?>
            <li data-concluido="<?= $passo['concluido'] ? '1' : '0' ?>" data-passo="<?= e($passo['id']) ?>">
              <span aria-hidden="true"><?= $passo['concluido'] ? '✓' : '○' ?></span>
              <?php if ($passo['concluido']): ?>
                <span><?= e($passo['rotulo']) ?></span>
              <?php else: ?>
                <a href="<?= e(base_url('/minha-banda.php?aba=' . $passo['aba'])) ?>"><?= e($passo['rotulo']) ?></a>
              <?php endif; ?>
            </li>
          <?php endforeach; ?>
        </ul>
      </section>
    <?php endif; ?>
```

O bloco só aparece para quem chega à Minha Banda, que já exige gestor+ (`BandaAdminController::show()` nega acesso quando não há aba visível). Não é preciso checar papel de novo aqui.

- [ ] **Step 7: Escrever o teste de tela**

Acrescente a `tests/cifro/25-categorias.spec.js`:

```javascript
test('checklist da banda aponta para a aba de categorias quando não há nenhuma', async ({ page }) => {
  await page.goto('/minha-banda.php?aba=categorias');
  const checklist = page.locator('.mb-checklist');
  if (await checklist.count() === 0) test.skip(true, 'banda de teste já está configurada');
  await expect(checklist.getByText('Configure sua banda')).toBeVisible();
  await expect(checklist.locator('li[data-passo="categorias"]')).toBeVisible();
});
```

- [ ] **Step 8: Rodar e confirmar que passa**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js -g "checklist da banda"
```

Esperado: 1 passed ou 1 skipped (banda de teste já configurada).

- [ ] **Step 9: Conferir que a Minha Banda não regrediu**

```bash
npm run test:unit:php -- --filter BandaAdminTabsTest
```

Esperado: todos passam.

- [ ] **Step 10: Parar e reportar**

---

### Task 8: Artigo de ajuda e links contextuais

**Files:**
- Modify: `public/src/Services/HelpCenterService.php`
- Modify: `tests/php/HelpCenterServiceTest.php:11`
- Modify: `public/src/Views/partials/banda/aba-categorias.php`
- Modify: `public/src/Views/editor/editor.php`

**Interfaces:**
- Consumes: `HelpCenterService::article(...)` (privado, já existente) e `help_center_visible_for_user()`.
- Produces: artigo de id `categorias`.

- [ ] **Step 1: Ajustar o teste de catálogo**

Em `tests/php/HelpCenterServiceTest.php`, linha 11:

```php
        self::assertCount(11, $articles);
```

E acrescente ao mesmo teste, depois do laço `foreach ($articles as $article)`:

```php
        self::assertContains('categorias', $ids);
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npm run test:unit:php -- --filter HelpCenterServiceTest
```

Esperado: FALHA — `Failed asserting that actual size 10 matches expected size 11`.

- [ ] **Step 3: Escrever o artigo**

Em `public/src/Services/HelpCenterService.php`, acrescente ao array devolvido por `all()`, logo depois do artigo `criar-repertorio`:

```php
            $this->article(
                'categorias',
                'Como funcionam as categorias',
                'Começando',
                'Agrupe as músicas da banda pelo critério que fizer sentido para vocês.',
                ['categoria', 'classificação', 'organizar', 'filtro', 'agrupar'],
                ['home', 'editor', 'banda'],
                ['Abra Minha Banda e vá até a aba Categorias.', 'Use um dos conjuntos sugeridos ou escreva o nome da sua categoria.', 'No editor de cada música, escolha a categoria no campo Categoria.', 'Na tela inicial, toque no nome da categoria para ver só as músicas dela.'],
                ['O critério é da banda: momento do culto, estilo da música ou ocasião — o Cifrô não impõe nenhum.', 'Cada música fica em uma categoria por vez.', 'Somente gestores e administradores criam, renomeiam ou excluem categorias.', 'Uma categoria em uso por músicas não pode ser excluída.'],
                ['primeira-cifra', 'criar-repertorio']
            ),
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm run test:unit:php -- --filter HelpCenterServiceTest
```

Esperado: `OK (2 tests)`.

- [ ] **Step 5: Ligar o artigo às duas telas**

Em `public/src/Views/partials/banda/aba-categorias.php`, no topo do arquivo, logo depois do bloco de comentário PHP e antes do `<style>`:

```php
<?php if (help_center_visible_for_user()): ?><button type="button" class="help-context-link" data-help-article="categorias" data-help-source="banda-categorias">Como funcionam as categorias?</button><?php endif; ?>
```

Em `public/src/Views/editor/editor.php`, logo depois do `</label>` do campo Categoria:

```php
          <?php if (help_center_visible_for_user()): ?><button type="button" class="help-context-link" data-help-article="categorias" data-help-source="editor-categoria">Como funcionam as categorias?</button><?php endif; ?>
```

- [ ] **Step 6: Conferir a suíte de ajuda de ponta a ponta**

```bash
npx playwright test --project=cifro tests/cifro/25-categorias.spec.js
npx playwright test --project=pwa tests/cifro/65-help-center-offline.spec.js
```

Esperado: todos passam. O artigo novo tem `offline => true` por padrão em `article()`, então entra no pacote offline sem ajuste extra.

- [ ] **Step 7: Atualizar a documentação de domínio**

Em `docs/dominios/musicas-e-cifras.md`, na seção `F-030 Categorias`, substitua o parágrafo que começa em "As categorias são exibidas como filtros" por:

```markdown
As categorias são exibidas como filtros na home — o chip filtra pelo campo de
categoria da música, não pelo texto da busca — e como opções no campo Categoria
do editor, onde gestor ou superior pode criar uma nova sem sair da música. Nome
equivalente ignorando caixa e acento não cria categoria repetida. A aba
Categorias mostra a contagem de músicas de cada uma e oferece conjuntos
sugeridos quando a banda ainda não criou nenhuma. Fazem parte do payload de
sincronização e possuem versão própria para invalidar o cache da banda.
```

- [ ] **Step 8: Rodar a suíte inteira**

```bash
npm run test:unit
```

```bash
npm run test:e2e
```

Esperado: ambos verdes. Qualquer falha em `04-editor-musicas` ou `02-home-cifras` aponta para as tarefas 5 e 6.

- [ ] **Step 9: Parar e reportar**

---

## Ordem e dependências

- Task 2 antes de 4 e 5 (as duas dependem do 409 com `categoria`).
- Task 3 antes de 4 (mesmo arquivo, mesma função `render`).
- Tasks 1, 6, 7 e 8 são independentes das demais e podem ser feitas em qualquer ordem.
