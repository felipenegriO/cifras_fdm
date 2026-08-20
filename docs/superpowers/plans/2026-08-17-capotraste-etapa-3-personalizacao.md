# Capotraste — Etapa 3: personalização por músico e conflito

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O capotraste que o músico escolhe numa música fica salvo na conta dele, sincroniza entre aparelhos, e quando o cadastro da banda muda ele decide o que fazer.

**Architecture:** Tabela `usuario_musica` guardando a escolha e a foto do cadastro no momento dela (`base_*`), que é o merge base do modelo do Git. A leitura entra no snapshot de sync; a escrita tem endpoint próprio que **não** sobe a revisão da banda, com uma fila local para o que for feito offline.

**Tech Stack:** PHP 8 sem framework, MySQL, JS sem build, IndexedDB, PHPUnit 9.6, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-16-capotraste-transposicao-instrumento-design.md`
**Etapas anteriores:** `2026-08-16-capotraste-etapa-1-fundacao.md`, `2026-08-17-capotraste-etapa-2-import.md`

## Correção do spec antes de começar

O spec diz que a escrita "entra na fila offline que `cifro-sync.js` já mantém para os endpoints de escrita". **Essa fila não existe.** O que existe é `applyMutation()`, que espelha localmente respostas que **já deram certo** e ainda exige `content_revision` da banda na resposta — justamente o que a preferência pessoal não sobe.

Logo, a Task 6 constrói uma fila mínima só para este endpoint. Ela é pequena porque o dado é minúsculo, é de um usuário só e resolve por última escrita — não precisa de revisão nem de resolução de conflito entre aparelhos.

## Global Constraints

- A escrita **não** altera `band_sync_state`. Dado pessoal não é conteúdo de banda; subir a revisão invalidaria o cache offline de todos os integrantes.
- Toda consulta a `usuario_musica` inclui `usuario_id` **e** `banda_id`.
- Enquanto um conflito não é resolvido, **vale o cadastro** — o conteúdo oficial nunca fica escondido atrás de decisão não tomada.
- O aviso de conflito fica retido durante live e modo apresentação.
- Faixa do valor: −12 a 12, validada por `TransposicaoInstrumento::normalizar()`.
- Nomes de teste em português, em linguagem de negócio.
- Não rodar `git commit` — o autor commita.

---

### Task 1: Tabela e repositório

**Files:**
- Create: `migrations/20260817_usuario_musica.sql`
- Modify: `create_tables.sql` (junto das demais tabelas de conteúdo)
- Create: `public/src/Repositories/UsuarioMusicaRepository.php`
- Test: `tests/php/UsuarioMusicaRepositoryTest.php`

**Interfaces:**
- Produces:
  - `UsuarioMusicaRepository::listarPorUsuario(string $usuarioId, string $bandaId): array`
  - `UsuarioMusicaRepository::salvar(string $usuarioId, string $bandaId, int $musicaId, int $valor, ?int $baseTransposicao, ?string $baseTom): void`
  - `UsuarioMusicaRepository::remover(string $usuarioId, string $bandaId, int $musicaId): void`
  - `UsuarioMusicaRepository::atualizarBase(string $usuarioId, string $bandaId, int $musicaId, ?int $baseTransposicao, ?string $baseTom): void`

- [ ] **Step 1: Migration**

`migrations/20260817_usuario_musica.sql`:

```sql
-- Personalização do músico sobre a música da banda. Hoje guarda só o
-- capotraste; é a semente do NOTE-001 (anotações pessoais), que acrescenta
-- nota e âncora nesta mesma tabela.
--
-- As colunas base_* são o merge base do modelo do Git: a foto do cadastro no
-- instante da escolha. Com elas dá para distinguir "o cadastro não mudou" de
-- "mudou e eu tinha personalizado", que é o conflito de verdade.
CREATE TABLE IF NOT EXISTS usuario_musica (
  usuario_id  CHAR(36) NOT NULL,
  banda_id    CHAR(36) NOT NULL,
  musica_id   INT      NOT NULL,
  transposicao_instrumento TINYINT    DEFAULT NULL,
  base_transposicao        TINYINT    DEFAULT NULL,
  base_tom                 VARCHAR(8) DEFAULT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, musica_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (musica_id)  REFERENCES musicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (banda_id)   REFERENCES bandas(id)   ON DELETE CASCADE,
  INDEX idx_usuario_musica_banda (usuario_id, banda_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Declare a mesma tabela em `create_tables.sql`, depois de `musicas` — o baseline precisa dela para provisionar banco novo, e `setup_e2e_db.php` aplica baseline e depois migrations.

- [ ] **Step 2: Escrever o teste que falha**

`tests/php/UsuarioMusicaRepositoryTest.php` — siga o padrão de `tests/php/PlanLimitEnforcementTest.php`, que já monta banda, usuário e música reais via `Database::getConnection()`. Os casos:

```php
    public function testGuardaEDevolveOCapotrasteDoMusico(): void
    public function testUmMusicoNaoEnxergaAEscolhaDeOutro(): void
    public function testNaoDevolveEscolhaDeOutraBanda(): void
    public function testSalvarDuasVezesAtualizaEmVezDeDuplicar(): void
    public function testRemoverApagaSomenteALinhaDaquelaMusica(): void
    public function testAtualizarBaseMantemOValorEscolhido(): void
    public function testExcluirAMusicaLevaAPersonalizacaoJunto(): void
```

O último cobre o `ON DELETE CASCADE`, que é o que garante que personalização não vira lixo órfão.

- [ ] **Step 3: Rodar para ver falhar**

```bash
npm run test:unit:php -- --filter UsuarioMusicaRepositoryTest
```

- [ ] **Step 4: Implementar o repositório**

```php
<?php
/**
 * UsuarioMusicaRepository — personalização de um músico sobre uma música da
 * banda. Toda consulta inclui usuario_id E banda_id: a linha é privada, e um
 * integrante nunca pode alcançar a de outro.
 */
class UsuarioMusicaRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::getConnection();
    }

    public function listarPorUsuario(string $usuarioId, string $bandaId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT musica_id, transposicao_instrumento, base_transposicao, base_tom
             FROM usuario_musica WHERE usuario_id=? AND banda_id=? ORDER BY musica_id'
        );
        $stmt->execute([$usuarioId, $bandaId]);
        return array_map(static fn(array $row): array => [
            'musica_id' => (int) $row['musica_id'],
            'transposicao_instrumento' => $row['transposicao_instrumento'] === null ? null : (int) $row['transposicao_instrumento'],
            'base_transposicao' => $row['base_transposicao'] === null ? null : (int) $row['base_transposicao'],
            'base_tom' => $row['base_tom'],
        ], $stmt->fetchAll());
    }

    public function salvar(string $usuarioId, string $bandaId, int $musicaId, int $valor, ?int $baseTransposicao, ?string $baseTom): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO usuario_musica (usuario_id, banda_id, musica_id, transposicao_instrumento, base_transposicao, base_tom)
             VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE transposicao_instrumento=VALUES(transposicao_instrumento),
                                     base_transposicao=VALUES(base_transposicao),
                                     base_tom=VALUES(base_tom)'
        );
        $stmt->execute([$usuarioId, $bandaId, $musicaId, $valor, $baseTransposicao, $baseTom]);
    }

    public function atualizarBase(string $usuarioId, string $bandaId, int $musicaId, ?int $baseTransposicao, ?string $baseTom): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE usuario_musica SET base_transposicao=?, base_tom=?
             WHERE usuario_id=? AND banda_id=? AND musica_id=?'
        );
        $stmt->execute([$baseTransposicao, $baseTom, $usuarioId, $bandaId, $musicaId]);
    }

    public function remover(string $usuarioId, string $bandaId, int $musicaId): void
    {
        $stmt = $this->pdo->prepare(
            'DELETE FROM usuario_musica WHERE usuario_id=? AND banda_id=? AND musica_id=?'
        );
        $stmt->execute([$usuarioId, $bandaId, $musicaId]);
    }
}
```

- [ ] **Step 5: Rodar para ver passar** e **Step 6: Ponto de parada**

---

### Task 2: Endpoint de escrita

**Files:**
- Create: `public/src/backend/users/preferencia-musica.php`
- Test: `tests/cifro/76-preferencia-musica-api.spec.js` (o padrão do projeto para endpoint é teste de API no Playwright — veja `tests/cifro/16-config-api.spec.js`)

**Interfaces:**
- Consumes: `UsuarioMusicaRepository` (Task 1), `TransposicaoInstrumento::normalizar()` (Etapa 1).
- Produces: `POST /src/backend/users/preferencia-musica.php`
  - `{ musica_id, transposicao_instrumento, base_tom }` → grava e responde `{ sucesso: true, preferencia: {...} }`
  - `{ musica_id, acao: 'remover' }` → apaga e responde `{ sucesso: true }`
  - `{ musica_id, acao: 'manter', base_tom }` → atualiza só a base, resolvendo o conflito a favor do músico

`base_transposicao` **não** vem do cliente: o servidor lê o cadastro corrente. Deixar o cliente informar a base permitiria forjar um estado "sem conflito".

- [ ] **Step 1: Escrever o teste de API que falha**

Casos, em linguagem de negócio:

```js
test('exige sessão autenticada', ...)              // sem storageState → 401/403
test('exige token CSRF', ...)                       // sem header → 403
test('recusa música de outra banda', ...)           // id inexistente na banda → 404
test('recusa deslocamento fora da faixa', ...)      // 13 → 422
test('guarda o capotraste escolhido pelo músico', ...)
test('remover apaga a escolha e volta a valer o cadastro', ...)
```

- [ ] **Step 2: Implementar**

```php
<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();

require_auth_json();
require_current_band_json();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Método inválido.']);
    exit;
}
require_csrf();

$payload = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Payload inválido.']);
    exit;
}

$usuarioId = (string) ($_SESSION['usuario']['id'] ?? '');
$bandaId   = current_band_id();
$musicaId  = filter_var($payload['musica_id'] ?? null, FILTER_VALIDATE_INT);
if (!$usuarioId || !$musicaId) {
    http_response_code(422);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Música inválida.']);
    exit;
}

// A música tem de ser da banda atual: sem isto, o id viraria uma sonda para
// descobrir conteúdo de outra banda.
$musica = (new MusicaRepository())->findById($musicaId, $bandaId);
if (!$musica) {
    http_response_code(404);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Música não encontrada.']);
    exit;
}

$repo = new UsuarioMusicaRepository();
$acao = (string) ($payload['acao'] ?? 'salvar');
// A base vem sempre do cadastro no servidor. Aceitá-la do cliente permitiria
// forjar um estado "sem conflito".
$baseCadastro = (int) ($musica['transposicao_instrumento'] ?? 0);
$baseTom = $payload['base_tom'] ?? null;
$baseTom = is_string($baseTom) && preg_match('/^[A-G](?:#|b)?m?$/', $baseTom) === 1 ? $baseTom : null;

if ($acao === 'remover') {
    $repo->remover($usuarioId, $bandaId, $musicaId);
    echo json_encode(['sucesso' => true]);
    exit;
}

if ($acao === 'manter') {
    $repo->atualizarBase($usuarioId, $bandaId, $musicaId, $baseCadastro, $baseTom);
    echo json_encode(['sucesso' => true]);
    exit;
}

$valor = TransposicaoInstrumento::normalizar($payload['transposicao_instrumento'] ?? null);
if ($valor === null) {
    http_response_code(422);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Deslocamento inválido.']);
    exit;
}

$repo->salvar($usuarioId, $bandaId, $musicaId, $valor, $baseCadastro, $baseTom);
echo json_encode(['sucesso' => true, 'preferencia' => [
    'musica_id' => $musicaId,
    'transposicao_instrumento' => $valor,
    'base_transposicao' => $baseCadastro,
    'base_tom' => $baseTom,
]]);
```

- [ ] **Step 3: Rodar** e **Step 4: Ponto de parada**

---

### Task 3: Preferências no snapshot de sync

**Files:**
- Modify: `public/api/sync/data.php`
- Modify: `public/src/js/cifro-sync.js` — `DB_VERSION`, `DATA_STORES`, `writeSnapshot`, `validateSnapshot`, `rebuildSnapshotFromRows`, `applySnapshot`
- Test: `tests/cifro/76-preferencia-musica-api.spec.js` (acrescentar)

**Interfaces:**
- Produces: `json.preferencias_musica` no snapshot e `window.preferenciasMusica` no cliente.

- [ ] **Step 1: Servidor**

Em `public/api/sync/data.php`, junto dos demais repositórios:

```php
$preferencias = (new UsuarioMusicaRepository())->listarPorUsuario(
    (string) ($_SESSION['usuario']['id'] ?? ''),
    $bandaId
);
```

E acrescentar `'preferencias_musica' => $preferencias,` ao `json_encode`. Devolver `[]` também no caminho de banda ausente, no topo do arquivo.

- [ ] **Step 2: Cliente — store novo**

Em `cifro-sync.js`:

```js
    const DB_VERSION = 7;
    const DATA_STORES = ['cifro_musicas', 'cifro_playlists', 'cifro_roteiros', 'cifro_categorias', 'cifro_preferencias', 'cifro_sync_meta'];
```

Subir a versão é obrigatório: `onupgradeneeded` só cria os stores que faltam quando a versão muda.

Gravar no `writeSnapshot` junto dos demais:

```js
            tx.objectStore('cifro_preferencias').put({ banda_id: key, actual_band_id: bandaId, data: json.preferencias_musica ?? [], content_revision: revision });
```

Incluir no `data` do `cifro_snapshot_current`, no `rebuildSnapshotFromRows` (`preferencias_musica: rows.cifro_preferencias?.data ?? []`) e no `applySnapshot`:

```js
        window.preferenciasMusica = json.preferencias_musica ?? [];
```

- [ ] **Step 3: Validação tolerante**

Em `validateSnapshot`, **não** exigir a chave nova: um cliente atualizado precisa continuar funcionando contra um servidor ainda antigo durante o deploy.

```js
        if (json.preferencias_musica !== undefined) {
            if (!Array.isArray(json.preferencias_musica)) throw new Error('Snapshot inválido: preferencias_musica');
            if (json.preferencias_musica.some(item => !item || !Number.isFinite(Number(item.musica_id)))) throw new Error('Preferências inválidas');
        }
```

- [ ] **Step 4: Rodar** — a suíte de sync existente (`tests/cifro/45-cifro-sync-validation.spec.js`) precisa continuar verde. **Step 5: Ponto de parada**

---

### Task 4: Exportação de dados pessoais

**Files:**
- Modify: `public/src/Services/PrivacyService.php:29-34`
- Test: `tests/php/PrivacyServiceTest.php`

A exclusão da conta já está coberta pelo `ON DELETE CASCADE` da Task 1. Falta a exportação.

- [ ] **Step 1: Teste**

```php
    public function testExportacaoIncluiAsPersonalizacoesDoMusico(): void
```

- [ ] **Step 2: Implementar** — acrescentar ao array devolvido por `exportAccount`:

```php
        $prefsStmt = $this->pdo->prepare(
            'SELECT um.musica_id, m.nome AS musica, um.transposicao_instrumento
             FROM usuario_musica um INNER JOIN musicas m ON m.id = um.musica_id
             WHERE um.usuario_id=? ORDER BY um.musica_id'
        );
        $prefsStmt->execute([$userId]);
```

```php
            'personalizacoes_de_musica' => $prefsStmt->fetchAll(),
```

- [ ] **Step 3: Rodar** e **Step 4: Ponto de parada**

---

### Task 5: A tela de música passa a usar e salvar a escolha

**Files:**
- Modify: `public/src/Views/music.php` — `capoInicial`, `definirCapo`

**Interfaces:**
- Consumes: `window.preferenciasMusica` (Task 3) e o endpoint da Task 2.

Na Etapa 1 a escolha valia só enquanto a tela estava aberta. Agora ela dura.

- [ ] **Step 1: Ler a personalização**

Em `capoInicial`, antes de tudo:

```js
            function personalizacaoDaMusica() {
                return (window.preferenciasMusica || []).find(item => Number(item.musica_id) === Number(songId)) || null;
            }
```

E no início de `capoInicial`, respeitando a regra de que conflito não resolvido vale o cadastro:

```js
                const pessoal = personalizacaoDaMusica();
                if (pessoal && !emConflito(pessoal) && pessoal.transposicao_instrumento !== null) {
                    return limitarCapo(pessoal.transposicao_instrumento);
                }
```

`emConflito` vem da Task 7 e é compartilhada — defina-a num arquivo próprio (`public/src/js/cifro-capo-pessoal.js`) carregado por `music.php` e pela home, para as duas telas usarem a mesma regra.

- [ ] **Step 2: Salvar ao mexer**

Em `definirCapo`, quando `manual` for verdadeiro, persistir com debounce de 800 ms — o stepper dispara vários cliques seguidos e não faz sentido uma requisição por clique:

```js
            let salvarCapoAgendado = null;
            function persistirCapoPessoal() {
                clearTimeout(salvarCapoAgendado);
                salvarCapoAgendado = setTimeout(() => {
                    window.CifroCapoPessoal.salvar(songId, capo.valor, capo.tomSoante);
                }, 800);
            }
```

- [ ] **Step 3: Conferir** — pôr capo 3, recarregar a página, o capo continua 3. **Step 4: Ponto de parada**

---

### Task 6: Fila para escrita offline

**Files:**
- Create: `public/src/js/cifro-capo-pessoal.js`
- Modify: `public/service-worker.js` (acrescentar o arquivo à lista de estáticos)

**Interfaces:**
- Produces:
  - `CifroCapoPessoal.salvar(musicaId, valor, tomSoante)`
  - `CifroCapoPessoal.resolver(musicaId, acao, tomSoante)` — `acao` é `'cadastro'` ou `'meu'`
  - `CifroCapoPessoal.emConflito(preferencia, musica)` → boolean
  - `CifroCapoPessoal.pendencias()` → lista de conflitos
  - `CifroCapoPessoal.enviarPendentes()` — chamada quando a conexão volta

A fila é mínima de propósito: o dado é minúsculo, pertence a um usuário só e resolve por última escrita. Guardar em `localStorage` (não IndexedDB) porque são poucos bytes e o acesso é síncrono, o que simplifica o disparo no `online`.

- [ ] **Step 1: Escrever o módulo**

```js
(function () {
    const FILA_KEY = 'cifroCapoPendente:';

    function chaveDaFila() {
        return FILA_KEY + String(window.CIFRO_USER_ID || 'anonymous') + ':' + String(window.CIFRO_BAND_ID || '');
    }

    function lerFila() {
        try { return JSON.parse(localStorage.getItem(chaveDaFila()) || '{}'); } catch (_) { return {}; }
    }

    function gravarFila(fila) {
        try { localStorage.setItem(chaveDaFila(), JSON.stringify(fila)); } catch (_) {}
    }

    // Uma entrada por música: a última escolha vence, então não faz sentido
    // acumular histórico.
    function enfileirar(musicaId, corpo) {
        const fila = lerFila();
        fila[String(musicaId)] = corpo;
        gravarFila(fila);
    }

    async function enviar(corpo) {
        const resposta = await fetch((window.APP_BASE || '') + '/src/backend/users/preferencia-musica.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(corpo)
        });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || 'falha');
        return dados;
    }

    async function despachar(musicaId, corpo) {
        try {
            await enviar(corpo);
            const fila = lerFila();
            delete fila[String(musicaId)];
            gravarFila(fila);
            return true;
        } catch (_) {
            enfileirar(musicaId, corpo);
            return false;
        }
    }

    async function enviarPendentes() {
        const fila = lerFila();
        for (const [musicaId, corpo] of Object.entries(fila)) {
            await despachar(musicaId, corpo);
        }
    }

    function salvar(musicaId, valor, tomSoante) {
        return despachar(musicaId, {
            musica_id: Number(musicaId),
            transposicao_instrumento: Number(valor) || 0,
            base_tom: tomSoante || null
        });
    }

    function resolver(musicaId, acao, tomSoante) {
        return despachar(musicaId, {
            musica_id: Number(musicaId),
            acao: acao === 'cadastro' ? 'remover' : 'manter',
            base_tom: tomSoante || null
        });
    }

    // Comparação de três pontas: base (o cadastro quando escolhi), cadastro
    // atual e a minha escolha. Só é conflito quando os dois lados andaram.
    function emConflito(preferencia, musica) {
        if (!preferencia || !musica) return false;
        const baseValor = Number(preferencia.base_transposicao ?? 0);
        const cadastroValor = Number(musica.transposicao_instrumento ?? 0);
        const meuValor = Number(preferencia.transposicao_instrumento ?? 0);
        const tomMudou = Boolean(preferencia.base_tom) && Boolean(musica.__tomSoante)
            && preferencia.base_tom !== musica.__tomSoante;
        const cadastroMudou = cadastroValor !== baseValor || tomMudou;
        const euDivergi = meuValor !== baseValor;
        return cadastroMudou && euDivergi;
    }

    function pendencias() {
        const musicas = window.songs || [];
        return (window.preferenciasMusica || [])
            .map(preferencia => ({
                preferencia,
                musica: musicas.find(item => Number(item.id) === Number(preferencia.musica_id))
            }))
            .filter(item => item.musica && emConflito(item.preferencia, item.musica));
    }

    window.CifroCapoPessoal = { salvar, resolver, emConflito, pendencias, enviarPendentes };
    window.addEventListener('online', () => { enviarPendentes(); });
    document.addEventListener('cifro:sync', () => { enviarPendentes(); });
})();
```

Nota sobre `musica.__tomSoante`: o tom não está no banco, é detectado no cliente. Quem chama `emConflito` a partir da lista de músicas precisa preencher esse campo com `CifroChords.identifyKey(musica.cifra)?.key` antes de comparar. Faça isso uma vez em `pendencias()`, não a cada chamada, porque a detecção percorre a cifra inteira.

**Corrija isso na implementação:** `pendencias()` deve calcular o tom soante de cada música candidata antes de chamar `emConflito`, e só das músicas que têm personalização — não de todas as músicas da banda.

- [ ] **Step 2: Carregar o módulo** em `music.php` e `index.php`, depois de `chords.js` e `cifro-sync.js`. Acrescentar à lista de estáticos do service worker, senão a tela quebra offline.

- [ ] **Step 3: Teste de que a fila sobe quando a conexão volta** (Playwright, com `page.route` para derrubar a primeira tentativa). **Step 4: Ponto de parada**

---

### Task 7: Aviso e tela de pendências

**Files:**
- Modify: `public/src/Views/partials/topnav.php` (contador)
- Create: `public/pendencias.php` + `public/src/Views/pendencias.php` + controller, no padrão fino das demais páginas
- Modify: `public/src/js/cifro-sync.js` ou a home, para disparar o aviso após o sync

- [ ] **Step 1: Contador no menu** — badge com o número de pendências, escondido quando zero.

- [ ] **Step 2: Aviso após o sync**

```js
        // Retido durante live e apresentação: interromper alguém no meio de um
        // culto é o risco natural da notificação imediata.
        function apresentando() {
            return document.body.classList.contains('is-presenting')
                || window.LiveMode?.getMode?.() === 'host'
                || window.LiveMode?.getMode?.() === 'follow';
        }
```

Confirme os nomes reais com `grep -n "is-presenting\|getMode" public/src/js/cifro-presentation.js public/src/js/live.js` antes de usar; se não existirem, exponha o que existir.

- [ ] **Step 3: Tela de pendências** — cada item mostra `Cadastro antes: capo 2 · Cadastro agora: capo 4 · Você usa: 3`, com **Usar o do cadastro**, **Manter o meu** e **Abrir a música**.

- [ ] **Step 4: Teste de ponta a ponta** — cria a personalização, muda o cadastro por outro caminho (API do editor), sincroniza, confirma a pendência e resolve nos dois sentidos.

- [ ] **Step 5: Ponto de parada**

---

### Task 8: Documentação

- `docs/modelo-de-dados.md`: a tabela `usuario_musica` e as colunas `base_*` como merge base.
- `docs/api.md`: o endpoint novo e a chave `preferencias_musica` no snapshot.
- `docs/funcionalidades.md`: a personalização e a resolução de conflito em F-032.
- `docs/testes.md`: os arquivos de teste novos.
- `docs/seguranca-e-permissoes.md`: a linha é privada por usuário e banda.
- `backlog.md`: NOTE-001 pode marcar "tom e capo preferidos" como entregue.
