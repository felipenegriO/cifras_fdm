# LIVE-002 etapa 1 — Posse do host — Plano de implementação

> **Para quem executa:** use `superpowers:subagent-driven-development` ou `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos usam `- [ ]` para acompanhamento.

**Objetivo:** dar semântica real à posse do comando de uma live — lease com expiração, pedido de controle com consentimento, liberação explícita — e fazer o host deposto ouvir a verdade em vez de "Live desconectada".

**Arquitetura:** estende a linha única de `live_state` por banda com cinco colunas (lease e pedido). Toda operação que decide posse roda em transação com `SELECT ... FOR UPDATE`. O tempo vem de uma fonte injetável e é sempre comparado em PHP, nunca em SQL.

**Stack:** PHP 8 sem framework, PDO/MySQL (MariaDB 11.8 em produção), PHPUnit 9.6, Playwright, JS sem build.

**Spec:** [2026-08-20-live-002-etapa-1-posse-do-host-design.md](../specs/2026-08-20-live-002-etapa-1-posse-do-host-design.md). Em caso de divergência, o spec manda.

## Restrições globais

- **Lease 90s. Renovação 30s. Janela do pedido 30s. Sobrevida do `pendente` vencido 60s.**
- **Nenhuma comparação de data em SQL.** Proibido `NOW()`, `TIMESTAMPDIFF`, `DATE_ADD` para decidir posse. Tudo em PHP, em UTC, a partir da fonte de tempo injetada.
- **Toda operação que decide posse roda em transação com `SELECT ... FOR UPDATE`** sobre a linha da banda. `status.php` fica de fora: é leitura pura.
- **Códigos:** 403 = "seu perfil não pode hospedar". 409 = "agora não dá". 429 = rate limit. 400 = pedido sem host.
- **`hostId` só é emitido na resposta do claim.** Nunca em `status.php`.
- **Não commitar.** O responsável commita. Onde o passo diz "checkpoint", pare e avise.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `migrations/20260820_live_state_posse.sql` | cinco colunas novas |
| `create_tables.sql` | mesmas colunas no baseline |
| `public/src/Repositories/LiveStateRepository.php` | whitelist, `getForUpdate()`, transação |
| `public/src/Services/LiveStateService.php` | fonte de tempo, regra de posse, pedido |
| `public/api/live/release.php` | liberar |
| `public/api/live/request.php` | pedir controle |
| `public/api/live/answer.php` | aceitar/negar |
| `public/api/live/host.php` | claim com a regra nova |
| `public/api/live/status.php` | campos novos |
| `public/api/live/update.php` | renova lease, devolve pedido, `code` no 403 |
| `public/api/testing/reset-live.php` | reset de estado para os testes |
| `public/src/js/live.js` | erro com `code`, verdade ao deposto, UI |
| `tests/php/LiveStateServiceTest.php` | regras com relógio controlado |
| `tests/cifro/81-live-posse-do-host.spec.js` | integração real, dois usuários |

---

## Task 1: Schema e whitelist do repositório

**Arquivos:**
- Criar: `migrations/20260820_live_state_posse.sql`
- Modificar: `create_tables.sql` (bloco `live_state`)
- Modificar: `public/src/Repositories/LiveStateRepository.php`
- Teste: `tests/php/LiveStateRepositoryPosseTest.php`

**Produz:** colunas `lease_expira_em`, `pedido_usuario_id`, `pedido_nome`, `pedido_expira_em`, `pedido_status` graváveis via `LiveStateRepository::update()`.

**Armadilha:** `update()` tem uma whitelist `$allowed`. Coluna fora dela é descartada **em silêncio**, sem erro. É por isso que este task começa por um teste de gravação.

- [ ] **Passo 1: escrever o teste que falha**

```php
// tests/php/LiveStateRepositoryPosseTest.php
public function testGravaEleAsColunasDePosse(): void
{
    $repo = new LiveStateRepository();
    $repo->update($this->bandaId, [
        'lease_expira_em'   => '2026-08-20 23:00:00',
        'pedido_usuario_id' => $this->usuarioId,
        'pedido_nome'       => 'Ana',
        'pedido_expira_em'  => '2026-08-20 22:31:00',
        'pedido_status'     => 'pendente',
    ]);

    $row = $repo->get($this->bandaId);

    self::assertSame('2026-08-20 23:00:00', $row['lease_expira_em']);
    self::assertSame('Ana', $row['pedido_nome']);
    self::assertSame('pendente', $row['pedido_status']);
}
```

- [ ] **Passo 2: rodar e ver falhar**

`npm run test:unit:php -- --filter LiveStateRepositoryPosseTest`
Esperado: falha por coluna inexistente.

- [ ] **Passo 3: criar a migration**

```sql
-- migrations/20260820_live_state_posse.sql
-- Posse do host: lease com expiração e pedido de controle.
-- IF NOT EXISTS é obrigatório: as colunas também nascem no create_tables.sql,
-- e banco novo aplica o baseline ANTES das migrations.
ALTER TABLE live_state
  ADD COLUMN IF NOT EXISTS lease_expira_em   DATETIME     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pedido_usuario_id CHAR(36)     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pedido_nome       VARCHAR(120) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pedido_expira_em  DATETIME     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pedido_status     ENUM('pendente','aprovado','negado') DEFAULT NULL;
```

- [ ] **Passo 4: acrescentar as mesmas colunas ao `create_tables.sql`**

No bloco `CREATE TABLE IF NOT EXISTS live_state`, antes de `PRIMARY KEY (banda_id)`:

```sql
  lease_expira_em   DATETIME     DEFAULT NULL,
  pedido_usuario_id CHAR(36)     DEFAULT NULL,
  pedido_nome       VARCHAR(120) DEFAULT NULL,
  pedido_expira_em  DATETIME     DEFAULT NULL,
  pedido_status     ENUM('pendente','aprovado','negado') DEFAULT NULL,
```

- [ ] **Passo 5: liberar as colunas na whitelist**

Em `LiveStateRepository::update()`, substituir a linha do `$allowed`:

```php
$allowed = ['host_id','host_user_id','host_nome','cifra_atual',
            'pagina_atual','scroll_top','scroll_percent','can_sync_scroll','updated_at',
            'lease_expira_em','pedido_usuario_id','pedido_nome',
            'pedido_expira_em','pedido_status'];
```

Acrescentar também as cinco ao `INSERT` do caminho "linha ainda não existe" e ao `defaultState()`, com `null`.

- [ ] **Passo 6: recriar o banco de teste e rodar**

```bash
npm run test:e2e:db:setup
```

`npm run test:unit:php -- --filter LiveStateRepositoryPosseTest`
Esperado: PASS.

- [ ] **Passo 7: conferir que a migration é idempotente**

`C:/xampp/php/php.exe scripts/setup/migrate.php --status`
Esperado: todas `applied`, incluindo `20260820_live_state_posse`.

- [ ] **Passo 8: checkpoint** — avisar o responsável para commitar.

---

## Task 2: Fonte de tempo injetável

**Arquivos:**
- Modificar: `public/src/Services/LiveStateService.php`
- Teste: `tests/php/LiveStateServiceTest.php`

**Produz:** `LiveStateService::__construct($backend, ?callable $agora = null)`, onde `$agora()` devolve um timestamp Unix inteiro. Padrão: `time()`. Todas as tarefas seguintes usam `$this->agora()`.

- [ ] **Passo 1: escrever o teste que falha**

```php
public function testUsaAFonteDeTempoInjetada(): void
{
    $relogio = 1_800_000_000;
    $service = new LiveStateService(new LiveStateRepository(), function () use (&$relogio) {
        return $relogio;
    });

    self::assertSame($relogio, $service->agoraParaTeste());
}
```

- [ ] **Passo 2: rodar e ver falhar** — `--filter testUsaAFonteDeTempoInjetada`. Esperado: erro de argumento ou método inexistente.

- [ ] **Passo 3: implementar**

```php
private $agora;

public function __construct($backendOrFilePath, ?callable $agora = null) {
    // ... corpo atual preservado ...
    $this->agora = $agora ?? static fn(): int => time();
}

private function agora(): int { return ($this->agora)(); }

/** Só para teste: expõe a fonte de tempo sem abrir o resto do estado. */
public function agoraParaTeste(): int { return $this->agora(); }

/** Instante UTC no formato do banco, a partir da fonte injetada. */
private function instante(int $segundosAFrente = 0): string {
    return gmdate('Y-m-d H:i:s', $this->agora() + $segundosAFrente);
}

/** Verdadeiro se $coluna (string UTC do banco) já venceu. Comparação em PHP. */
private function venceu(?string $coluna, int $tolerancia = 0): bool {
    if ($coluna === null || $coluna === '') return true;
    return $this->agora() >= strtotime($coluna . ' UTC') + $tolerancia;
}
```

- [ ] **Passo 4: rodar e ver passar.**

- [ ] **Passo 5: trocar `hostAindaAtivo()` para usar o lease e a fonte nova**

```php
private function hostAindaAtivo(array $state): bool {
    if (($state['hostId'] ?? '') === '') return false;
    return !$this->venceu($state['leaseExpiraEm'] ?? null);
}
```

Atualizar `normaliseRepoRow()` e `stateToRepoFields()` para mapear as cinco colunas novas entre `snake_case` (banco) e `camelCase` (estado interno), seguindo o padrão já usado para `host_id`/`hostId`.

- [ ] **Passo 6: rodar a suíte PHP inteira** — `npm run test:unit:php`. Esperado: verde.

- [ ] **Passo 7: checkpoint.**

---

## Task 3: Transação e trava no repositório

**Arquivos:**
- Modificar: `public/src/Repositories/LiveStateRepository.php`
- Modificar: `public/src/Services/LiveStateService.php` (`withRepoState`)
- Teste: `tests/php/LiveStateConcorrenciaTest.php`

**Consome:** Task 1 (colunas), Task 2 (fonte de tempo).
**Produz:** `LiveStateRepository::transacao(callable $cb)` e `getForUpdate(string $bandaId): array`.

**Por quê:** hoje `withRepoState()` lê, decide e escreve sem trava — o `LOCK_EX` só vale no caminho de arquivo. Enquanto o claim sempre sobrescrevia isso era inofensivo; deixa de ser quando a decisão passa a depender do estado lido.

- [ ] **Passo 1: escrever o teste que falha**

```php
public function testDoisClaimsConcorrentesProduzemUmUnicoHost(): void
{
    // Duas conexões independentes, como dois processos PHP atendendo
    // requisições simultâneas. Com a mesma conexão não há corrida.
    $repoA = new LiveStateRepository();
    $repoB = new LiveStateRepository(self::novaConexao());

    $vencedores = [];
    foreach ([$repoA, $repoB] as $repo) {
        $service = new LiveStateService($repo, fn() => 1_800_000_000);
        $r = $service->assumirHost($this->bandaId, ['id' => bin2hex(random_bytes(8)), 'nome' => 'X']);
        if (!empty($r['success'])) $vencedores[] = $r['hostId'];
    }

    self::assertCount(1, $vencedores, 'apenas um claim pode vencer');
}
```

- [ ] **Passo 2: rodar e ver falhar** — esperado: 2 vencedores.

- [ ] **Passo 3: aceitar PDO opcional no repositório**

```php
public function __construct(?PDO $pdo = null) {
    $this->pdo = $pdo ?? Database::getConnection();
}

public function transacao(callable $cb) {
    $jaEstava = $this->pdo->inTransaction();
    if (!$jaEstava) $this->pdo->beginTransaction();
    try {
        $resultado = $cb();
        if (!$jaEstava) $this->pdo->commit();
        return $resultado;
    } catch (Throwable $e) {
        if (!$jaEstava && $this->pdo->inTransaction()) $this->pdo->rollBack();
        throw $e;
    }
}

/** Lê a linha travando-a até o fim da transação. Cria a linha se não existir. */
public function getForUpdate(string $bandaId): array {
    $stmt = $this->pdo->prepare('SELECT * FROM live_state WHERE banda_id=? FOR UPDATE');
    $stmt->execute([$bandaId]);
    $row = $stmt->fetch();
    if ($row) return $row;

    // Sem linha não há o que travar, e dois claims simultâneos inseririam os
    // dois. A PK em banda_id resolve: o segundo INSERT falha e relê travado.
    try {
        $this->pdo->prepare('INSERT INTO live_state (banda_id) VALUES (?)')->execute([$bandaId]);
    } catch (PDOException $e) {
        // 23000 = violação de chave: outro processo inseriu primeiro.
        if ($e->getCode() !== '23000') throw $e;
    }
    $stmt->execute([$bandaId]);
    return $stmt->fetch() ?: $this->defaultState($bandaId);
}
```

- [ ] **Passo 4: usar a transação no serviço**

```php
private function withRepoState(string $salaId, callable $cb): array {
    return $this->repo->transacao(function () use ($salaId, $cb) {
        $state = $this->normaliseRepoRow($this->repo->getForUpdate($salaId));
        $out   = $cb($state);
        if (isset($out['state'])) {
            $this->repo->update($salaId, $this->stateToRepoFields($out['state']));
        }
        return $out['result'] ?? null;
    });
}
```

O `try/catch` que devolvia 500 sai daqui: engolir a exceção dentro da transação impediria o rollback. O tratamento sobe para os endpoints.

- [ ] **Passo 5: rodar e ver passar** — `--filter LiveStateConcorrenciaTest`.

- [ ] **Passo 6: rodar a suíte PHP inteira.** Esperado: verde.

- [ ] **Passo 7: checkpoint.**

---

## Task 4: Regra de posse no claim

**Arquivos:**
- Modificar: `public/src/Services/LiveStateService.php` (`assumirHost`)
- Modificar: `public/api/live/host.php`
- Teste: `tests/php/LiveStateServiceTest.php`

**Consome:** Tasks 2 e 3.
**Produz:** `assumirHost()` devolvendo `['success'=>true,'hostId'=>..]` ou `['success'=>false,'code'=>'sala_ocupada','hostNome'=>..]` com HTTP 409.

- [ ] **Passo 1: escrever os testes que falham**

```php
public function testOutroUsuarioComLeaseAtivoRecebe409(): void
{
    $service = $this->servicoComRelogio($t = 1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    $r = $service->assumirHost($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertFalse($r['success']);
    self::assertSame('sala_ocupada', $r['code']);
    self::assertSame('Léo', $r['hostNome']);
}

public function testMesmoUsuarioRenovaSempre(): void
{
    $service = $this->servicoComRelogio(1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    $r = $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    self::assertTrue($r['success']);
}

public function testUmSegundoAntesDoVencimentoAindaRecusa(): void
{
    $t = 1_800_000_000;
    $service = $this->servicoComRelogio($t);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    $tarde = $this->servicoComRelogio($t + 89);
    self::assertFalse($tarde->assumirHost($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana'])['success']);
}

public function testUmSegundoDepoisDoVencimentoAceita(): void
{
    $t = 1_800_000_000;
    $this->servicoComRelogio($t)->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    $r = $this->servicoComRelogio($t + 91)->assumirHost($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertTrue($r['success']);
}

/** Efeito colateral declarado no spec: uma sessão de comando por pessoa. */
public function testReassumirInvalidaOHostIdAnterior(): void
{
    $t = 1_800_000_000;
    $service = $this->servicoComRelogio($t);
    $primeiro = $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo'])['hostId'];
    $segundo  = $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo'])['hostId'];

    self::assertNotSame($primeiro, $segundo);

    $r = $service->atualizar($this->bandaId, $primeiro, null, null, true);
    self::assertFalse($r['success']);
    self::assertSame('nao_e_mais_host', $r['code'], 'o aparelho antigo precisa saber que perdeu a sessão');
}
```

O `setUp` do teste precisa criar **duas** bandas — `$this->bandaId` e `$this->outraBandaId` — para o teste de isolamento da Task 6, e um helper:

```php
private function servicoComRelogio(int $instante): LiveStateService
{
    return new LiveStateService(new LiveStateRepository(), static fn(): int => $instante);
}
```

- [ ] **Passo 2: rodar e ver falhar** — hoje todos devolvem sucesso.

- [ ] **Passo 3: implementar**

```php
private const LEASE_SEGUNDOS  = 90;
private const PEDIDO_SEGUNDOS = 30;
private const SOBREVIDA_PEDIDO_SEGUNDOS = 60;

public function assumirHost(string $salaId, array $usuario = []): array {
    try { $salaId = $this->validarSalaId($salaId); }
    catch (InvalidArgumentException $e) { return $this->err400($e->getMessage()); }

    $usuarioId = (string)($usuario['id'] ?? '');

    return $this->withState($salaId, LOCK_EX, function ($state) use ($usuarioId, $usuario) {
        if (!$this->podeAssumir($state, $usuarioId)) {
            http_response_code(409);
            return ['state' => null, 'result' => [
                'success'  => false,
                'code'     => 'sala_ocupada',
                'hostNome' => (string)($state['hostNome'] ?? ''),
                'message'  => 'Outra pessoa está no comando da live',
            ]];
        }

        $hostId = $this->novoHostId();
        $state['hostId']         = $hostId;
        $state['hostUserId']     = $usuarioId;
        $state['hostNome']       = (string)($usuario['nome'] ?? '');
        $state['updatedAt']      = $this->instante();
        $state['leaseExpiraEm']  = $this->instante(self::LEASE_SEGUNDOS);
        $state['version']        = ((int)($state['version'] ?? 0)) + 1;
        $state = $this->limparPedido($state);

        return ['state' => $state, 'result' => [
            'success'       => true,
            'hostId'        => $hostId,
            'hostNome'      => $state['hostNome'],
            'leaseExpiraEm' => $state['leaseExpiraEm'],
            'serverTime'    => $this->instante(),
            'message'       => 'Voce agora e o host',
        ]];
    });
}

private function podeAssumir(array $state, string $usuarioId): bool {
    if (($state['hostId'] ?? '') === '')                    return true;  // sala vazia
    if ($this->venceu($state['leaseExpiraEm'] ?? null))     return true;  // host sumiu
    if ((string)($state['hostUserId'] ?? '') === $usuarioId) return true; // renovação
    return $this->pedidoAutoriza($state, $usuarioId);
}

/** Pedido aprovado no prazo, ou pendente vencido ainda vivo (silêncio). */
private function pedidoAutoriza(array $state, string $usuarioId): bool {
    if ((string)($state['pedidoUsuarioId'] ?? '') !== $usuarioId || $usuarioId === '') return false;
    $status  = (string)($state['pedidoStatus'] ?? '');
    $expira  = $state['pedidoExpiraEm'] ?? null;
    if ($status === 'aprovado') return !$this->venceu($expira);
    if ($status === 'pendente') {
        return $this->venceu($expira)
            && !$this->venceu($expira, self::SOBREVIDA_PEDIDO_SEGUNDOS);
    }
    return false;
}

private function limparPedido(array $state): array {
    $state['pedidoUsuarioId'] = null;
    $state['pedidoNome']      = null;
    $state['pedidoExpiraEm']  = null;
    $state['pedidoStatus']    = null;
    return $state;
}
```

`withRepoState` já ignora a escrita quando `state` vem `null` — confirme que a checagem é `isset($out['state'])` e que `null` não é persistido.

- [ ] **Passo 4: rodar e ver passar.**

- [ ] **Passo 5: rodar a suíte PHP inteira.**

- [ ] **Passo 6: checkpoint.**

---

## Task 5: Liberar o comando

**Arquivos:**
- Modificar: `public/src/Services/LiveStateService.php`
- Criar: `public/api/live/release.php`
- Teste: `tests/php/LiveStateServiceTest.php`

**Produz:** `liberarHost(string $salaId, string $usuarioId): array`.

- [ ] **Passo 1: testes que falham**

```php
public function testHostLiberaESalaFicaLivre(): void
{
    $service = $this->servicoComRelogio(1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    self::assertTrue($service->liberarHost($this->bandaId, 'user-a')['success']);
    self::assertTrue($service->assumirHost($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana'])['success']);
}

public function testQuemNaoEHostNaoLibera(): void
{
    $service = $this->servicoComRelogio(1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    $r = $service->liberarHost($this->bandaId, 'user-b');

    self::assertFalse($r['success']);
    self::assertSame('nao_e_host', $r['code']);
}

public function testLiberarSalaVaziaEhSucesso(): void
{
    self::assertTrue($this->servicoComRelogio(1_800_000_000)
        ->liberarHost($this->bandaId, 'user-a')['success']);
}
```

- [ ] **Passo 2: rodar e ver falhar** — método inexistente.

- [ ] **Passo 3: implementar**

```php
public function liberarHost(string $salaId, string $usuarioId): array {
    try { $salaId = $this->validarSalaId($salaId); }
    catch (InvalidArgumentException $e) { return $this->err400($e->getMessage()); }

    return $this->withState($salaId, LOCK_EX, function ($state) use ($usuarioId) {
        $temHost = ($state['hostId'] ?? '') !== '' && !$this->venceu($state['leaseExpiraEm'] ?? null);

        // Liberar o que já está livre é sucesso, não erro: o cliente pode
        // reenviar depois de uma queda sem receber falha por isso.
        if (!$temHost) {
            return ['state' => null, 'result' => ['success' => true, 'message' => 'Sala já estava livre']];
        }
        if ((string)($state['hostUserId'] ?? '') !== $usuarioId) {
            http_response_code(409);
            return ['state' => null, 'result' => [
                'success' => false, 'code' => 'nao_e_host',
                'message' => 'Apenas o host atual pode liberar a live',
            ]];
        }

        $state['hostId']        = null;
        $state['hostUserId']    = null;
        $state['hostNome']      = null;
        $state['leaseExpiraEm'] = null;
        $state['version']       = ((int)($state['version'] ?? 0)) + 1;
        $state = $this->limparPedido($state);

        return ['state' => $state, 'result' => ['success' => true, 'message' => 'Comando liberado']];
    });
}
```

- [ ] **Passo 4: criar o endpoint**

```php
<?php
// public/api/live/release.php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo nao permitido']);
    exit;
}

require_auth_json();
require_csrf();
require_live_host();

$salaId  = require_current_band_json();
$service = new LiveStateService(new LiveStateRepository());
echo json_encode($service->liberarHost($salaId, (string)($_SESSION['usuario']['id'] ?? '')));
```

- [ ] **Passo 5: rodar e ver passar.** Depois a suíte PHP inteira.

- [ ] **Passo 6: checkpoint.**

---

## Task 6: Pedir controle

**Arquivos:**
- Modificar: `public/src/Services/LiveStateService.php`
- Criar: `public/api/live/request.php`
- Teste: `tests/php/LiveStateServiceTest.php`

**Produz:** `pedirControle(string $salaId, array $usuario): array`.

- [ ] **Passo 1: testes que falham**

```php
public function testPedidoComHostAtivoEhCriado(): void
{
    $service = $this->servicoComRelogio($t = 1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    $r = $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertTrue($r['success']);
    self::assertSame(gmdate('Y-m-d H:i:s', $t + 30), $r['expiraEm']);
}

public function testPedidoSemHostRecebe400(): void
{
    $r = $this->servicoComRelogio(1_800_000_000)
        ->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertFalse($r['success']);
    self::assertSame('sem_host', $r['code']);
}

public function testPedidoDeTerceiroSobrePedidoVivoRecebe409(): void
{
    $service = $this->servicoComRelogio(1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    $r = $service->pedirControle($this->bandaId, ['id' => 'user-c', 'nome' => 'Rui']);

    self::assertFalse($r['success']);
    self::assertSame('pedido_em_curso', $r['code']);
}

public function testPedidoRepetidoNaoEstendeAJanela(): void
{
    $t = 1_800_000_000;
    $service = $this->servicoComRelogio($t);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    $depois = $this->servicoComRelogio($t + 10);
    $r = $depois->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertTrue($r['success']);
    self::assertSame(gmdate('Y-m-d H:i:s', $t + 30), $r['expiraEm'], 'a janela não pode ser empurrada');
}

public function testSilencioDeTrintaSegundosAutorizaOClaim(): void
{
    $t = 1_800_000_000;
    $service = $this->servicoComRelogio($t);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    $r = $this->servicoComRelogio($t + 31)
        ->assumirHost($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertTrue($r['success']);
}

/**
 * A sobrevida do pedido não pode ser testada por assumirHost(): o lease de 90s
 * e a janela de 30s+60s vencem quase juntos, e o claim passaria pela regra de
 * lease expirado — verde pelo motivo errado. Testa a regra isolada.
 */
public function testPedidoPendenteDeixaDeAutorizarDepoisDaSobrevida(): void
{
    $t = 1_800_000_000;
    $estado = [
        'pedidoUsuarioId' => 'user-b',
        'pedidoStatus'    => 'pendente',
        'pedidoExpiraEm'  => gmdate('Y-m-d H:i:s', $t + 30),
    ];

    $autoriza = function (int $quando) use ($estado): bool {
        $metodo = new ReflectionMethod(LiveStateService::class, 'pedidoAutoriza');
        $metodo->setAccessible(true);
        return $metodo->invoke($this->servicoComRelogio($quando), $estado, 'user-b');
    };

    self::assertFalse($autoriza($t + 29), 'antes de vencer, o pedinte ainda aguarda');
    self::assertTrue($autoriza($t + 31),  'vencido e vivo: o silêncio autoriza');
    self::assertTrue($autoriza($t + 89),  'último instante da sobrevida');
    self::assertFalse($autoriza($t + 91), 'morto: precisa pedir de novo');
}

public function testAprovacaoVencidaNaoAutorizaMais(): void
{
    $t = 1_800_000_000;
    $estado = [
        'pedidoUsuarioId' => 'user-b',
        'pedidoStatus'    => 'aprovado',
        'pedidoExpiraEm'  => gmdate('Y-m-d H:i:s', $t + 30),
    ];
    $metodo = new ReflectionMethod(LiveStateService::class, 'pedidoAutoriza');
    $metodo->setAccessible(true);

    self::assertTrue($metodo->invoke($this->servicoComRelogio($t + 29), $estado, 'user-b'));
    self::assertFalse($metodo->invoke($this->servicoComRelogio($t + 31), $estado, 'user-b'),
        'aprovação não pode virar autorização eterna');
}

public function testPedidoDeOutraBandaNaoAfetaEsta(): void
{
    $service = $this->servicoComRelogio(1_800_000_000);
    $service->assumirHost($this->outraBandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    // Sala desta banda continua vazia: o claim de qualquer um passa.
    self::assertTrue($service->assumirHost($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana'])['success']);
}

- [ ] **Passo 2: rodar e ver falhar.**

- [ ] **Passo 3: implementar**

```php
public function pedirControle(string $salaId, array $usuario): array {
    try { $salaId = $this->validarSalaId($salaId); }
    catch (InvalidArgumentException $e) { return $this->err400($e->getMessage()); }

    $usuarioId = (string)($usuario['id'] ?? '');

    return $this->withState($salaId, LOCK_EX, function ($state) use ($usuarioId, $usuario) {
        $temHost = ($state['hostId'] ?? '') !== '' && !$this->venceu($state['leaseExpiraEm'] ?? null);
        if (!$temHost) {
            http_response_code(400);
            return ['state' => null, 'result' => [
                'success' => false, 'code' => 'sem_host',
                'message' => 'Não há host agora — assuma o comando direto',
            ]];
        }
        if ((string)($state['hostUserId'] ?? '') === $usuarioId) {
            http_response_code(400);
            return ['state' => null, 'result' => [
                'success' => false, 'code' => 'ja_e_host',
                'message' => 'Você já está no comando',
            ]];
        }

        if ($this->pedidoVivo($state)) {
            // Repetição do próprio pedido: idempotente, sem empurrar a janela.
            if ((string)($state['pedidoUsuarioId'] ?? '') === $usuarioId
                && (string)($state['pedidoStatus'] ?? '') === 'pendente') {
                return ['state' => null, 'result' => [
                    'success' => true, 'expiraEm' => (string)$state['pedidoExpiraEm'],
                    'serverTime' => $this->instante(),
                ]];
            }
            http_response_code(409);
            return ['state' => null, 'result' => [
                'success' => false, 'code' => 'pedido_em_curso',
                'message' => 'Já existe um pedido de controle em andamento',
            ]];
        }

        $state['pedidoUsuarioId'] = $usuarioId;
        $state['pedidoNome']      = (string)($usuario['nome'] ?? '');
        $state['pedidoExpiraEm']  = $this->instante(self::PEDIDO_SEGUNDOS);
        $state['pedidoStatus']    = 'pendente';

        return ['state' => $state, 'result' => [
            'success' => true, 'expiraEm' => $state['pedidoExpiraEm'],
            'serverTime' => $this->instante(),
        ]];
    });
}

/**
 * Pedido vivo = ainda produz efeito. Pendente sobrevive à própria janela por
 * SOBREVIDA_PEDIDO_SEGUNDOS porque nesse intervalo ele autoriza o claim do
 * dono; aprovado e negado morrem ao vencer.
 */
private function pedidoVivo(array $state): bool {
    $status = (string)($state['pedidoStatus'] ?? '');
    if ($status === '') return false;
    $expira = $state['pedidoExpiraEm'] ?? null;
    return $status === 'pendente'
        ? !$this->venceu($expira, self::SOBREVIDA_PEDIDO_SEGUNDOS)
        : !$this->venceu($expira);
}
```

- [ ] **Passo 4: criar `public/api/live/request.php`** — mesmo corpo do `release.php` da Task 5, trocando a última linha por:

```php
echo json_encode($service->pedirControle($salaId, $_SESSION['usuario'] ?? []));
```

- [ ] **Passo 5: rodar e ver passar.** Depois a suíte PHP inteira.

- [ ] **Passo 6: checkpoint.**

---

## Task 7: Aceitar ou negar

**Arquivos:**
- Modificar: `public/src/Services/LiveStateService.php`
- Criar: `public/api/live/answer.php`
- Teste: `tests/php/LiveStateServiceTest.php`

**Produz:** `responderPedido(string $salaId, string $usuarioId, bool $aceitar): array`.

- [ ] **Passo 1: testes que falham**

```php
public function testAceitePermiteOClaimDoPedinte(): void
{
    $service = $this->servicoComRelogio(1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertTrue($service->responderPedido($this->bandaId, 'user-a', true)['success']);
    self::assertTrue($service->assumirHost($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana'])['success']);
}

public function testAprovacaoEhNominalETerceiroNaoAssume(): void
{
    $service = $this->servicoComRelogio(1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);
    $service->responderPedido($this->bandaId, 'user-a', true);

    self::assertFalse($service->assumirHost($this->bandaId, ['id' => 'user-c', 'nome' => 'Rui'])['success']);
}

public function testNegarImpedeATomada(): void
{
    $t = 1_800_000_000;
    $service = $this->servicoComRelogio($t);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);
    $service->responderPedido($this->bandaId, 'user-a', false);

    $r = $this->servicoComRelogio($t + 31)
        ->assumirHost($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertFalse($r['success'], 'negação vale: só o silêncio entrega o comando');
}

public function testNovoPedidoDuranteOCooldownRecebe409(): void
{
    $t = 1_800_000_000;
    $service = $this->servicoComRelogio($t);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);
    $service->responderPedido($this->bandaId, 'user-a', false);

    $r = $this->servicoComRelogio($t + 10)
        ->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertSame('pedido_em_curso', $r['code']);
}

public function testNovoPedidoUmSegundoDepoisDoCooldownEhAceito(): void
{
    $t = 1_800_000_000;
    $service = $this->servicoComRelogio($t);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);
    $service->responderPedido($this->bandaId, 'user-a', false);

    // Cooldown termina em t+31 (negação reescreve expira_em para agora+30).
    // O lease de user-a vence em t+90, então ainda há host: o pedido é válido.
    $r = $this->servicoComRelogio($t + 32)
        ->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertTrue($r['success']);
}

public function testQuemNaoEHostNaoResponde(): void
{
    $service = $this->servicoComRelogio(1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    $r = $service->responderPedido($this->bandaId, 'user-c', true);

    self::assertSame('nao_e_host', $r['code']);
}

public function testResponderSemPedidoPendenteRecebe409(): void
{
    $service = $this->servicoComRelogio(1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    self::assertSame('sem_pedido', $service->responderPedido($this->bandaId, 'user-a', true)['code']);
}

public function testResponderPedidoJaVencidoRecebe409(): void
{
    $t = 1_800_000_000;
    $service = $this->servicoComRelogio($t);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    $r = $this->servicoComRelogio($t + 31)->responderPedido($this->bandaId, 'user-a', true);

    self::assertSame('sem_pedido', $r['code'], 'a janela passou e o pedinte já pode ter assumido');
}
```

- [ ] **Passo 2: rodar e ver falhar.**

- [ ] **Passo 3: implementar**

```php
public function responderPedido(string $salaId, string $usuarioId, bool $aceitar): array {
    try { $salaId = $this->validarSalaId($salaId); }
    catch (InvalidArgumentException $e) { return $this->err400($e->getMessage()); }

    return $this->withState($salaId, LOCK_EX, function ($state) use ($usuarioId, $aceitar) {
        $temHost = ($state['hostId'] ?? '') !== '' && !$this->venceu($state['leaseExpiraEm'] ?? null);
        if (!$temHost || (string)($state['hostUserId'] ?? '') !== $usuarioId) {
            http_response_code(409);
            return ['state' => null, 'result' => [
                'success' => false, 'code' => 'nao_e_host',
                'message' => 'Apenas o host atual pode responder ao pedido',
            ]];
        }

        // Só pedido pendente e dentro da própria janela pode ser respondido:
        // depois dela o pedinte já pode ter assumido pelo silêncio, e uma
        // resposta tardia não pode desfazer isso.
        $pendenteNoPrazo = (string)($state['pedidoStatus'] ?? '') === 'pendente'
            && !$this->venceu($state['pedidoExpiraEm'] ?? null);
        if (!$pendenteNoPrazo) {
            http_response_code(409);
            return ['state' => null, 'result' => [
                'success' => false, 'code' => 'sem_pedido',
                'message' => 'Não há pedido de controle aguardando resposta',
            ]];
        }

        if ($aceitar) {
            $state['pedidoStatus'] = 'aprovado';
        } else {
            // A negação reescreve a expiração: o mesmo campo passa a marcar o
            // fim do cooldown e a janela em que o pedinte lê "negado".
            $state['pedidoStatus']   = 'negado';
            $state['pedidoExpiraEm'] = $this->instante(self::PEDIDO_SEGUNDOS);
        }

        return ['state' => $state, 'result' => [
            'success' => true, 'status' => $state['pedidoStatus'],
            'serverTime' => $this->instante(),
        ]];
    });
}
```

- [ ] **Passo 4: criar `public/api/live/answer.php`** — mesmo molde, com leitura do corpo:

```php
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = $_POST;
$aceitar = filter_var($input['aceitar'] ?? false, FILTER_VALIDATE_BOOLEAN);

$salaId  = require_current_band_json();
$service = new LiveStateService(new LiveStateRepository());
echo json_encode($service->responderPedido($salaId, (string)($_SESSION['usuario']['id'] ?? ''), $aceitar));
```

- [ ] **Passo 5: rodar e ver passar.** Depois a suíte PHP inteira.

- [ ] **Passo 6: checkpoint.**

---

## Task 8: `status.php` e `update.php`

**Arquivos:**
- Modificar: `public/src/Services/LiveStateService.php` (`status`, `atualizar`)
- Modificar: `public/api/live/status.php`
- Teste: `tests/php/LiveStateServiceTest.php`

- [ ] **Passo 1: testes que falham**

```php
public function testStatusTrazServerTimeELeaseSemVazarHostId(): void
{
    $service = $this->servicoComRelogio($t = 1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    $s = $service->status($this->bandaId);

    self::assertSame(gmdate('Y-m-d H:i:s', $t), $s['serverTime']);
    self::assertSame(gmdate('Y-m-d H:i:s', $t + 90), $s['leaseExpiraEm']);
    self::assertArrayNotHasKey('hostId', $s, 'hostId é segredo e não pode sair no status');
}

public function testStatusTrazPedidoComSouEuDoPontoDeVistaDeQuemPergunta(): void
{
    $service = $this->servicoComRelogio(1_800_000_000);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);
    $service->pedirControle($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertTrue($service->status($this->bandaId, 'user-b')['pedido']['souEu']);
    self::assertFalse($service->status($this->bandaId, 'user-a')['pedido']['souEu']);
    self::assertSame('Ana', $service->status($this->bandaId, 'user-a')['pedido']['nome']);
}

public function testKeepAliveRenovaOLease(): void
{
    $t = 1_800_000_000;
    $service = $this->servicoComRelogio($t);
    $hostId = $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo'])['hostId'];

    $this->servicoComRelogio($t + 40)->atualizar($this->bandaId, $hostId, null, null, true);

    self::assertSame(gmdate('Y-m-d H:i:s', $t + 40 + 90),
        $this->servicoComRelogio($t + 40)->status($this->bandaId)['leaseExpiraEm']);
}

public function testHostIdInvalidoNaoRenovaLeaseETrazCode(): void
{
    $t = 1_800_000_000;
    $service = $this->servicoComRelogio($t);
    $service->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    $r = $this->servicoComRelogio($t + 40)->atualizar($this->bandaId, str_repeat('0', 32), null, null, true);

    self::assertFalse($r['success']);
    self::assertSame('nao_e_mais_host', $r['code']);
    self::assertSame(gmdate('Y-m-d H:i:s', $t + 90),
        $this->servicoComRelogio($t)->status($this->bandaId)['leaseExpiraEm'], 'lease intacto');
}
```

- [ ] **Passo 2: rodar e ver falhar.**

- [ ] **Passo 3: implementar**

Em `status(string $salaId, string $usuarioId = '')`, acrescentar ao array devolvido:

```php
'serverTime'    => $this->instante(),
'leaseExpiraEm' => $state['leaseExpiraEm'] ?? null,
'pedido'        => $this->pedidoVivo($state) ? [
    'nome'     => (string)($state['pedidoNome'] ?? ''),
    'status'   => (string)($state['pedidoStatus'] ?? ''),
    'expiraEm' => (string)($state['pedidoExpiraEm'] ?? ''),
    'souEu'    => $usuarioId !== '' && (string)($state['pedidoUsuarioId'] ?? '') === $usuarioId,
] : null,
```

Conferir que `hostId` **não** está entre as chaves devolvidas por `status()`.

Em `atualizar()`, no ramo de host inválido, acrescentar `'code' => 'nao_e_mais_host'`. No ramo de sucesso, gravar `$state['leaseExpiraEm'] = $this->instante(self::LEASE_SEGUNDOS)` sempre que `$changed || $keepAlive`, e acrescentar `serverTime`, `leaseExpiraEm` e o bloco `pedido` ao resultado.

Em `public/api/live/status.php`, passar o usuário da sessão:

```php
echo json_encode($service->status($salaId, (string)($_SESSION['usuario']['id'] ?? '')));
```

- [ ] **Passo 4: rodar e ver passar.** Depois a suíte PHP inteira.

- [ ] **Passo 5: checkpoint.**

---

## Task 9: Guarda contra decisão de tempo em SQL

**Arquivos:**
- Teste: `tests/php/LiveStateRelogioTest.php`

**Por quê:** se alguém trocar a comparação para `NOW()`, toda a matriz de bordas continua verde medindo o relógio do MySQL. Este teste falha nesse caso.

- [ ] **Passo 1: escrever o teste**

```php
public function testDecisaoDePosseNaoUsaORelogioDoBanco(): void
{
    // Grava com o relógio real e decide com a fonte adiantada em 120s.
    // Se a comparação acontecer em SQL, o MySQL usará o próprio relógio,
    // o lease constará como vivo, e o claim de outro usuário será recusado.
    $agoraReal = time();
    $this->servicoComRelogio($agoraReal)
        ->assumirHost($this->bandaId, ['id' => 'user-a', 'nome' => 'Léo']);

    $r = $this->servicoComRelogio($agoraReal + 120)
        ->assumirHost($this->bandaId, ['id' => 'user-b', 'nome' => 'Ana']);

    self::assertTrue($r['success'], 'a posse foi decidida pelo relógio do banco, não pela fonte injetada');
}
```

- [ ] **Passo 2: rodar** — deve PASSAR com a implementação das tasks anteriores. Se falhar, há comparação de data em SQL: encontre e mova para PHP.

- [ ] **Passo 3: provar que o teste tem dente** — trocar temporariamente uma comparação por `NOW()` em SQL, rodar e ver falhar, depois desfazer. Um teste que nunca falhou não protege nada.

- [ ] **Passo 4: checkpoint.**

---

## Task 10: Rate limit

**Arquivos:**
- Modificar: `public/api/live/host.php`, `request.php`, `answer.php`
- Teste: `tests/php/LiveRateLimitTest.php`

**Limites:** `live.claim` e `live.request` a 30 por 60s; `live.answer` a 60 por 60s. Identidade = usuário + banda.

**Por quê 30 e não 10:** os specs de live somam cerca de oito claims do mesmo administrador em sequência. Teto baixo estouraria de forma intermitente e apareceria como teste "flaky".

- [ ] **Passo 1: teste que falha**

```php
public function testEstouroDeClaimDevolve429(): void
{
    $identidade = 'user-a|' . $this->bandaId;
    cifro_rate_limit_reset('live.claim', $identidade);

    for ($i = 0; $i < 30; $i++) {
        self::assertTrue(cifro_rate_limit('live.claim', 30, 60, $identidade), "chamada $i deveria passar");
    }
    self::assertFalse(cifro_rate_limit('live.claim', 30, 60, $identidade), 'a 31ª deve estourar');
}
```

- [ ] **Passo 2: rodar** — verifica o helper antes de acoplá-lo aos endpoints.

- [ ] **Passo 3: aplicar nos três endpoints**, logo após `require_live_host()`:

```php
$identidade = (string)($_SESSION['usuario']['id'] ?? '') . '|' . current_band_id();
if (!cifro_rate_limit('live.claim', 30, 60, $identidade)) {
    http_response_code(429);
    echo json_encode(['success' => false, 'code' => 'muitas_tentativas',
                      'message' => 'Muitas tentativas. Aguarde um instante.']);
    exit;
}
```

Trocar `live.claim` por `live.request` (30/60) e `live.answer` (60/60) nos respectivos arquivos.

- [ ] **Passo 4: rodar a suíte PHP inteira.**

- [ ] **Passo 5: checkpoint.**

---

## Task 11: Hook de reset e isolamento dos testes

**Arquivos:**
- Criar: `public/api/testing/reset-live.php`
- Criar: `tests/helpers/live.js`
- Modificar: `tests/cifro/13-live-mode.spec.js`, `23-perfis-permissoes.spec.js`, `28-interacoes-palco.spec.js`

**Por quê:** os arquivos rodam em ordem alfabética com `workers: 1`. `23-perfis-permissoes.spec.js:281` faz o **básico** assumir o host, segurando o lease por 90s; em seguida `28-interacoes-palco.spec.js:132` faz o **administrador** clicar em "Virar Host" esperando 200 — e receberia 409. Com `retries: 1` isso apareceria como "flaky", não como falha limpa.

- [ ] **Passo 1: criar o endpoint de reset**

```php
<?php
// public/api/testing/reset-live.php
// Só existe em APP_ENV=test. Zera a posse da live da banda e os contadores de
// rate limit, para que a ordem de execução dos specs não contamine o estado.
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (env('APP_ENV', 'production') !== 'test') {
    http_response_code(404);
    echo json_encode(['ok' => false]);
    exit;
}

require_auth_json();
$bandaId = current_band_id();
if ($bandaId === '') { echo json_encode(['ok' => true]); exit; }

Database::getConnection()
    ->prepare('UPDATE live_state SET host_id=NULL, host_user_id=NULL, host_nome=NULL,
               lease_expira_em=NULL, pedido_usuario_id=NULL, pedido_nome=NULL,
               pedido_expira_em=NULL, pedido_status=NULL WHERE banda_id=?')
    ->execute([$bandaId]);

$identidade = (string)($_SESSION['usuario']['id'] ?? '') . '|' . $bandaId;
foreach (['live.claim', 'live.request', 'live.answer'] as $acao) {
    cifro_rate_limit_reset($acao, $identidade);
}

echo json_encode(['ok' => true]);
```

- [ ] **Passo 2: criar o helper de teste**

```js
// tests/helpers/live.js
/**
 * Zera a posse da live antes do cenário. `live_state` é uma linha por banda e
 * o lease dura 90s, então sem isto um spec que assume o host contamina o
 * seguinte — e com retries isso aparece como "flaky", não como falha.
 */
export async function resetarLive(page) {
  await page.request.post('/api/testing/reset-live.php');
}
```

- [ ] **Passo 3: chamar nos três specs**

Em `13-live-mode.spec.js`, `23-perfis-permissoes.spec.js` e `28-interacoes-palco.spec.js`, importar o helper e acrescentar, sem tocar em nenhuma asserção:

```js
test.beforeEach(async ({ page }) => { await resetarLive(page); });
```

- [ ] **Passo 4: rodar os três specs** e confirmar verde:

```bash
npx playwright test --project=cifro tests/cifro/13-live-mode.spec.js tests/cifro/23-perfis-permissoes.spec.js tests/cifro/28-interacoes-palco.spec.js --reporter=line
```

- [ ] **Passo 5: confirmar que o endpoint some fora de teste** — com `APP_ENV=production`, `reset-live.php` responde 404.

- [ ] **Passo 6: checkpoint.**

---

## Task 12: Cliente — a verdade ao host deposto

**Arquivos:**
- Modificar: `public/src/js/live.js`
- Teste: `tests/cifro/81-live-posse-do-host.spec.js`

**Consome:** Task 8 (`code: nao_e_mais_host`).

- [ ] **Passo 1: teste que falha**

```js
test('host deposto ouve a verdade, não "Live desconectada"', async ({ page }) => {
  await page.route('**/api/live/host.php', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, hostId: 'host-1', hostNome: 'Léo' }),
  }));
  await page.goto('/index.php');
  await page.evaluate(() => window.LiveMode.assumirHost());
  await expect(page.locator('#liveStatus')).toHaveText('Voce e o host');

  await page.route('**/api/live/update.php', route => route.fulfill({
    status: 403, contentType: 'application/json',
    body: JSON.stringify({ success: false, code: 'nao_e_mais_host',
                           message: 'Apenas o host atual pode atualizar a live' }),
  }));
  await page.evaluate(() => window.LiveMode.atualizarHost(true));

  await expect(page.locator('#liveStatus')).toHaveText('Voce nao e mais o host');
});

test('erro de rede genérico continua exibindo Live desconectada', async ({ page }) => {
  await page.route('**/api/live/host.php', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, hostId: 'host-1', hostNome: 'Léo' }),
  }));
  await page.goto('/index.php');
  await page.evaluate(() => window.LiveMode.assumirHost());

  await page.route('**/api/live/update.php', route => route.abort('failed'));
  await page.evaluate(() => window.LiveMode.atualizarHost(true));

  await expect(page.locator('#liveStatus')).toContainText('Live desconectada');
});
```

- [ ] **Passo 2: rodar e ver falhar** — hoje o primeiro mostra "Live desconectada".

- [ ] **Passo 3: preservar `status` e `code` no erro**

```js
    async function postJson(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({ success: false }));
        if (!response.ok || !data.success) {
            // O servidor já diz por que recusou. Descartar isso aqui é o que
            // fazia o host deposto procurar problema de rede.
            const erro = new Error(data.message || 'Erro na live');
            erro.status = response.status;
            erro.code = data.code || '';
            throw erro;
        }
        return data;
    }
```

- [ ] **Passo 4: distinguir os dois casos no `atualizarHost`**

Substituir o `catch (error) { setDisconnectedStatus(); }` de `atualizarHost` por:

```js
        } catch (error) {
            if (error && error.code === 'nao_e_mais_host') {
                setMode('');
                stopKeepAlive();
                setStatus('Voce nao e mais o host', 'offline');
                renderButtons();
                renderLiveIndicator();
                return;
            }
            setDisconnectedStatus();
        } finally {
            hostBusy = false;
        }
```

- [ ] **Passo 5: expor `atualizarHost` em `window.LiveMode`** se ainda não estiver, para o teste poder dispará-lo.

- [ ] **Passo 6: `keepAliveMs` de 15000 para 30000.**

> **Atenção:** o valor atual é 15s, não 30s. Dobrar o intervalo pode afetar testes que esperam um tique de keepAlive. Rode `13-live-mode.spec.js` inteiro depois desta mudança e verifique especialmente "reconexão à internet enquanto host retoma atualização da sessão". Se algum depender do intervalo, ajuste a espera do teste — não o valor da constante, que vem do spec.

- [ ] **Passo 7: rodar `81-live-posse-do-host.spec.js` e `13-live-mode.spec.js`.**

- [ ] **Passo 8: checkpoint.**

---

## Task 13: Cliente — pedir, aceitar, negar

**Arquivos:**
- Modificar: `public/src/js/live.js`
- Teste: `tests/cifro/81-live-posse-do-host.spec.js`

- [ ] **Passo 1: teste que falha**

```js
test('recusa mostra quem está no comando e oferece pedir controle', async ({ page }) => {
  await page.route('**/api/live/host.php', route => route.fulfill({
    status: 409, contentType: 'application/json',
    body: JSON.stringify({ success: false, code: 'sala_ocupada', hostNome: 'Léo',
                           message: 'Outra pessoa está no comando da live' }),
  }));
  await page.goto('/index.php');
  await page.evaluate(() => window.LiveMode.assumirHost());

  await expect(page.locator('#liveStatus')).toContainText('Léo');
  await expect(page.getByRole('button', { name: 'Pedir controle' })).toBeVisible();
});
```

- [ ] **Passo 2: rodar e ver falhar.**

- [ ] **Passo 3: tratar o 409 no `assumirHost` do cliente** — ao receber `code === 'sala_ocupada'`, exibir `'Live com ' + data.hostNome` e revelar o botão "Pedir controle", que faz `POST /api/live/request.php`.

- [ ] **Passo 4: uma função única que reage ao bloco `pedido`**

Chamada tanto de `consultarStatus` quanto do retorno de `atualizarHost`, porque host e seguidor descobrem o pedido por caminhos diferentes:

```js
    // Guarda contra reabrir o mesmo diálogo a cada poll: identifica o pedido
    // pela expiração, que é única por pedido.
    let pedidoJaTratado = '';

    async function reagirAoPedido(data) {
        const pedido = data && data.pedido;
        if (!pedido) { pedidoJaTratado = ''; return; }

        const assinatura = pedido.status + '|' + pedido.expiraEm;
        if (assinatura === pedidoJaTratado) return;

        // Nunca compara com o relógio local: os dois instantes vêm do servidor.
        const venceu = Date.parse(data.serverTime + 'Z') >= Date.parse(pedido.expiraEm + 'Z');

        if (!pedido.souEu && pedido.status === 'pendente' && !venceu && getMode() === 'host') {
            pedidoJaTratado = assinatura;
            const aceitar = await cifroConfirm({
                title: pedido.nome + ' quer o controle',
                message: 'Passar o comando da live para ' + pedido.nome + '?',
                confirmText: 'Aceitar', cancelText: 'Negar', danger: false, icon: '🎤'
            });
            await postJson(apiBase + '/answer.php', { aceitar: !!aceitar }).catch(function () {});
            return;
        }

        if (!pedido.souEu) return;

        if (pedido.status === 'aprovado') {
            pedidoJaTratado = assinatura;
            await assumirHost();
            return;
        }
        if (pedido.status === 'negado') {
            pedidoJaTratado = assinatura;
            setStatus('Pedido negado', 'offline');
            return;
        }
        if (pedido.status === 'pendente' && venceu) {
            pedidoJaTratado = assinatura;
            const seguir = await cifroConfirm({
                title: 'Ninguém respondeu',
                message: 'O host não respondeu ao seu pedido. Assumir o comando mesmo assim?',
                confirmText: 'Assumir', cancelText: 'Cancelar', danger: false, icon: '⏱️'
            });
            if (seguir) await assumirHost();
        }
    }
```

- [ ] **Passo 5: ligar a função nos dois caminhos**

Em `consultarStatus`, logo após obter `status` com sucesso, e em `atualizarHost`, logo após `setLiveOk()`:

```js
            await reagirAoPedido(data);
```

Em `consultarStatus` a variável é `status`, não `data` — use o nome que existe no escopo.

- [ ] **Passo 6: rodar `81-live-posse-do-host.spec.js`.**

- [ ] **Passo 7: checkpoint.**

---

## Task 14: E2E de integração real

**Arquivos:**
- Modificar: `tests/cifro/81-live-posse-do-host.spec.js`

**Consome:** todas as anteriores. Dois contextos de navegador, dois usuários reais da mesma banda, HTTP real com CSRF.

- [ ] **Passo 1: escrever os cenários**

Helpers no topo do arquivo:

```js
import { test, expect } from '../fixtures/coverage.js';
import { resetarLive } from '../helpers/live.js';

const ADMIN   = 'tests/.auth/user.json';
const GESTOR  = 'tests/.auth/gestor.json';
const EXTERNO = 'tests/.auth/externo.json';

async function contexto(browser, storageState) {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  await page.goto('/index.php');
  return { context, page };
}

async function csrf(page) {
  return (await (await page.request.get('/api/csrf.php')).json()).token;
}

function postLive(page, arquivo, corpo = {}) {
  return csrf(page).then(token => page.request.post(`/api/live/${arquivo}`, {
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    data: JSON.stringify(corpo),
  }));
}

const claim    = page => postLive(page, 'host.php', { action: 'start' });
const pedir    = page => postLive(page, 'request.php');
const liberar  = page => postLive(page, 'release.php');
const responder = (page, aceitar) => postLive(page, 'answer.php', { aceitar });
```

> Confira o caminho e o formato do token em `13-live-mode.spec.js` — o helper `getCsrfToken` de lá é a fonte da verdade. Se ele usar outro endpoint ou outro campo, copie de lá em vez de usar o `csrf()` acima.

Cenários:

```js
test('B é recusado enquanto A está no comando', async ({ browser }) => {
  const a = await contexto(browser, ADMIN);
  const b = await contexto(browser, GESTOR);
  try {
    await resetarLive(a.page);
    expect((await claim(a.page)).status()).toBe(200);

    const recusa = await claim(b.page);
    expect(recusa.status()).toBe(409);
    expect((await recusa.json()).hostNome).toBeTruthy();
  } finally { await a.context.close(); await b.context.close(); }
});

test('A aceita o pedido, B assume, e A descobre no próximo update', async ({ browser }) => {
  const a = await contexto(browser, ADMIN);
  const b = await contexto(browser, GESTOR);
  try {
    await resetarLive(a.page);
    const hostIdDeA = (await (await claim(a.page)).json()).hostId;

    expect((await pedir(b.page)).status()).toBe(200);
    expect((await responder(a.page, true)).status()).toBe(200);
    expect((await claim(b.page)).status()).toBe(200);

    const update = await postLive(a.page, 'update.php', { hostId: hostIdDeA, keepAlive: true });
    expect(update.status()).toBe(403);
    expect((await update.json()).code).toBe('nao_e_mais_host');
  } finally { await a.context.close(); await b.context.close(); }
});

test('A nega e B continua fora', async ({ browser }) => {
  const a = await contexto(browser, ADMIN);
  const b = await contexto(browser, GESTOR);
  try {
    await resetarLive(a.page);
    await claim(a.page);
    await pedir(b.page);
    expect((await responder(a.page, false)).status()).toBe(200);

    expect((await claim(b.page)).status()).toBe(409);
  } finally { await a.context.close(); await b.context.close(); }
});

test('A libera e B assume direto, sem pedir', async ({ browser }) => {
  const a = await contexto(browser, ADMIN);
  const b = await contexto(browser, GESTOR);
  try {
    await resetarLive(a.page);
    await claim(a.page);
    expect((await liberar(a.page)).status()).toBe(200);

    expect((await claim(b.page)).status()).toBe(200);
  } finally { await a.context.close(); await b.context.close(); }
});

test('quem não é host não libera nem responde', async ({ browser }) => {
  const a = await contexto(browser, ADMIN);
  const b = await contexto(browser, GESTOR);
  try {
    await resetarLive(a.page);
    await claim(a.page);
    await pedir(b.page);

    expect((await liberar(b.page)).status()).toBe(409);
    expect((await responder(b.page, true)).status()).toBe(409);
  } finally { await a.context.close(); await b.context.close(); }
});

test('externo recebe 403, nunca 409', async ({ browser }) => {
  const a = await contexto(browser, ADMIN);
  const e = await contexto(browser, EXTERNO);
  try {
    await resetarLive(a.page);
    await claim(a.page);

    // 403 é "seu perfil não hospeda". Se vier 409, a permissão está sendo
    // confundida com disponibilidade da sala.
    expect((await claim(e.page)).status()).toBe(403);
  } finally { await a.context.close(); await e.context.close(); }
});
```

- [ ] **Passo 2: rodar e ver falhar/passar por cenário.**

- [ ] **Passo 3: rodar o arquivo inteiro.**

- [ ] **Passo 4: checkpoint.**

---

## Task 15: Atualizar os três testes da regra antiga

**Arquivos:**
- Modificar: `tests/cifro/23-perfis-permissoes.spec.js:281`
- Modificar: `tests/cifro/63-critical-real-user-journeys.spec.js:152` e `:214`

Estes três exigem 200 num claim que, sob a regra nova, pode legitimamente receber 409 quando outra pessoa está no comando. Com o `resetarLive` da Task 11 a sala estará livre e o 200 continua correto — **verifique isso primeiro**. Só altere o que ainda falhar.

- [ ] **Passo 1: rodar os três com tudo implementado** e registrar quais falham de fato.

- [ ] **Passo 2: para os que falharem**, deixar explícito o que o cenário exercita:

```js
test('basico PODE iniciar host quando a sala está livre', async ({ page }) => {
  await resetarLive(page);
  const csrf = await getCsrf(page);
  const host = await page.request.post('/api/live/host.php', {
    data: JSON.stringify({ action: 'start' }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  expect(host.status()).toBe(200);
});
```

- [ ] **Passo 3: acrescentar o contraponto** — o básico recusado quando a sala está ocupada por outro, para que a permissão de perfil e a disponibilidade da sala fiquem cobertas separadamente.

- [ ] **Passo 4: rodar a suíte `cifro` inteira** e comparar com a linha de base.

- [ ] **Passo 5: checkpoint final.**

---

## Verificação final

- [ ] `npm run test:unit:php` — verde
- [ ] `npx playwright test --project=cifro` — comparar com a linha de base anterior à etapa
- [ ] `C:/xampp/php/php.exe scripts/setup/migrate.php --status` — todas `applied`
- [ ] `GET /health.php?check=schema` — `200` com `pending_count: 0`
- [ ] Nenhum `NOW()`, `TIMESTAMPDIFF` ou `DATE_ADD` decidindo posse:
  `grep -rn "NOW()\|TIMESTAMPDIFF\|DATE_ADD" public/src/Services/LiveStateService.php public/src/Repositories/LiveStateRepository.php` — sem resultado
- [ ] `hostId` não aparece em `status.php`
