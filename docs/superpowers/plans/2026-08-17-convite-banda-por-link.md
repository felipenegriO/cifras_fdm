# Convite da banda por link compartilhável — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um botão "Convidar" na aba Membros gera um link de 24h que leva o músico a se cadastrar e entrar direto na banda, sem o administrador precisar saber o e-mail de ninguém.

**Architecture:** A tabela `banda_convites` guarda só o SHA-256 do token. `public/convite.php` é a porta de entrada pública e grava o convite pendente na sessão; `RegisterController`, `GoogleAuthService` e `AuthController::finalizeLogin` leem essa sessão e vinculam à banda convidada em vez de criar uma banda nova. `BandaConviteFlow` é o único lugar que cria o vínculo e conta a entrada.

**Tech Stack:** PHP 8 sem framework, MySQL/PDO, JavaScript de navegador em IIFE, PHPUnit 9.6, Playwright, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-16-convite-banda-por-link-design.md`
**Backlog:** ROLE-003

## Global Constraints

- **Nunca commitar.** O Felipe commita. Toda tarefa termina em "Pare para revisão", nunca em `git commit`.
- Validade do convite: **24 horas** (`BandaConvitePolicy::TTL_SEGUNDOS = 86400`). Usos ilimitados.
- Perfil de quem entra pelo link: sempre **`basico`** (`BandaConvitePolicy::PERFIL`).
- Token: 32 bytes aleatórios (`bin2hex(random_bytes(32))`), gravado apenas como `hash('sha256', $token)`.
- Toda falha de convite (inválido, expirado, revogado, banda desativada) mostra **a mesma mensagem neutra** e **nunca** revela o nome da banda: `Este convite não é mais válido. Peça um novo ao administrador da banda.`
- Gerar e revogar exigem `require_band_role('administrador')` + `require_csrf()`.
- O aceite é **POST com CSRF**, nunca GET.
- Schema entra em **dois lugares**: `create_tables.sql` (baseline) e `migrations/` (idempotente). Ver DEBT-001 e DEBT-002 no `backlog.md`.
- Textos de interface em português do Brasil. Nomes de teste em linguagem de negócio, em português.
- Comandos de teste:
  - PHPUnit inteiro: `npm run test:unit:php`
  - PHPUnit filtrado: `C:/xampp/php/php.exe public/vendor/bin/phpunit --filter NomeDoTeste`
  - JS unitário: `npm run test:unit:js`
  - Playwright: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js`

## Desvio consciente do spec

O spec diz, em "Gerar e compartilhar": *"Se já existe convite válido para a banda, ele é reaproveitado em vez de gerar outro."* **Isso é impossível** junto com a decisão de guardar apenas o hash do token: o valor em claro não existe no banco, então o link antigo não pode ser reconstruído para ser compartilhado de novo.

Resolução adotada: **cada toque em "Convidar" gera um token novo, e os anteriores continuam válidos até expirarem.** Revogar mata todos de uma vez. Isso evita o pior caso — o administrador tocar "Convidar" duas vezes e, sem perceber, matar o link que acabou de mandar no grupo.

Consequência: a linha de estado resume os convites vivos da banda (validade do mais recente, soma das entradas) em vez de descrever um convite único.

---

### Task 1: Tabela `banda_convites`

**Files:**
- Modify: `create_tables.sql` (após o bloco `auth_tokens`, que termina por volta da linha 211)
- Create: `migrations/20260817_banda_convites.sql`

**Interfaces:**
- Consumes: nada
- Produces: tabela `banda_convites` com `token CHAR(64)`, `banda_id CHAR(36)`, `criado_por CHAR(36) NULL`, `expira_em DATETIME`, `revogado_em DATETIME NULL`, `usos INT`, `criado_em TIMESTAMP`

- [ ] **Step 1: Criar a migration**

Crie `migrations/20260817_banda_convites.sql`:

```sql
-- Convite da banda por link compartilhável (ROLE-003). Guarda só o SHA-256 do
-- token; o valor em claro existe apenas dentro do link que circula no grupo,
-- mesmo padrão de password_reset_tokens.
CREATE TABLE IF NOT EXISTS banda_convites (
  token       CHAR(64)  NOT NULL,
  banda_id    CHAR(36)  NOT NULL,
  criado_por  CHAR(36)  DEFAULT NULL,
  expira_em   DATETIME  NOT NULL,
  revogado_em DATETIME  DEFAULT NULL,
  usos        INT       NOT NULL DEFAULT 0,
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token),
  KEY idx_convite_banda (banda_id),
  KEY idx_convite_expira (expira_em),
  FOREIGN KEY (banda_id)   REFERENCES bandas(id)   ON DELETE CASCADE,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 2: Acrescentar a mesma tabela ao baseline**

Em `create_tables.sql`, logo após o `CREATE TABLE IF NOT EXISTS auth_tokens (...);`, insira exatamente o mesmo `CREATE TABLE` do passo 1, com o comentário.

Os dois arquivos precisam ficar idênticos nesse trecho: foi a divergência entre baseline e script de setup que causou o incidente de 13/08 registrado em DEBT-001.

- [ ] **Step 3: Aplicar no banco de testes E2E**

Run: `npm run test:e2e:db:setup`
Expected: termina sem erro e imprime `✓ migration 20260817_banda_convites`.

- [ ] **Step 4: Conferir as colunas**

Run:
```bash
echo '{"sql":"DESCRIBE banda_convites","params":[]}' | C:/xampp/php/php.exe tests/helpers/db-query.php
```
Expected: JSON com as sete colunas — `token`, `banda_id`, `criado_por`, `expira_em`, `revogado_em`, `usos`, `criado_em`.

- [ ] **Step 5: Rodar de novo para provar idempotência**

Run: `npm run test:e2e:db:setup`
Expected: passa outra vez sem erro.

- [ ] **Step 6: Pare para revisão**

Mostre o diff de `create_tables.sql` e o arquivo novo. Não commite.

---

### Task 2: `BandaConvitePolicy` — regras puras

**Files:**
- Create: `public/src/Services/BandaConvitePolicy.php`
- Test: `tests/php/BandaConvitePolicyTest.php`

**Interfaces:**
- Consumes: nada
- Produces:
  - `BandaConvitePolicy::TTL_SEGUNDOS` (int `86400`)
  - `BandaConvitePolicy::PERFIL` (string `'basico'`)
  - `BandaConvitePolicy::estaValido(?array $convite, ?int $agora = null): bool`
  - `BandaConvitePolicy::expiraEm(?int $agora = null): string` — formato `Y-m-d H:i:s`
  - `BandaConvitePolicy::rotuloValidade(string $expiraEm): string` — formato `17/08 às 19h32`

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/php/BandaConvitePolicyTest.php`:

```php
<?php

use PHPUnit\Framework\TestCase;

final class BandaConvitePolicyTest extends TestCase
{
    private function convite(array $sobrescreve = []): array
    {
        return array_merge([
            'token' => str_repeat('a', 64),
            'banda_id' => 'banda-1',
            'expira_em' => date('Y-m-d H:i:s', time() + 3600),
            'revogado_em' => null,
            'usos' => 0,
        ], $sobrescreve);
    }

    public function testConviteDentroDoPrazoEhValido(): void
    {
        self::assertTrue(BandaConvitePolicy::estaValido($this->convite()));
    }

    public function testConviteRevogadoNaoVale(): void
    {
        self::assertFalse(BandaConvitePolicy::estaValido($this->convite(['revogado_em' => date('Y-m-d H:i:s')])));
    }

    public function testConviteExpiradoNaoVale(): void
    {
        self::assertFalse(BandaConvitePolicy::estaValido($this->convite(['expira_em' => date('Y-m-d H:i:s', time() - 1)])));
    }

    public function testConviteInexistenteNaoVale(): void
    {
        self::assertFalse(BandaConvitePolicy::estaValido(null));
    }

    public function testDataDeExpiracaoIlegivelNaoVale(): void
    {
        self::assertFalse(BandaConvitePolicy::estaValido($this->convite(['expira_em' => ''])));
        self::assertFalse(BandaConvitePolicy::estaValido($this->convite(['expira_em' => 'ontem à noite'])));
    }

    public function testFronteiraDasVinteEQuatroHoras(): void
    {
        $agora = 1700000000;
        $expira = BandaConvitePolicy::expiraEm($agora);

        self::assertSame(date('Y-m-d H:i:s', $agora + 86400), $expira);
        self::assertTrue(BandaConvitePolicy::estaValido(['expira_em' => $expira, 'revogado_em' => null], $agora + 86399));
        self::assertFalse(BandaConvitePolicy::estaValido(['expira_em' => $expira, 'revogado_em' => null], $agora + 86400));
    }

    public function testRotuloDeValidadeEhLegivelParaOAdministrador(): void
    {
        self::assertSame('17/08 às 19h32', BandaConvitePolicy::rotuloValidade('2026-08-17 19:32:00'));
        self::assertSame('', BandaConvitePolicy::rotuloValidade('data inválida'));
    }

    public function testQuemEntraPeloLinkRecebeSempreOPerfilBasico(): void
    {
        self::assertSame('basico', BandaConvitePolicy::PERFIL);
    }
}
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `C:/xampp/php/php.exe public/vendor/bin/phpunit --filter BandaConvitePolicyTest`
Expected: FAIL com `Error: Class "BandaConvitePolicy" not found`.

- [ ] **Step 3: Implementar**

Crie `public/src/Services/BandaConvitePolicy.php`:

```php
<?php
/**
 * Regras do convite de banda por link, sem banco e sem sessão.
 *
 * Fica separado do repositório de propósito: "este convite ainda vale?" é a
 * pergunta que register, Google e login fazem, e ela não deveria exigir um
 * banco de dados para ser respondida num teste.
 */
class BandaConvitePolicy
{
    /**
     * Validade do link, em segundos. 24h é curto de propósito: o link circula
     * em grupo de WhatsApp, e a janela apertada é o que substitui o limite de
     * usos que esta funcionalidade não tem.
     */
    public const TTL_SEGUNDOS = 86400;

    /** Perfil de quem entra pelo link. Promoção é feita depois, na lista de membros. */
    public const PERFIL = 'basico';

    public static function estaValido(?array $convite, ?int $agora = null): bool
    {
        if (!$convite) return false;
        if (!empty($convite['revogado_em'])) return false;

        $expira = strtotime((string) ($convite['expira_em'] ?? ''));
        if ($expira === false) return false;

        return $expira > ($agora ?? time());
    }

    public static function expiraEm(?int $agora = null): string
    {
        return date('Y-m-d H:i:s', ($agora ?? time()) + self::TTL_SEGUNDOS);
    }

    /** Rótulo curto para a linha de estado do administrador: "17/08 às 19h32". */
    public static function rotuloValidade(string $expiraEm): string
    {
        $quando = strtotime($expiraEm);
        if ($quando === false) return '';
        return date('d/m', $quando) . ' às ' . date('H\hi', $quando);
    }
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `C:/xampp/php/php.exe public/vendor/bin/phpunit --filter BandaConvitePolicyTest`
Expected: PASS, 8 testes.

- [ ] **Step 5: Pare para revisão**

Não commite.

---

### Task 3: `BandaConviteRepository` — persistência

**Files:**
- Create: `public/src/Repositories/BandaConviteRepository.php`
- Test: `tests/php/BandaConviteRepositoryTest.php`

**Interfaces:**
- Consumes: `BandaConvitePolicy::expiraEm()` (Task 2), tabela `banda_convites` (Task 1)
- Produces:
  - `new BandaConviteRepository(?PDO $pdo = null)`
  - `gerar(string $bandaId, ?string $criadoPor = null, ?int $agora = null): string` — devolve o token **em claro**
  - `buscarPorToken(string $token): ?array` — linha bruta, **sem validar**
  - `resumoDaBanda(string $bandaId): ?array` — `['ativos' => int, 'expira_em' => string, 'usos' => int]` ou `null`
  - `revogarDaBanda(string $bandaId): void`
  - `registrarUso(string $token): void`

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/php/BandaConviteRepositoryTest.php`. Usa banco real dentro de transação com rollback, no padrão de `tests/php/RepositoryIntegrationTest.php`:

```php
<?php

use PHPUnit\Framework\TestCase;

final class BandaConviteRepositoryTest extends TestCase
{
    private PDO $pdo;
    private string $bandaId;
    private string $adminId;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();

        $sufixo = bin2hex(random_bytes(8));
        $this->bandaId = 'convite-banda-' . $sufixo;
        $this->adminId = 'convite-admin-' . $sufixo;

        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?,?,?)')
            ->execute([$this->bandaId, 'Banda do Convite', 'mensal']);
        $this->pdo->prepare('INSERT INTO usuarios (id, nome, email, perfil, ativo) VALUES (?,?,?,?,?)')
            ->execute([$this->adminId, 'Admin', $sufixo . '@convite.local', 'usuario', 1]);
        $this->pdo->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)')
            ->execute([$this->adminId, $this->bandaId, 'administrador']);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) $this->pdo->rollBack();
    }

    public function testOTokenEmClaroNuncaChegaAoBanco(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $token = $repo->gerar($this->bandaId, $this->adminId);

        self::assertSame(64, strlen($token), 'token em claro tem 32 bytes em hexadecimal');

        $stmt = $this->pdo->prepare('SELECT token FROM banda_convites WHERE banda_id = ?');
        $stmt->execute([$this->bandaId]);
        $gravado = $stmt->fetchColumn();

        self::assertNotSame($token, $gravado, 'o banco não pode guardar o token em claro');
        self::assertSame(hash('sha256', $token), $gravado);
    }

    public function testConviteRecemGeradoEhEncontradoPeloTokenEmClaro(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $token = $repo->gerar($this->bandaId, $this->adminId);

        $convite = $repo->buscarPorToken($token);

        self::assertNotNull($convite);
        self::assertSame($this->bandaId, $convite['banda_id']);
        self::assertSame($this->adminId, $convite['criado_por']);
        self::assertSame(0, (int) $convite['usos']);
        self::assertNull($convite['revogado_em']);
    }

    public function testTokenInventadoNaoEncontraNada(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        self::assertNull($repo->buscarPorToken(str_repeat('f', 64)));
    }

    public function testGerarDeNovoNaoMataOLinkJaCompartilhado(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $primeiro = $repo->gerar($this->bandaId, $this->adminId);
        $segundo  = $repo->gerar($this->bandaId, $this->adminId);

        self::assertNotSame($primeiro, $segundo);
        self::assertTrue(BandaConvitePolicy::estaValido($repo->buscarPorToken($primeiro)));
        self::assertTrue(BandaConvitePolicy::estaValido($repo->buscarPorToken($segundo)));
    }

    public function testRevogarDerrubaTodosOsConvitesDaBandaDeUmaVez(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $primeiro = $repo->gerar($this->bandaId, $this->adminId);
        $segundo  = $repo->gerar($this->bandaId, $this->adminId);

        $repo->revogarDaBanda($this->bandaId);

        self::assertFalse(BandaConvitePolicy::estaValido($repo->buscarPorToken($primeiro)));
        self::assertFalse(BandaConvitePolicy::estaValido($repo->buscarPorToken($segundo)));
        self::assertNull($repo->resumoDaBanda($this->bandaId));
    }

    public function testResumoContaOsConvitesVivosESomaAsEntradas(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $primeiro = $repo->gerar($this->bandaId, $this->adminId);
        $segundo  = $repo->gerar($this->bandaId, $this->adminId);

        $repo->registrarUso($primeiro);
        $repo->registrarUso($primeiro);
        $repo->registrarUso($segundo);

        $resumo = $repo->resumoDaBanda($this->bandaId);

        self::assertNotNull($resumo);
        self::assertSame(2, $resumo['ativos']);
        self::assertSame(3, $resumo['usos']);
        self::assertNotSame('', BandaConvitePolicy::rotuloValidade($resumo['expira_em']));
    }

    public function testBandaSemConviteNaoTemResumo(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        self::assertNull($repo->resumoDaBanda($this->bandaId));
    }

    public function testConviteVencidoSaiDoResumo(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $token = $repo->gerar($this->bandaId, $this->adminId);

        $this->pdo->prepare('UPDATE banda_convites SET expira_em = ? WHERE token = ?')
            ->execute([date('Y-m-d H:i:s', time() - 60), hash('sha256', $token)]);

        self::assertNull($repo->resumoDaBanda($this->bandaId));
        self::assertFalse(BandaConvitePolicy::estaValido($repo->buscarPorToken($token)));
    }
}
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `C:/xampp/php/php.exe public/vendor/bin/phpunit --filter BandaConviteRepositoryTest`
Expected: FAIL com `Error: Class "BandaConviteRepository" not found`.

- [ ] **Step 3: Implementar**

Crie `public/src/Repositories/BandaConviteRepository.php`:

```php
<?php
/**
 * Convites de banda por link (ROLE-003).
 *
 * Guarda só o SHA-256 do token, como password_reset_tokens: o valor em claro
 * existe apenas dentro do link que o administrador compartilha. A consequência
 * é que um link já compartilhado NÃO pode ser recuperado do banco — por isso
 * gerar de novo não revoga o anterior, senão tocar "Convidar" duas vezes
 * mataria em silêncio o link recém-enviado ao grupo.
 */
class BandaConviteRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::getConnection();
    }

    /** Cria um convite e devolve o token EM CLARO — única chance de vê-lo. */
    public function gerar(string $bandaId, ?string $criadoPor = null, ?int $agora = null): string
    {
        $token = bin2hex(random_bytes(32));
        $this->pdo->prepare(
            'INSERT INTO banda_convites (token, banda_id, criado_por, expira_em) VALUES (?,?,?,?)'
        )->execute([
            $this->hash($token),
            $bandaId,
            $criadoPor ?: null,
            BandaConvitePolicy::expiraEm($agora),
        ]);
        return $token;
    }

    /** Linha bruta do convite. NÃO decide se vale — quem decide é BandaConvitePolicy. */
    public function buscarPorToken(string $token): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM banda_convites WHERE token = ?');
        $stmt->execute([$this->hash($token)]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /** Estado agregado dos convites vivos da banda, para a linha do administrador. */
    public function resumoDaBanda(string $bandaId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) AS ativos, MAX(expira_em) AS expira_em, COALESCE(SUM(usos), 0) AS usos
               FROM banda_convites
              WHERE banda_id = ? AND revogado_em IS NULL AND expira_em > NOW()'
        );
        $stmt->execute([$bandaId]);
        $linha = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$linha || (int) $linha['ativos'] === 0) return null;

        return [
            'ativos'    => (int) $linha['ativos'],
            'expira_em' => (string) $linha['expira_em'],
            'usos'      => (int) $linha['usos'],
        ];
    }

    public function revogarDaBanda(string $bandaId): void
    {
        $this->pdo->prepare(
            'UPDATE banda_convites SET revogado_em = NOW() WHERE banda_id = ? AND revogado_em IS NULL'
        )->execute([$bandaId]);
    }

    public function registrarUso(string $token): void
    {
        $this->pdo->prepare('UPDATE banda_convites SET usos = usos + 1 WHERE token = ?')
            ->execute([$this->hash($token)]);
    }

    private function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `C:/xampp/php/php.exe public/vendor/bin/phpunit --filter BandaConviteRepositoryTest`
Expected: PASS, 8 testes.

- [ ] **Step 5: Rodar a suíte PHP inteira**

Run: `npm run test:unit:php`
Expected: PASS. Qualquer falha aqui é regressão sua — conserte antes de seguir.

- [ ] **Step 6: Pare para revisão**

Não commite.

---

### Task 4: `BandaConviteFlow` — o único lugar que vincula

**Files:**
- Create: `public/src/Services/BandaConviteFlow.php`
- Test: `tests/php/BandaConviteFlowTest.php`

**Interfaces:**
- Consumes: `BandaConviteRepository` (Task 3), `BandaConvitePolicy` (Task 2), `UserRepository::belongsToBanda()/countByBanda()/importToBanda()` (já existem)
- Produces:
  - `new BandaConviteFlow(?BandaConviteRepository $convites = null, ?UserRepository $usuarios = null)`
  - `aceitar(string $token, string $usuarioId, int $limiteUsuarios): array` — `['ok'=>true,'banda_id'=>string,'ja_era_membro'=>bool]` ou `['ok'=>false,'erro'=>'convite_invalido'|'plano_limite']`. `$limiteUsuarios === -1` é ilimitado.
  - `BandaConviteFlow::guardarNaSessao(string $token, string $bandaId, string $bandaNome): void`
  - `BandaConviteFlow::pendente(): ?array` — `['token'=>string,'banda_id'=>string,'banda_nome'=>string]` ou `null`
  - `BandaConviteFlow::limparSessao(): void`

**Por que o limite do plano vem por parâmetro:** `cifro_plan_limits()` mora em `public/src/backend/bootstrap.php`, que o bootstrap do PHPUnit não carrega. Receber o número deixa o fluxo testável sem subir meio aplicativo — quem chama passa `cifro_plan_limits($plano)['users']`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/php/BandaConviteFlowTest.php`:

```php
<?php

use PHPUnit\Framework\TestCase;

final class BandaConviteFlowTest extends TestCase
{
    private PDO $pdo;
    private string $bandaId;
    private string $adminId;
    private string $convidadoId;
    private BandaConviteRepository $convites;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();

        $sufixo = bin2hex(random_bytes(8));
        $this->bandaId     = 'fluxo-banda-' . $sufixo;
        $this->adminId     = 'fluxo-admin-' . $sufixo;
        $this->convidadoId = 'fluxo-convidado-' . $sufixo;

        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?,?,?)')
            ->execute([$this->bandaId, 'Banda do Fluxo', 'mensal']);
        foreach ([[$this->adminId, 'Admin'], [$this->convidadoId, 'Convidado']] as [$id, $nome]) {
            $this->pdo->prepare('INSERT INTO usuarios (id, nome, email, perfil, ativo) VALUES (?,?,?,?,?)')
                ->execute([$id, $nome, $id . '@fluxo.local', 'usuario', 1]);
        }
        $this->pdo->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)')
            ->execute([$this->adminId, $this->bandaId, 'administrador']);

        $this->convites = new BandaConviteRepository($this->pdo);
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) $this->pdo->rollBack();
        $_SESSION = [];
    }

    private function fluxo(): BandaConviteFlow
    {
        return new BandaConviteFlow($this->convites, new UserRepository());
    }

    private function perfilNaBanda(string $usuarioId): ?string
    {
        $stmt = $this->pdo->prepare('SELECT perfil FROM usuario_banda WHERE usuario_id=? AND banda_id=?');
        $stmt->execute([$usuarioId, $this->bandaId]);
        return $stmt->fetchColumn() ?: null;
    }

    public function testConvidadoEntraNaBandaComoBasico(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        $resultado = $this->fluxo()->aceitar($token, $this->convidadoId, -1);

        self::assertTrue($resultado['ok']);
        self::assertSame($this->bandaId, $resultado['banda_id']);
        self::assertFalse($resultado['ja_era_membro']);
        self::assertSame('basico', $this->perfilNaBanda($this->convidadoId));
    }

    public function testEntrarPeloLinkContaUmaEntrada(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        $this->fluxo()->aceitar($token, $this->convidadoId, -1);

        self::assertSame(1, (int) $this->convites->buscarPorToken($token)['usos']);
    }

    public function testClicarNoLinkDuasVezesNaoContaDuasEntradas(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);
        $fluxo = $this->fluxo();

        $fluxo->aceitar($token, $this->convidadoId, -1);
        $segundo = $fluxo->aceitar($token, $this->convidadoId, -1);

        self::assertTrue($segundo['ok']);
        self::assertTrue($segundo['ja_era_membro']);
        self::assertSame(1, (int) $this->convites->buscarPorToken($token)['usos']);
    }

    public function testConviteRevogadoNaoDeixaNinguemEntrar(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);
        $this->convites->revogarDaBanda($this->bandaId);

        $resultado = $this->fluxo()->aceitar($token, $this->convidadoId, -1);

        self::assertFalse($resultado['ok']);
        self::assertSame('convite_invalido', $resultado['erro']);
        self::assertNull($this->perfilNaBanda($this->convidadoId));
    }

    public function testTokenInventadoNaoDeixaNinguemEntrar(): void
    {
        $resultado = $this->fluxo()->aceitar(str_repeat('0', 64), $this->convidadoId, -1);

        self::assertFalse($resultado['ok']);
        self::assertSame('convite_invalido', $resultado['erro']);
        self::assertNull($this->perfilNaBanda($this->convidadoId));
    }

    public function testBandaNoTetoDoPlanoRecusaOConvidadoSemVincular(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        // A banda já tem 1 membro (o admin) e o plano permite 1 — é o Gratuito.
        $resultado = $this->fluxo()->aceitar($token, $this->convidadoId, 1);

        self::assertFalse($resultado['ok']);
        self::assertSame('plano_limite', $resultado['erro']);
        self::assertNull($this->perfilNaBanda($this->convidadoId));
        self::assertSame(0, (int) $this->convites->buscarPorToken($token)['usos']);
    }

    public function testQuemJaEhMembroPassaMesmoComABandaNoTeto(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        // O próprio administrador clicando no link da própria banda, no Gratuito.
        $resultado = $this->fluxo()->aceitar($token, $this->adminId, 1);

        self::assertTrue($resultado['ok']);
        self::assertTrue($resultado['ja_era_membro']);
        self::assertSame('administrador', $this->perfilNaBanda($this->adminId), 'o perfil de quem já é membro não pode ser rebaixado');
    }

    public function testConvitePendenteAtravessaASessao(): void
    {
        self::assertNull(BandaConviteFlow::pendente());

        BandaConviteFlow::guardarNaSessao('tok', 'banda-9', 'Os Fulanos');
        $pendente = BandaConviteFlow::pendente();

        self::assertSame('tok', $pendente['token']);
        self::assertSame('banda-9', $pendente['banda_id']);
        self::assertSame('Os Fulanos', $pendente['banda_nome']);

        BandaConviteFlow::limparSessao();
        self::assertNull(BandaConviteFlow::pendente());
    }
}
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `C:/xampp/php/php.exe public/vendor/bin/phpunit --filter BandaConviteFlowTest`
Expected: FAIL com `Error: Class "BandaConviteFlow" not found`.

- [ ] **Step 3: Implementar**

Crie `public/src/Services/BandaConviteFlow.php`:

```php
<?php
/**
 * Aceite de um convite de banda.
 *
 * É o ÚNICO lugar que cria o vínculo e conta a entrada. Register, Google e
 * login passam todos por aqui — se a regra de quem entra se espalhasse pelos
 * três, elas divergiriam na primeira mudança.
 */
class BandaConviteFlow
{
    private const CHAVE_SESSAO = 'cifro_convite';

    private BandaConviteRepository $convites;
    private UserRepository $usuarios;

    public function __construct(?BandaConviteRepository $convites = null, ?UserRepository $usuarios = null)
    {
        $this->convites = $convites ?? new BandaConviteRepository();
        $this->usuarios = $usuarios ?? new UserRepository();
    }

    /**
     * @param int $limiteUsuarios teto de usuários do plano da banda; -1 é ilimitado.
     *                            Quem chama passa cifro_plan_limits($plano)['users'].
     * @return array{ok: bool, banda_id?: string, ja_era_membro?: bool, erro?: string}
     */
    public function aceitar(string $token, string $usuarioId, int $limiteUsuarios): array
    {
        $convite = $this->convites->buscarPorToken($token);
        if (!BandaConvitePolicy::estaValido($convite)) {
            return ['ok' => false, 'erro' => 'convite_invalido'];
        }

        $bandaId = (string) $convite['banda_id'];

        // Quem já é membro passa direto: clicar no link de novo não pode
        // rebaixar um administrador a básico nem contar uma segunda entrada.
        if ($this->usuarios->belongsToBanda($usuarioId, $bandaId)) {
            return ['ok' => true, 'banda_id' => $bandaId, 'ja_era_membro' => true];
        }

        if ($limiteUsuarios !== -1 && $this->usuarios->countByBanda($bandaId) >= $limiteUsuarios) {
            return ['ok' => false, 'erro' => 'plano_limite'];
        }

        $this->usuarios->importToBanda($usuarioId, $bandaId, BandaConvitePolicy::PERFIL);
        $this->convites->registrarUso($token);

        return ['ok' => true, 'banda_id' => $bandaId, 'ja_era_membro' => false];
    }

    /**
     * O convite fica na sessão para atravessar o cadastro — inclusive o
     * roundtrip do Google, do mesmo jeito que google_legal_acceptance faz.
     */
    public static function guardarNaSessao(string $token, string $bandaId, string $bandaNome): void
    {
        $_SESSION[self::CHAVE_SESSAO] = [
            'token'      => $token,
            'banda_id'   => $bandaId,
            'banda_nome' => $bandaNome,
        ];
    }

    /** @return array{token: string, banda_id: string, banda_nome: string}|null */
    public static function pendente(): ?array
    {
        $pendente = $_SESSION[self::CHAVE_SESSAO] ?? null;
        if (!is_array($pendente) || empty($pendente['token'])) return null;
        return $pendente;
    }

    public static function limparSessao(): void
    {
        unset($_SESSION[self::CHAVE_SESSAO]);
    }
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `C:/xampp/php/php.exe public/vendor/bin/phpunit --filter BandaConviteFlowTest`
Expected: PASS, 8 testes.

- [ ] **Step 5: Pare para revisão**

Não commite.

---

### Task 5: Endpoint de gerar e revogar o convite

**Files:**
- Create: `public/api/bandas/convite.php`
- Test: `tests/cifro/78-convite-banda.spec.js` (arquivo novo; as tarefas seguintes acrescentam blocos a ele)

**Interfaces:**
- Consumes: `BandaConviteRepository` (Task 3), `BandaConvitePolicy` (Task 2), `require_band_role()`, `require_csrf()`, `cifro_require_plan_limit()`, `base_url()`
- Produces: endpoint `/api/bandas/convite.php`
  - `GET` → `{ok:true, sucesso:true, estado:{ativo:bool, validade?:string, usos?:int}}`
  - `POST {action:'gerar'}` → `{ok:true, sucesso:true, caminho:'/convite.php?t=…', banda_nome:string, estado:{…}}`
  - `POST {action:'revogar'}` → `{ok:true, sucesso:true, estado:{ativo:false}}`
  - Banda no teto do plano em `gerar` → HTTP 403 com `{plano_limit:true, mensagem:'…'}` (vem de `cifro_require_plan_limit`)

**Armadilha do ambiente de teste, leia antes de escrever os testes:** o usuário E2E padrão (`TEST_EMAIL`, `admin@e2e.local`) tem `perfil = 'master'`, e `cifro_require_plan_limit()` começa com `if (is_master()) return;`. A "Banda E2E" é `gratuito`. Ou seja: **o admin padrão gera convite normalmente mesmo no Gratuito, porque é master.** Para testar a recusa por plano é preciso criar uma banda `gratuito` com um administrador **não-master**, como o `73-minha-banda.spec.js` já faz com `dbQuery` + `phpPasswordHash`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/cifro/78-convite-banda.spec.js`:

```js
/**
 * 78-convite-banda.spec.js
 *
 * Convite da banda por link (ROLE-003). O que estes testes protegem:
 *
 *  1. só administrador gera link — um básico não pode abrir a banda para o mundo;
 *  2. o link morre quando revogado, no request seguinte;
 *  3. quem não pode ter mais membros descobre isso ANTES de compartilhar.
 */
import { test, expect } from '../fixtures/coverage.js';
import { fazerLogin } from '../helpers/auth.js';

const ENDPOINT = '/api/bandas/convite.php';

test.use({ storageState: 'tests/.auth/user.json' });

test.beforeEach(async ({ page }) => {
  await fazerLogin(page);
});

async function csrf(page) {
  await page.goto('/index.php');
  return page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
}

async function gerar(page) {
  const token = await csrf(page);
  return page.request.post(ENDPOINT, {
    data: JSON.stringify({ action: 'gerar' }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
  });
}

test.describe('Convite da banda — geração do link', () => {
  test('administrador gera um link que aponta para a página de convite', async ({ page }) => {
    const res = await gerar(page);

    expect(res.status()).toBe(200);
    const corpo = await res.json();
    expect(corpo.sucesso).toBe(true);
    expect(corpo.caminho).toMatch(/\/convite\.php\?t=[0-9a-f]{64}$/);
    expect(corpo.banda_nome).toBeTruthy();
  });

  test('o link recém-gerado aparece como convite ativo com validade legível', async ({ page }) => {
    await gerar(page);

    const res = await page.request.get(ENDPOINT);
    const corpo = await res.json();

    expect(corpo.estado.ativo).toBe(true);
    expect(corpo.estado.validade).toMatch(/^\d{2}\/\d{2} às \d{2}h\d{2}$/);
    expect(typeof corpo.estado.usos).toBe('number');
  });

  test('gerar duas vezes não mata o link já compartilhado', async ({ page }) => {
    const primeiro = await (await gerar(page)).json();
    const segundo = await (await gerar(page)).json();

    expect(primeiro.caminho).not.toBe(segundo.caminho);

    // Os dois continuam abrindo a página de convite, não a tela de link inválido.
    for (const caminho of [primeiro.caminho, segundo.caminho]) {
      await page.goto(caminho);
      await expect(page.locator('[data-convite-estado]')).not.toHaveAttribute('data-convite-estado', 'invalido');
    }
  });

  test('revogar derruba o link no request seguinte', async ({ page }) => {
    const { caminho } = await (await gerar(page)).json();
    const token = await csrf(page);

    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'revogar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
    expect((await res.json()).estado.ativo).toBe(false);

    await page.goto(caminho);
    await expect(page.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'invalido');
  });
});

test.describe('Convite da banda — quem pode gerar', () => {
  test('POST sem CSRF é recusado', async ({ page }) => {
    await page.goto('/index.php');
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(403);
  });

  test('visitante sem sessão não gera convite', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonima = await ctx.newPage();
    const res = await anonima.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403, 404]).toContain(res.status());
    await ctx.close();
  });

  test('ação desconhecida é recusada', async ({ page }) => {
    const token = await csrf(page);
    const res = await page.request.post(ENDPOINT, {
      data: JSON.stringify({ action: 'explodir' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    });
    expect(res.status()).toBe(422);
  });
});
```

O teste "gerar duas vezes" e o de revogação dependem da página `convite.php` (Task 8). Até lá eles vão falhar no `page.goto`. Isso é esperado e está anotado no Step 4.

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js`
Expected: FAIL — o endpoint ainda não existe, então as respostas vêm 404.

- [ ] **Step 3: Implementar o endpoint**

Crie `public/api/bandas/convite.php`:

```php
<?php
/**
 * Convite da banda por link (ROLE-003).
 *
 *   GET                      → estado dos convites vivos da banda
 *   POST {action:'gerar'}    → link novo, válido por 24h
 *   POST {action:'revogar'}  → derruba todos os convites vivos da banda
 *
 * O teto de usuários do plano é barrado aqui, na geração: é melhor o
 * administrador descobrir o limite antes de compartilhar do que o músico
 * descobrir depois de clicar no link no grupo.
 *
 * Devolve o CAMINHO, não a URL inteira: quem monta o endereço absoluto é o
 * JavaScript, com window.location.origin, do mesmo jeito que playlist-share.js
 * faz. Assim o link compartilhado aponta para o host que o usuário está
 * realmente usando, e não para o APP_URL configurado no servidor.
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($metodo, ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['ok' => false, 'sucesso' => false, 'mensagem' => 'Método não permitido.']);
    exit;
}

require_band_role('administrador');

$bandaId  = current_band_id();
$convites = new BandaConviteRepository();

/** Estado agregado para a linha que o administrador vê na aba Membros. */
function convite_estado(BandaConviteRepository $convites, string $bandaId): array {
    $resumo = $convites->resumoDaBanda($bandaId);
    if (!$resumo) return ['ativo' => false];
    return [
        'ativo'    => true,
        'validade' => BandaConvitePolicy::rotuloValidade($resumo['expira_em']),
        'usos'     => $resumo['usos'],
    ];
}

if ($metodo === 'GET') {
    echo json_encode([
        'ok'      => true,
        'sucesso' => true,
        'estado'  => convite_estado($convites, $bandaId),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

require_csrf();

$input  = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? '';

if ($action === 'revogar') {
    $convites->revogarDaBanda($bandaId);
    echo json_encode(['ok' => true, 'sucesso' => true, 'estado' => ['ativo' => false]]);
    exit;
}

if ($action !== 'gerar') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'sucesso' => false, 'mensagem' => 'Ação inválida.']);
    exit;
}

// Responde 403 com plano_limit e encerra quando a banda já está no teto.
cifro_require_plan_limit('users', (new UserRepository())->countByBanda($bandaId));

$token = $convites->gerar($bandaId, $_SESSION['usuario']['id'] ?? null);
$banda = $_SESSION['banda_atual'] ?? [];

OperationalLogger::log('info', 'convite.link_gerado', ['operation' => 'convite_gerar', 'result' => 'success']);

echo json_encode([
    'ok'         => true,
    'sucesso'    => true,
    'caminho'    => base_url('/convite.php?t=' . urlencode($token)),
    'banda_nome' => $banda['nome'] ?? '',
    'estado'     => convite_estado($convites, $bandaId),
], JSON_UNESCAPED_UNICODE);
```

- [ ] **Step 4: Rodar só os testes que não dependem da página**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js -g "aponta para a página de convite|validade legível|sem CSRF|sem sessão|desconhecida"`
Expected: PASS, 5 testes. Os dois que navegam para `convite.php` só passam na Task 8.

- [ ] **Step 5: Pare para revisão**

Não commite.

---

### Task 6: Compartilhamento — helper comum e texto do convite

**Files:**
- Create: `public/src/js/cifro-share.js`
- Create: `public/src/js/banda-convite-share.js`
- Modify: `public/src/js/playlist-share.js` (passa a usar o helper comum)
- Test: `tests/convite-share.test.js`
- Modify: `package.json` (acrescentar o teste novo ao `test:unit:js`)

**Interfaces:**
- Consumes: nada
- Produces:
  - `window.CifroShare.isMobile(): boolean`
  - `window.CifroShare.copy(texto: string): Promise<void>`
  - `window.CifroShare.compartilhar({titulo: string, texto: string}): Promise<'shared'|'cancelled'|'copied'>`
  - `window.CifroConviteShare.formatar({bandaNome: string, link: string}): string`
  - `window.CifroConviteShare.share({bandaNome: string, link: string}): Promise<'shared'|'cancelled'|'copied'>`

**Por que extrair:** `playlist-share.js` já carrega `isMobile()` e `copy()` próprios. Duplicá-los faria os dois compartilhamentos divergirem na primeira correção. O helper novo usa o padrão de `chords.js` — IIFE recebendo `window` **ou** `globalThis` — para poder ser carregado pelo `node --test`; `playlist-share.js` hoje referencia `window` direto e por isso não é testável fora do navegador.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/convite-share.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import '../public/src/js/cifro-share.js';
import '../public/src/js/banda-convite-share.js';

const share = globalThis.CifroShare;
const convite = globalThis.CifroConviteShare;

test('o texto do convite traz a banda, o link e o prazo', () => {
  const texto = convite.formatar({ bandaNome: 'Os Fulanos', link: 'https://cifro.com.br/convite.php?t=abc' });

  assert.match(texto, /Os Fulanos/);
  assert.match(texto, /https:\/\/cifro\.com\.br\/convite\.php\?t=abc/);
  assert.match(texto, /24 horas/);
});

test('banda sem nome não vira "undefined" no meio da mensagem', () => {
  const texto = convite.formatar({ link: 'https://cifro.com.br/convite.php?t=abc' });

  assert.doesNotMatch(texto, /undefined/);
  assert.match(texto, /https:\/\/cifro\.com\.br\/convite\.php\?t=abc/);
});

test('no desktop o convite vai para a área de transferência', async () => {
  const copiados = [];
  globalThis.CifroShare.copy = async texto => { copiados.push(texto); };
  globalThis.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };

  const resultado = await convite.share({ bandaNome: 'Os Fulanos', link: 'https://x/convite.php?t=1' });

  assert.equal(resultado, 'copied');
  assert.equal(copiados.length, 1);
  assert.match(copiados[0], /Os Fulanos/);
});

test('no celular o convite abre o compartilhamento nativo', async () => {
  const compartilhados = [];
  globalThis.navigator = {
    userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile',
    share: async dados => { compartilhados.push(dados); },
  };

  const resultado = await convite.share({ bandaNome: 'Os Fulanos', link: 'https://x/convite.php?t=1' });

  assert.equal(resultado, 'shared');
  assert.match(compartilhados[0].text, /Os Fulanos/);
});

test('desistir do compartilhamento nativo não é erro', async () => {
  globalThis.navigator = {
    userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile',
    share: async () => { const erro = new Error('cancelado'); erro.name = 'AbortError'; throw erro; },
  };

  assert.equal(await convite.share({ bandaNome: 'X', link: 'https://x/1' }), 'cancelled');
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `node --test tests/convite-share.test.js`
Expected: FAIL — `Cannot find module .../cifro-share.js`.

- [ ] **Step 3: Criar o helper comum**

Crie `public/src/js/cifro-share.js`:

```js
/**
 * Compartilhamento: nativo no celular, área de transferência no desktop.
 *
 * Vive separado porque repertório e convite precisam exatamente do mesmo
 * comportamento — quando isso estava duplicado, qualquer correção só chegava
 * a um dos dois. Recebe window ou globalThis para poder ser testado no Node.
 */
(function (escopo) {
  function isMobile() {
    var nav = escopo.navigator || {};
    if (nav.userAgentData && typeof nav.userAgentData.mobile === 'boolean') {
      return nav.userAgentData.mobile;
    }
    return /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '');
  }

  async function copy(texto) {
    var nav = escopo.navigator || {};
    if (nav.clipboard && escopo.isSecureContext) {
      await nav.clipboard.writeText(texto);
      return;
    }
    // Sem clipboard API (http, navegador antigo): textarea invisível + execCommand.
    var area = escopo.document.createElement('textarea');
    area.value = texto;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    escopo.document.body.appendChild(area);
    area.select();
    escopo.document.execCommand('copy');
    area.remove();
  }

  async function compartilhar(dados) {
    var nav = escopo.navigator || {};
    if (isMobile() && nav.share) {
      try {
        await nav.share({ title: dados.titulo, text: dados.texto });
        return 'shared';
      } catch (erro) {
        if (erro && erro.name === 'AbortError') return 'cancelled';
        throw erro;
      }
    }
    await escopo.CifroShare.copy(dados.texto);
    return 'copied';
  }

  escopo.CifroShare = { isMobile: isMobile, copy: copy, compartilhar: compartilhar };
})(typeof window !== 'undefined' ? window : globalThis);
```

Note que `compartilhar()` chama `escopo.CifroShare.copy` em vez da função local: é o que permite ao teste trocar a implementação de cópia sem um DOM de verdade.

- [ ] **Step 4: Criar o texto do convite**

Crie `public/src/js/banda-convite-share.js`:

```js
/**
 * Texto do convite da banda, no molde de playlist-share.js.
 */
(function (escopo) {
  function formatar(dados) {
    var banda = (dados && dados.bandaNome) || 'nossa banda';
    var link = (dados && dados.link) || '';
    return [
      '🎸 CONVITE',
      'Você foi convidado para a banda *' + banda + '* no Cifrô.',
      '',
      'Toque no link para entrar:',
      link,
      '',
      '⏰ O convite vale por 24 horas.'
    ].join('\n');
  }

  async function share(dados) {
    return escopo.CifroShare.compartilhar({
      titulo: 'Convite para a banda',
      texto: formatar(dados),
    });
  }

  escopo.CifroConviteShare = { formatar: formatar, share: share };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 5: Fazer `playlist-share.js` usar o helper comum**

Em `public/src/js/playlist-share.js`, remova as funções `isMobile()` e `copy()` (linhas 38-58 do arquivo atual) e troque o corpo de `share()` para delegar:

```js
  async function share(playlist, songs) {
    return window.CifroShare.compartilhar({
      titulo: playlist.nome || 'Repertório',
      texto: format(playlist, songs),
    });
  }
```

A função `format()` e o `window.CifroPlaylistShare = { format, share }` do fim do arquivo ficam como estão.

- [ ] **Step 6: Carregar `cifro-share.js` antes de quem usa**

`playlist-share.js` passou a depender de `window.CifroShare`. Encontre onde ele é carregado e acrescente `cifro-share.js` imediatamente antes, em cada lugar:

Run: `grep -rn "playlist-share.js" public/src/Views/ public/*.php`

Para cada ocorrência, insira antes a linha correspondente:
```php
<script src="<?= asset_url('/src/js/cifro-share.js') ?>"></script>
```
Se a página usar caminho literal em vez de `asset_url()`, siga o estilo da própria página.

- [ ] **Step 7: Registrar o teste novo no script de unidade**

Em `package.json`, na chave `test:unit:js`, acrescente `tests/convite-share.test.js` ao fim da lista:

```json
"test:unit:js": "node --test tests/chords.test.js tests/music-youtube-panel-state.test.js tests/marketing/timeline.test.js tests/convite-share.test.js",
```

- [ ] **Step 8: Rodar os testes de unidade JS**

Run: `node --test tests/convite-share.test.js`
Expected: PASS, 5 testes.

Run: `npm run test:unit:js`
Expected: os testes novos passam. `tests/marketing/timeline.test.js` tem 3 falhas conhecidas e pré-existentes (DEBT-009) — se aparecerem, ignore; qualquer outra falha é sua.

- [ ] **Step 9: Provar que o repertório não regrediu**

Run: `npx playwright test --project=cifro -g "[Cc]ompartilh"`
Expected: PASS. Se nenhum teste casar com o filtro, rode `npx playwright test --project=cifro tests/cifro/62-playlist-persistence.spec.js` e confirme que passa.

- [ ] **Step 10: Pare para revisão**

Não commite.

---

### Task 7: Botão Convidar e linha de estado na aba Membros

**Files:**
- Modify: `public/src/Views/partials/banda/aba-membros.php`
- Test: `tests/cifro/78-convite-banda.spec.js` (acrescentar bloco ao arquivo da Task 5)

**Interfaces:**
- Consumes: `/api/bandas/convite.php` (Task 5), `window.CifroConviteShare` (Task 6)
- Produces: elementos `#btnConvidar`, `#conviteEstado`, `#conviteValidade`, `#conviteUsos`, `#btnRevogarConvite`, `#conviteUpgrade`

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao fim de `tests/cifro/78-convite-banda.spec.js`:

```js
test.describe('Convite da banda — a aba Membros', () => {
  test('o administrador encontra o botão Convidar como ação principal', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');

    const convidar = page.locator('#btnConvidar');
    await expect(convidar).toBeVisible();
    await expect(convidar).toHaveClass(/btn--primary/);
  });

  test('gerar o convite copia o link e mostra a validade para o administrador', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');

    // Sem clipboard real no navegador de teste: troca a cópia por um espião.
    await page.evaluate(() => {
      window.__copiado = [];
      window.CifroShare.copy = async texto => { window.__copiado.push(texto); };
    });

    await page.click('#btnConvidar');

    await expect(page.locator('#conviteEstado')).toBeVisible();
    await expect(page.locator('#conviteValidade')).toHaveText(/^\d{2}\/\d{2} às \d{2}h\d{2}$/);

    const copiado = await page.evaluate(() => window.__copiado);
    expect(copiado).toHaveLength(1);
    expect(copiado[0]).toContain('/convite.php?t=');
    expect(copiado[0]).toContain('24 horas');
  });

  test('revogar some com a linha de convite ativo', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');
    await page.evaluate(() => { window.CifroShare.copy = async () => {}; });

    await page.click('#btnConvidar');
    await expect(page.locator('#conviteEstado')).toBeVisible();

    await page.click('#btnRevogarConvite');
    // cifroConfirm é um modal do próprio produto, não um dialog do navegador:
    // o botão de confirmação é .cifro-confirm-btn--danger (cifro-confirm.js:67).
    await page.click('.cifro-confirm-btn--danger');

    await expect(page.locator('#conviteEstado')).toBeHidden();
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js -g "aba Membros"`
Expected: FAIL — `#btnConvidar` não existe.

- [ ] **Step 3: Acrescentar a marcação**

Em `public/src/Views/partials/banda/aba-membros.php`, troque o bloco `<div class="toolbar">` (linhas 110-117) por:

```php
    <div class="toolbar">
      <button type="button" class="btn btn--primary" id="btnConvidar" onclick="convidarPorLink()">
        <?= cifro_icon('users', 16) ?> Convidar
      </button>
      <button type="button" class="btn btn--secondary" onclick="abrirModalNovo()">
        <?= cifro_icon('plus', 16) ?> Novo Usuário
      </button>
      <button type="button" class="btn btn--secondary" onclick="abrirModalImportar()">
        <?= cifro_icon('users', 16) ?> Importar Usuário
      </button>
    </div>

    <p class="convite-estado" id="conviteEstado" hidden>
      Convite ativo até <strong id="conviteValidade"></strong>
      · <span id="conviteUsos">0</span>
      · <button type="button" class="convite-revogar" id="btnRevogarConvite" onclick="revogarConvite()">Revogar</button>
    </p>

    <div class="convite-upgrade" id="conviteUpgrade" hidden>
      <strong>Seu plano Gratuito permite apenas você.</strong>
      <span id="conviteUpgradeMotivo"></span>
      <a class="btn btn--primary" href="<?= e(base_url('/minha-banda.php?aba=plano')) ?>">Ver planos</a>
    </div>
```

E acrescente ao `<style>` do arquivo, junto das outras regras:

```css
    .convite-estado { margin: -6px 0 14px; color: var(--text-2); font-size: var(--text-xs); }
    .convite-estado[hidden] { display: none; }
    .convite-revogar {
      border: 0; background: none; padding: 0; font: inherit;
      color: var(--danger); text-decoration: underline; cursor: pointer;
    }
    .convite-upgrade {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      margin: -6px 0 14px; padding: 12px 14px;
      background: rgba(124,58,237,.12); border: 1px solid rgba(124,58,237,.45);
      border-radius: var(--radius-md); color: var(--text-2); font-size: var(--text-sm);
    }
    .convite-upgrade[hidden] { display: none; }
    .convite-upgrade strong { color: var(--text-1); }
```

- [ ] **Step 4: Acrescentar o JavaScript**

No bloco `<script>` do mesmo arquivo, logo antes da linha final `carregarUsuarios();`, insira:

```js
// ── Convite por link ─────────────────────────────────────────────────────────

const API_CONVITE = (window.APP_BASE || '') + '/api/bandas/convite.php';

function renderConvite(estado) {
  const linha = document.getElementById('conviteEstado');
  if (!estado || !estado.ativo) { linha.hidden = true; return; }
  document.getElementById('conviteValidade').textContent = estado.validade || '';
  document.getElementById('conviteUsos').textContent =
    estado.usos === 1 ? '1 pessoa entrou' : `${estado.usos} pessoas entraram`;
  linha.hidden = false;
}

async function carregarConvite() {
  try {
    const res = await fetch(API_CONVITE, { cache: 'no-store' });
    if (!res.ok) return;
    renderConvite((await res.json()).estado);
  } catch (e) {}
}

async function convidarPorLink() {
  try {
    const res = await fetch(API_CONVITE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
      },
      body: JSON.stringify({ action: 'gerar' })
    });
    const dados = await res.json();

    // 403 com plano_limit: a banda não comporta mais ninguém. Quem precisa
    // saber disso é o administrador, AGORA — não o músico depois de clicar
    // num link que já circulou no grupo. Por isso vira card de upgrade e não
    // um toast que some em três segundos.
    if (dados.plano_limit) {
      document.getElementById('conviteUpgradeMotivo').textContent =
        'Faça upgrade para trazer a banda inteira pelo link de convite.';
      document.getElementById('conviteUpgrade').hidden = false;
      return;
    }

    if (!res.ok || !dados.sucesso) {
      cifroToast(dados.mensagem || 'Não foi possível gerar o convite.', 'error');
      return;
    }

    document.getElementById('conviteUpgrade').hidden = true;

    renderConvite(dados.estado);

    const resultado = await window.CifroConviteShare.share({
      bandaNome: dados.banda_nome,
      link: window.location.origin + dados.caminho,
    });
    if (resultado === 'copied') cifroToast('Link copiado! Vale por 24 horas.', 'success');
  } catch (e) {
    cifroToast('Não foi possível gerar o convite.', 'error');
  }
}

async function revogarConvite() {
  const ok = await cifroConfirm({
    title: 'Revogar convite',
    message: 'Os links de convite desta banda param de funcionar imediatamente. Quem já entrou continua na banda.',
    confirmText: 'Sim, revogar',
    cancelText: 'Cancelar',
    danger: true
  });
  if (!ok) return;

  try {
    const res = await cifroFetch(API_CONVITE, { action: 'revogar' });
    if (res.sucesso) {
      renderConvite({ ativo: false });
      cifroToast('Convite revogado.', 'success');
    } else {
      cifroToast(res.mensagem || 'Erro ao revogar.', 'error');
    }
  } catch (e) {
    cifroToast('Erro ao revogar.', 'error');
  }
}

carregarConvite();
```

- [ ] **Step 5: Carregar os scripts de compartilhamento na página**

Em `public/src/Views/banda/minha-banda.php`, junto dos outros `<script>` do fim do `<body>` (por volta da linha 77), acrescente antes de `cifro-connectivity.js`:

```php
  <script src="<?= asset_url('/src/js/cifro-share.js') ?>"></script>
  <script src="<?= asset_url('/src/js/banda-convite-share.js') ?>"></script>
```

- [ ] **Step 6: Rodar os testes da aba**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js -g "aba Membros"`
Expected: PASS, 3 testes.

- [ ] **Step 7: Conferir na tela de verdade**

Suba o app e olhe a aba com os próprios olhos: `npm run serve`, abra `http://localhost:8090/minha-banda.php?aba=membros`, confirme que os três botões cabem lado a lado no desktop e que no viewport de 375px eles não estouram a largura (a regra `@media (max-width: 480px)` do arquivo transforma a toolbar em grade de duas colunas — com três botões, o terceiro cai para a linha de baixo, o que é aceitável).

- [ ] **Step 8: Pare para revisão**

Não commite.

---

### Task 8: A página pública do convite

**Files:**
- Create: `public/convite.php`
- Create: `public/src/Views/convite.php`
- Test: `tests/cifro/78-convite-banda.spec.js` (acrescentar bloco)

**Interfaces:**
- Consumes: `BandaConviteRepository`, `BandaConvitePolicy`, `BandaConviteFlow` (Tasks 2-4), `BandaRepository::findById()`, `BandaSelectionHelper::buildBandaAtualSession()`, `cifro_plan_limits()`, `cifro_rate_limit()`
- Produces:
  - página `/convite.php?t=TOKEN`
  - atributo `data-convite-estado` com um de: `invalido` | `visitante` | `entrar` | `ja-membro`
  - `$_SESSION['cifro_convite']` gravada quando o convite vale e o visitante não está logado

**Os quatro estados:**

| `data-convite-estado` | Quando | O que a tela oferece |
|---|---|---|
| `invalido` | token ausente, desconhecido, expirado, revogado, banda inativa | mensagem neutra, **sem** o nome da banda |
| `visitante` | convite vale, ninguém logado | Continuar com Google / Criar conta com e-mail / Já tenho conta |
| `entrar` | convite vale, logado, ainda não é membro | botão POST "Entrar na banda" |
| `ja-membro` | convite vale, logado, já é membro | "Você já faz parte desta banda" + link para abri-la |

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao fim de `tests/cifro/78-convite-banda.spec.js`:

```js
test.describe('Convite da banda — a página do convidado', () => {
  test('convite inválido não revela o nome da banda', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonima = await ctx.newPage();

    await anonima.goto('/convite.php?t=' + 'f'.repeat(64));

    await expect(anonima.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'invalido');
    await expect(anonima.getByText(/não é mais válido/i)).toBeVisible();
    await expect(anonima.getByText(/Banda E2E/i)).toHaveCount(0);
    await ctx.close();
  });

  test('convite sem token nenhum também cai na tela neutra', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonima = await ctx.newPage();

    await anonima.goto('/convite.php');

    await expect(anonima.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'invalido');
    await ctx.close();
  });

  test('visitante recebe os caminhos de cadastro com o nome da banda', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho, banda_nome } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonima = await ctx.newPage();
    await anonima.goto(caminho);

    await expect(anonima.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'visitante');
    await expect(anonima.getByText(banda_nome)).toBeVisible();
    await expect(anonima.locator('#conviteCriarConta')).toBeVisible();
    await expect(anonima.locator('#conviteJaTenhoConta')).toBeVisible();
    await ctx.close();
  });

  test('entrar por convite não vira atalho para pular os termos de uso', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonima = await ctx.newPage();
    await anonima.goto(caminho);

    const google = anonima.locator('#conviteGoogle');
    if (await google.count() === 0) { await ctx.close(); test.skip(true, 'Google OAuth não configurado neste ambiente.'); return; }

    // Sem marcar o aceite, o clique é barrado e ninguém sai da página.
    anonima.once('dialog', d => d.accept());
    await google.click();
    await expect(anonima).toHaveURL(/convite\.php/);

    await ctx.close();
  });

  test('administrador que abre o próprio link vê que já faz parte da banda', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    await page.goto(caminho);

    await expect(page.locator('[data-convite-estado]')).toHaveAttribute('data-convite-estado', 'ja-membro');
  });

  test('entrar na banda exige POST — abrir o link não vincula ninguém', async ({ page }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    // GET puro no link não pode ter efeito colateral: o contador segue zerado.
    await page.request.get(caminho);
    const estado = await (await page.request.get('/api/bandas/convite.php')).json();

    expect(estado.estado.usos).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js -g "página do convidado"`
Expected: FAIL — `/convite.php` responde 404.

- [ ] **Step 3: Criar o controlador da página**

Crie `public/convite.php`:

```php
<?php
/**
 * Porta de entrada do convite por link (ROLE-003).
 *
 * Existe como página própria, e não como parâmetro em register.php, porque
 * aquele arquivo manda todo usuário autenticado direto para index.php (linhas
 * 4-6) — um convite anexado à URL de cadastro seria engolido em silêncio.
 *
 * Qualquer falha mostra a MESMA tela neutra e nunca o nome da banda: senão o
 * endereço vira uma sonda para descobrir que bandas existem.
 */
require_once __DIR__ . '/src/backend/bootstrap.php';

$convites = new BandaConviteRepository();
$logado   = (($_SESSION['autenticado'] ?? false) === true);
$usuarioId = (string) ($_SESSION['usuario']['id'] ?? '');

// No POST o token vem do formulário; no GET, da URL.
$token = trim((string) ($_SERVER['REQUEST_METHOD'] === 'POST' ? ($_POST['t'] ?? '') : ($_GET['t'] ?? '')));

$convite = $token !== '' ? $convites->buscarPorToken($token) : null;
$valido  = BandaConvitePolicy::estaValido($convite);

$banda = null;
if ($valido) {
    $banda = (new BandaRepository())->findById((string) $convite['banda_id']);
    // Banda apagada ou desativada não recebe ninguém.
    if (!$banda || !($banda['ativo'] ?? 0)) {
        $valido = false;
        $banda  = null;
    }
}

$erro = '';

// ── Aceite: POST com CSRF, nunca GET ─────────────────────────────────────────
// Um GET que vincula seria disparado por prefetch de navegador e por qualquer
// pré-visualização de link — o WhatsApp abre todo link que passa por ele.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $valido && $logado) {
    require_csrf();

    if (cifro_rate_limit('convite_aceite', 10, 300, $usuarioId)) {
        $erro = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    } else {
        $limite = cifro_plan_limits($banda['plano'] ?? 'bloqueado')['users'] ?? 0;
        $resultado = (new BandaConviteFlow())->aceitar($token, $usuarioId, $limite);

        if ($resultado['ok']) {
            // Entra já com a banda convidada selecionada, senão o músico cai
            // na banda antiga e acha que o convite não funcionou.
            $perfil = $resultado['ja_era_membro']
                ? (($_SESSION['banda_atual']['perfil'] ?? BandaConvitePolicy::PERFIL))
                : BandaConvitePolicy::PERFIL;

            if (!BandaSelectionHelper::isBandaJaNaLista($_SESSION['usuario']['bandas'] ?? [], $banda['id'])) {
                $_SESSION['usuario']['bandas'][] = ['id' => $banda['id'], 'perfil' => $perfil];
            }
            $_SESSION['banda_atual'] = BandaSelectionHelper::buildBandaAtualSession($banda, $perfil);
            (new UserRepository())->updateConfig($usuarioId, ['banda_atual' => $banda['id']]);
            $_SESSION['usuario']['config']['banda_atual'] = $banda['id'];

            BandaConviteFlow::limparSessao();
            OperationalLogger::log('info', 'convite.aceito', ['operation' => 'convite_aceitar', 'result' => 'success']);

            header('Location: ' . base_url('/index.php'));
            exit;
        }

        $erro = $resultado['erro'] === 'plano_limite'
            ? 'Esta banda atingiu o limite de músicos do plano. Peça ao administrador para fazer upgrade.'
            : 'Este convite não é mais válido. Peça um novo ao administrador da banda.';
    }
}

// ── Estado da tela ───────────────────────────────────────────────────────────
if (!$valido) {
    $estado = 'invalido';
} elseif (!$logado) {
    $estado = 'visitante';
    // Guarda o convite para register.php e para o callback do Google lerem.
    BandaConviteFlow::guardarNaSessao($token, (string) $banda['id'], (string) $banda['nome']);
} elseif ((new UserRepository())->belongsToBanda($usuarioId, (string) $banda['id'])) {
    $estado = 'ja-membro';
} else {
    $estado = 'entrar';
}

$bandaNome = $valido ? (string) $banda['nome'] : '';

render_view('convite', compact('estado', 'bandaNome', 'token', 'erro'));
```

- [ ] **Step 4: Criar a view**

Crie `public/src/Views/convite.php`. O visual segue `public/src/Views/register.php`, para o convidado não sentir que trocou de produto no meio do caminho:

```php
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <title>Convite — Cifrô</title>
  <script src="<?= asset_url('/src/js/cifro-theme.js') ?>"></script>
  <link href="<?= asset_url('/src/css/fonts.css') ?>" rel="stylesheet">
  <link href="<?= asset_url('/src/css/theme.css') ?>" rel="stylesheet">
  <style>
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:linear-gradient(135deg,#0f0f0f 0%,#1a1a2e 100%); padding:20px; box-sizing:border-box; font-family:var(--font-ui,sans-serif); }
    .card { background:var(--bg-2,#1e1e1e); border:1px solid var(--border-1,#333); border-radius:16px; padding:36px 32px; max-width:440px; width:100%; box-shadow:0 12px 40px rgba(0,0,0,.5); text-align:center; }
    .brand img { width:132px; height:auto; margin-bottom:22px; }
    h1 { margin:0 0 10px; font-size:20px; color:#fff; }
    .banda { color:#a78bfa; font-weight:600; }
    p { color:#aaa; font-size:14px; line-height:1.6; margin:0 0 18px; }
    .acao { display:flex; align-items:center; justify-content:center; gap:10px; width:100%; height:44px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600; border:0; cursor:pointer; box-sizing:border-box; margin-bottom:10px; }
    .acao--google { background:#fff; color:#3c4043; border:1px solid #dadce0; }
    .acao--principal { background:#7c3aed; color:#fff; }
    .acao--secundaria { background:transparent; color:#a78bfa; border:1px solid #444; }
    .erro { background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.4); color:#f87171; border-radius:8px; padding:10px 14px; font-size:13px; margin-bottom:14px; }
    .rodape { margin-top:18px; font-size:13px; color:#666; }
    .rodape a { color:#7c3aed; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card" data-convite-estado="<?= e($estado) ?>">
    <div class="brand"><img src="<?= asset_url('/src/images/cifro-logo.svg') ?>" alt="Cifrô"></div>

    <?php if ($erro): ?>
      <div class="erro"><?= e($erro) ?></div>
    <?php endif; ?>

    <?php if ($estado === 'invalido'): ?>
      <h1>Convite indisponível</h1>
      <p>Este convite não é mais válido. Peça um novo ao administrador da banda.</p>
      <a class="acao acao--secundaria" href="<?= e(base_url('/login.php')) ?>">Ir para o Cifrô</a>

    <?php elseif ($estado === 'visitante'): ?>
      <h1>Você foi convidado para a <span class="banda"><?= e($bandaNome) ?></span></h1>
      <p>Crie sua conta para ver o repertório da banda. Leva menos de um minuto.</p>

      <?php if (google_oauth_configured()): ?>
        <?php /*
          O aceite legal precisa acompanhar o botão do Google, igual em
          register.php. start.php só grava google_legal_acceptance quando
          recebe source=register E legal_acceptance=1 (start.php:13-22) — um
          source=convite passaria direto e o convidado entraria sem nunca ter
          aceitado os termos. Por isso o source aqui é 'register' mesmo.
        */ ?>
        <a class="acao acao--google" id="conviteGoogle"
           href="<?= e(base_url('/api/auth/google/start.php?source=register&legal_acceptance=1')) ?>">
          Continuar com Google
        </a>
      <?php endif; ?>

      <a class="acao acao--principal" id="conviteCriarConta" href="<?= e(base_url('/register.php')) ?>">Criar conta com e-mail</a>
      <a class="acao acao--secundaria" id="conviteJaTenhoConta" href="<?= e(base_url('/login.php')) ?>">Já tenho conta</a>

      <label class="consentimento" for="legal_acceptance">
        <input type="checkbox" id="legal_acceptance">
        <span>Li e aceito os
          <a href="<?= e((string) env('TERMS_URL', base_url('/termos.php'))) ?>" target="_blank" rel="noopener">Termos de Uso</a> e a
          <a href="<?= e((string) env('PRIVACY_URL', base_url('/privacidade.php'))) ?>" target="_blank" rel="noopener">Política de Privacidade</a>.
        </span>
      </label>

    <?php elseif ($estado === 'ja-membro'): ?>
      <h1>Você já faz parte da <span class="banda"><?= e($bandaNome) ?></span></h1>
      <p>Nada a fazer aqui — é só seguir tocando.</p>
      <a class="acao acao--principal" href="<?= e(base_url('/index.php')) ?>">Abrir o Cifrô</a>

    <?php else: ?>
      <h1>Entrar na <span class="banda"><?= e($bandaNome) ?></span>?</h1>
      <p>Você entra como músico da banda e passa a ver o repertório dela.</p>
      <form method="post" action="<?= e(base_url('/convite.php')) ?>">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
        <input type="hidden" name="t" value="<?= e($token) ?>">
        <button type="submit" class="acao acao--principal" id="conviteEntrar">Entrar na banda</button>
      </form>
      <a class="acao acao--secundaria" href="<?= e(base_url('/index.php')) ?>">Agora não</a>
    <?php endif; ?>

    <div class="rodape">
      <a href="<?= e(base_url('/landing.php')) ?>">O que é o Cifrô?</a>
    </div>
  </div>

  <script>
    // Mesma trava do register.php: o Google só sai daqui com o aceite marcado,
    // porque o cadastro por Google não passa por nenhum outro formulário onde
    // o consentimento pudesse ser pedido. Quem escolhe "criar conta com
    // e-mail" encontra o checkbox obrigatório do próprio register.php.
    document.getElementById('conviteGoogle')?.addEventListener('click', evento => {
      if (!document.getElementById('legal_acceptance')?.checked) {
        evento.preventDefault();
        alert('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      }
    });
  </script>
</body>
</html>
```

E acrescente ao `<style>` da view:

```css
    .consentimento { display:flex; gap:9px; align-items:flex-start; text-align:left; color:#aaa; font-size:12px; line-height:1.45; margin-top:16px; }
    .consentimento input { width:16px; height:16px; flex:0 0 auto; margin-top:2px; }
    .consentimento a { color:#a78bfa; }
```

- [ ] **Step 5: Rodar os testes da página**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js -g "página do convidado"`
Expected: PASS, 5 testes.

- [ ] **Step 6: Rodar o arquivo inteiro**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js`
Expected: PASS, incluindo agora os dois testes da Task 5 que dependiam desta página.

- [ ] **Step 7: Pare para revisão**

Não commite.

---

### Task 9: Cadastro por e-mail entra na banda convidada

**Files:**
- Create: `public/src/Services/ConviteRecusadoException.php`
- Modify: `public/src/Controllers/RegisterController.php`
- Modify: `public/src/Views/register.php`
- Test: `tests/cifro/78-convite-banda.spec.js` (acrescentar bloco)

**Interfaces:**
- Consumes: `BandaConviteFlow::pendente()/aceitar()/limparSessao()` (Task 4), `cifro_plan_limits()`
- Produces:
  - `ConviteRecusadoException` com campo público `$motivo` (`'convite_invalido'` | `'plano_limite'`)
  - `RegisterController` que, com convite pendente, **não cria banda nova**

**A regra central:** hoje `handle()` exige `banda_nome` e cria banda + vínculo `administrador` (linhas 39, 81-91). Com convite pendente, `banda_nome` deixa de ser exigido, nenhuma banda é criada, e o vínculo vem do fluxo, como `basico`. **O aceite acontece dentro da mesma transação da criação do usuário** — se ele falhar, o cadastro inteiro volta atrás e não sobra usuário órfão sem banda.

O e-mail de ativação continua igual (decisão 6 do spec): a conta nasce inativa e o convidado define a senha pelo link do e-mail.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao fim de `tests/cifro/78-convite-banda.spec.js`:

```js
test.describe('Convite da banda — cadastro por e-mail', () => {
  test('o formulário de cadastro esconde o nome da banda para quem veio de um convite', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const token = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho, banda_nome } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    })).json();

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const convidado = await ctx.newPage();

    await convidado.goto(caminho);
    await convidado.click('#conviteCriarConta');

    await expect(convidado).toHaveURL(/register\.php/);
    await expect(convidado.locator('#banda_nome')).toHaveCount(0);
    await expect(convidado.getByText(banda_nome)).toBeVisible();
    await ctx.close();
  });

  test('músico convidado se cadastra e entra na banda como básico', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const csrfAdmin = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfAdmin },
    })).json();

    const email = `convidado-${Date.now()}@e2e.local`;
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const convidado = await ctx.newPage();

    await convidado.goto(caminho);
    await convidado.click('#conviteCriarConta');
    await convidado.fill('#nome', 'Músico Convidado');
    await convidado.fill('#email', email);
    await convidado.check('#legal_acceptance');
    await convidado.click('button[type="submit"]');

    await expect(convidado.getByText(/Verifique seu e-mail/i)).toBeVisible();

    // A prova real está no banco: vínculo na banda do convite, como básico,
    // e NENHUMA banda nova criada para este usuário.
    const { rows } = dbQuery(
      `SELECT ub.perfil, COUNT(*) OVER () AS vinculos
         FROM usuarios u JOIN usuario_banda ub ON ub.usuario_id = u.id
        WHERE u.email = ?`,
      [email]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].perfil).toBe('basico');

    await ctx.close();
  });
});
```

Acrescente o import de `dbQuery` ao topo do arquivo, se ainda não estiver lá:

```js
import { dbQuery } from '../helpers/db.js';
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js -g "cadastro por e-mail"`
Expected: FAIL — o campo `#banda_nome` ainda aparece e o cadastro cria banda própria.

- [ ] **Step 3: Desviar o `RegisterController`**

Em `public/src/Controllers/RegisterController.php`, dentro de `handle()`:

**3a.** Logo após `require_csrf();`, leia o convite:

```php
        // Convite pendente na sessão (gravado por convite.php): quem chega por
        // um convite entra na banda que convidou, em vez de criar uma própria.
        $convite = BandaConviteFlow::pendente();
```

**3b.** Troque a validação de campos obrigatórios (hoje `if (!$nome || !$email || !$bandaNome)`) por:

```php
        if (!$nome || !$email || (!$convite && !$bandaNome)) {
            $erro = 'Todos os campos são obrigatórios.';
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        }
```

**3c.** Todas as outras chamadas a `render_view('register', ...)` dentro de `handle()` precisam passar `convite` também, senão a view perde o contexto ao reexibir o formulário com erro. Acrescente `'convite'` ao `compact(...)` de cada uma delas, e em `showForm()` inicialize `$convite = BandaConviteFlow::pendente();` antes do `render_view`.

**3d.** Dentro do bloco `try` da transação, troque a criação da banda e o vínculo (hoje `$this->bandaRepo->save([...])` seguido de `importToBanda(..., 'administrador')`) por:

```php
            if ($convite) {
                // Aceite dentro da MESMA transação: se o convite tiver morrido
                // ou a banda estiver cheia, o cadastro inteiro volta atrás e
                // não sobra usuário sem banda nenhuma.
                $banda = $this->bandaRepo->findById($convite['banda_id']);
                $limite = cifro_plan_limits($banda['plano'] ?? 'bloqueado')['users'] ?? 0;
                $resultado = (new BandaConviteFlow())->aceitar($convite['token'], $userId, $limite);
                if (!$resultado['ok']) {
                    throw new ConviteRecusadoException($resultado['erro']);
                }
                $bandaId = $convite['banda_id'];
            } else {
                $this->bandaRepo->save([
                    'id'             => $bandaId,
                    'nome'           => $bandaNome,
                    'ativo'          => 1,
                    'plano'          => 'gratuito',
                    'trial_expira_em'=> null,
                    'criador_id'     => $userId,
                ]);
                $this->userRepo->importToBanda($userId, $bandaId, 'administrador');
            }
```

**3e.** Crie `public/src/Services/ConviteRecusadoException.php`. O motivo da recusa é um campo tipado, e não texto dentro da mensagem: mensagem de exceção é para humano ler, não para `str_contains` decidir fluxo.

```php
<?php
/**
 * Convite recusado durante o cadastro. Existe para abortar a transação sem
 * confundir a recusa (regra de negócio) com uma falha de banco.
 */
class ConviteRecusadoException extends RuntimeException
{
    /** @var string 'convite_invalido' | 'plano_limite' */
    public string $motivo;

    public function __construct(string $motivo)
    {
        $this->motivo = $motivo;
        parent::__construct('Convite recusado: ' . $motivo);
    }
}
```

Depois, no `handle()`, capture-a **antes** do `catch (Exception $e)` existente — a ordem importa, senão o catch genérico engole a específica:

```php
        } catch (ConviteRecusadoException $e) {
            $pdo->rollBack();
            $erro = $e->motivo === 'plano_limite'
                ? 'Esta banda atingiu o limite de músicos do plano. Peça ao administrador para fazer upgrade.'
                : 'Este convite não é mais válido. Peça um novo ao administrador da banda.';
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        } catch (Exception $e) {
            $pdo->rollBack();
            ErrorLogger::fromThrowable($e, 'Falha na transação de cadastro (usuário/banda/vínculo)', 'RegisterController::handle');
            $erro = 'Erro ao criar conta. Tente novamente.';
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        }
```

Uma recusa de convite não vai para o `ErrorLogger`: é regra de negócio funcionando, não defeito.

**3f.** Depois do `commit()`, o e-mail de boas-vindas deve nomear a banda certa. Troque o array passado a `MailService::sendWelcome` para usar `$convite ? $convite['banda_nome'] : $bandaNome`:

```php
            MailService::sendWelcome(
                ['nome' => $nome, 'email' => $email],
                ['nome' => $convite ? $convite['banda_nome'] : $bandaNome],
                $token
            );
```

**3g.** Ainda depois do `commit()`, limpe a sessão do convite para ele não vazar para um cadastro seguinte no mesmo navegador:

```php
        if ($convite) BandaConviteFlow::limparSessao();
```

- [ ] **Step 4: Adaptar a view de cadastro**

Em `public/src/Views/register.php`:

**4a.** Logo depois de `<h2>Criar conta grátis</h2>`, acrescente a faixa de contexto:

```php
      <?php if (!empty($convite)): ?>
        <div style="background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.45);border-radius:8px;padding:11px 14px;font-size:13px;color:#c4b5fd;margin-bottom:14px;line-height:1.5">
          Você foi convidado para a banda <strong><?= e($convite['banda_nome']) ?></strong>.
          Crie sua conta e você já entra nela.
        </div>
      <?php endif; ?>
```

**4b.** Envolva o `<hr class="divider">` e o bloco do campo `banda_nome` numa condicional, para quem vem de convite não ver o campo:

```php
        <?php if (empty($convite)): ?>
          <hr class="divider">

          <div class="form-group">
            <label for="banda_nome">Nome da banda</label>
            <input type="text" id="banda_nome" name="banda_nome" placeholder="Ex: Minha Banda" required
              value="<?= htmlspecialchars($_POST['banda_nome'] ?? '') ?>">
          </div>
        <?php endif; ?>
```

**4c.** Ajuste o rótulo do botão para deixar claro o destino:

```php
        <button type="submit" class="btn-submit"><?= empty($convite) ? 'Criar conta grátis' : 'Criar conta e entrar na banda' ?></button>
```

- [ ] **Step 5: Rodar os testes**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js -g "cadastro por e-mail"`
Expected: PASS, 2 testes.

- [ ] **Step 6: Provar que o cadastro normal não regrediu**

Run: `npx playwright test --project=cifro tests/cifro/24-onboarding.spec.js`
Expected: PASS. Quem se cadastra **sem** convite continua criando a própria banda e virando administrador dela.

- [ ] **Step 7: Pare para revisão**

Não commite.

---

### Task 10: Google e login de quem já tem conta

**Files:**
- Modify: `public/src/Services/GoogleAuthService.php`
- Modify: `public/api/auth/google/callback.php`
- Modify: `public/src/Controllers/AuthController.php`
- Test: `tests/php/GoogleAuthServiceTest.php` (acrescentar casos)
- Test: `tests/cifro/78-convite-banda.spec.js` (acrescentar bloco)

**Interfaces:**
- Consumes: `BandaConviteFlow` (Task 4)
- Produces:
  - `GoogleAuthService::resolveOrCreateUser(array $googlePayload, ?string $conviteBandaId = null): array` — com o segundo argumento preenchido, um usuário novo é criado **sem banda nova** e já vinculado à banda do convite
  - `AuthController::finalizeLogin()` consome o convite pendente antes de escolher a banda ativa

**Por que o Google é diferente do register:** `createUserAndBanda()` cria banda e usuário na mesma operação. Passar o id da banda convidada é o que evita a banda órfã. Para quem **já tem** conta Google, nada disso roda — quem vincula é o `finalizeLogin`.

- [ ] **Step 1: Escrever os testes PHP que falham**

Acrescente a `tests/php/GoogleAuthServiceTest.php` (mantenha o estilo dos testes já existentes no arquivo; se ele usar mocks de `UserRepository`/`BandaRepository`, siga o mesmo padrão):

```php
    public function testUsuarioNovoVindoDeConviteNaoGanhaBandaPropria(): void
    {
        $usuarios = $this->createMock(UserRepository::class);
        $bandas   = $this->createMock(BandaRepository::class);

        $usuarios->method('findByGoogleSub')->willReturn(null);
        $usuarios->method('findByEmail')->willReturn(null);

        // A prova: nenhuma banda é criada quando existe convite.
        $bandas->expects(self::never())->method('save');
        $usuarios->expects(self::once())->method('save')->with(self::callback(
            fn(array $u) => $u['bandas'] === [['id' => 'banda-convidada', 'perfil' => 'basico']]
        ));

        $servico = new GoogleAuthService($usuarios, $bandas);
        $user = $servico->resolveOrCreateUser([
            'sub' => 'sub-1', 'email' => 'novo@exemplo.com', 'email_verified' => true, 'name' => 'Novo',
        ], 'banda-convidada');

        self::assertSame([['id' => 'banda-convidada', 'perfil' => 'basico']], $user['bandas']);
    }

    public function testSemConviteOFluxoDoGoogleContinuaCriandoABandaDoUsuario(): void
    {
        $usuarios = $this->createMock(UserRepository::class);
        $bandas   = $this->createMock(BandaRepository::class);

        $usuarios->method('findByGoogleSub')->willReturn(null);
        $usuarios->method('findByEmail')->willReturn(null);
        $bandas->expects(self::once())->method('save');

        $servico = new GoogleAuthService($usuarios, $bandas);
        $user = $servico->resolveOrCreateUser([
            'sub' => 'sub-2', 'email' => 'sozinho@exemplo.com', 'email_verified' => true, 'name' => 'Sozinho',
        ]);

        self::assertSame('administrador', $user['bandas'][0]['perfil']);
    }
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `C:/xampp/php/php.exe public/vendor/bin/phpunit --filter GoogleAuthServiceTest`
Expected: FAIL — `resolveOrCreateUser()` ainda não aceita o segundo argumento, e `BandaRepository::save()` é chamado mesmo com convite.

- [ ] **Step 3: Aceitar o convite no `GoogleAuthService`**

Em `public/src/Services/GoogleAuthService.php`:

**3a.** Troque a assinatura e a chamada final de `resolveOrCreateUser`:

```php
    /**
     * @param array $googlePayload payload já verificado por GoogleJwtVerifier (sub, email, email_verified, name).
     * @param string|null $conviteBandaId banda de um convite pendente; quando presente,
     *        um usuário novo entra NELA em vez de ganhar uma banda própria.
     * @return array user row shaped like UserRepository::findByEmail()'s return.
     */
    public function resolveOrCreateUser(array $googlePayload, ?string $conviteBandaId = null): array
```

e, no fim do método, troque `return $this->createUserAndBanda($sub, $email, $name);` por:

```php
        return $this->createUserAndBanda($sub, $email, $name, $conviteBandaId);
```

**3b.** Troque `createUserAndBanda()` por:

```php
    private function createUserAndBanda(string $sub, string $email, string $name, ?string $conviteBandaId = null): array
    {
        $userId = bin2hex(random_bytes(16));
        $nome = $name !== '' ? $name : $email;

        // Convite: entra na banda que convidou, como básico. Sem convite:
        // ganha a própria banda e é administrador dela.
        if ($conviteBandaId !== null && $conviteBandaId !== '') {
            $bandas = [['id' => $conviteBandaId, 'perfil' => BandaConvitePolicy::PERFIL]];
        } else {
            $bandaId = bin2hex(random_bytes(16));
            $bandaNome = $name !== '' ? $name . "'s Band" : 'Minha Banda';

            // A banda precisa existir antes do vínculo por causa da FK de usuario_banda.
            $this->bandas->save([
                'id' => $bandaId,
                'nome' => $bandaNome,
                'ativo' => 1,
                'plano' => 'gratuito',
                'trial_expira_em' => null,
            ]);
            $bandas = [['id' => $bandaId, 'perfil' => 'administrador']];
        }

        $this->users->save([
            'id' => $userId,
            'nome' => $nome,
            'email' => $email,
            'senha_hash' => null,
            'perfil' => 'usuario',
            'ativo' => 1,
            'validade' => null,
            'google_sub' => $sub,
            'bandas' => $bandas,
        ]);

        if ($conviteBandaId === null || $conviteBandaId === '') {
            $this->bandas->definirCriador($bandas[0]['id'], $userId);
        }

        return [
            'id' => $userId,
            'nome' => $nome,
            'email' => $email,
            'perfil' => 'usuario',
            'validade' => '',
            'config' => [],
            'bandas' => $bandas,
        ];
    }
```

- [ ] **Step 4: Passar o convite no callback**

Em `public/api/auth/google/callback.php`, dentro do `try` que resolve o usuário, troque a linha `$user = $googleAuth->resolveOrCreateUser($payload);` por:

```php
    $convitePendente = BandaConviteFlow::pendente();
    $user = $googleAuth->resolveOrCreateUser($payload, $convitePendente['banda_id'] ?? null);
```

- [ ] **Step 5: Consumir o convite no `finalizeLogin`**

Em `public/src/Controllers/AuthController.php`, no início de `finalizeLogin($user)`, **antes** de `$this->popularSessao($user)`:

```php
    public function finalizeLogin($user) {
        // Convite pendente: quem chegou por um link entra na banda convidada
        // antes de a sessão ser montada, senão popularSessao escolheria a banda
        // antiga e o músico acharia que o convite não funcionou.
        $convite = BandaConviteFlow::pendente();
        if ($convite && !empty($user['id'])) {
            $banda = ($this->bandaRepository ?? new BandaRepository())->findById($convite['banda_id']);
            if ($banda) {
                $limite = cifro_plan_limits($banda['plano'] ?? 'bloqueado')['users'] ?? 0;
                $resultado = (new BandaConviteFlow())->aceitar($convite['token'], (string) $user['id'], $limite);
                if ($resultado['ok']) {
                    if (!BandaSelectionHelper::isBandaJaNaLista($user['bandas'] ?? [], $banda['id'])) {
                        $user['bandas'][] = ['id' => $banda['id'], 'perfil' => BandaConvitePolicy::PERFIL];
                    }
                    // Faz a banda convidada ser a que abre depois do login.
                    $user['config']['banda_atual'] = $banda['id'];
                }
            }
            BandaConviteFlow::limparSessao();
        }

        $this->popularSessao($user);
```

O resto do método fica como está.

- [ ] **Step 6: Rodar os testes PHP**

Run: `C:/xampp/php/php.exe public/vendor/bin/phpunit --filter "GoogleAuthServiceTest|AuthControllerTest"`
Expected: PASS.

Run: `npm run test:unit:php`
Expected: PASS.

- [ ] **Step 7: Escrever o teste E2E de quem já tem conta**

Acrescente ao fim de `tests/cifro/78-convite-banda.spec.js`:

```js
test.describe('Convite da banda — quem já tem conta', () => {
  test('músico de outra banda entra na banda convidada sem perder a primeira', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const csrfAdmin = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfAdmin },
    })).json();

    // Um músico que já existe e já toca na própria banda.
    const sufixo = Date.now();
    const usuarioId = `e2e-convidado-${sufixo}`;
    const outraBandaId = `e2e-outra-banda-${sufixo}`;
    const email = `outra-banda-${sufixo}@e2e.local`;
    const senha = 'CifroE2E#2026!';

    dbQuery('INSERT INTO bandas (id,nome,ativo,plano) VALUES (?,?,1,?)', [outraBandaId, 'Outra Banda', 'mensal']);
    dbQuery('INSERT INTO usuarios (id,nome,email,senha_hash,perfil,ativo) VALUES (?,?,?,?,?,1)',
      [usuarioId, 'Músico de Duas', email, phpPasswordHash(senha), 'usuario']);
    dbQuery('INSERT INTO usuario_banda (usuario_id,banda_id,perfil) VALUES (?,?,?)',
      [usuarioId, outraBandaId, 'administrador']);

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const convidado = await ctx.newPage();

    await convidado.goto(caminho);
    await convidado.click('#conviteJaTenhoConta');
    await convidado.fill('input[name="email"]', email);
    await convidado.fill('input[name="senha"]', senha);
    await convidado.click('button[type="submit"]');
    await convidado.waitForURL(url => !url.toString().includes('login.php'));

    const { rows } = dbQuery('SELECT banda_id, perfil FROM usuario_banda WHERE usuario_id = ? ORDER BY perfil', [usuarioId]);
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.banda_id === outraBandaId).perfil).toBe('administrador');
    expect(rows.find(r => r.banda_id !== outraBandaId).perfil).toBe('basico');

    await ctx.close();
    dbQuery('DELETE FROM usuario_banda WHERE usuario_id = ?', [usuarioId]);
    dbQuery('DELETE FROM usuarios WHERE id = ?', [usuarioId]);
    dbQuery('DELETE FROM bandas WHERE id = ?', [outraBandaId]);
  });
});
```

Acrescente no topo do arquivo, se ainda não houver:

```js
import { execFileSync } from 'node:child_process';

function phpPasswordHash(senha) {
  return execFileSync('C:/xampp/php/php.exe', ['-r', `echo password_hash(${JSON.stringify(senha)}, PASSWORD_DEFAULT);`], { encoding: 'utf8' }).trim();
}
```

A limpeza no fim do teste é obrigatória — DEBT-007 registra 198 bandas órfãs acumuladas por testes que criam e não removem.

- [ ] **Step 8: Rodar o teste E2E**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js -g "já tem conta"`
Expected: PASS.

- [ ] **Step 9: Pare para revisão**

Não commite.

---

### Task 11: Plano Gratuito e teto atingido

**Files:**
- Test: `tests/cifro/78-convite-banda.spec.js` (acrescentar bloco)

**Interfaces:**
- Consumes: tudo que as tarefas anteriores produziram
- Produces: nenhum código novo — esta tarefa só prova o comportamento comercial

**Lembrete do ambiente:** o `TEST_EMAIL` padrão é `master`, e `cifro_require_plan_limit()` sai cedo para master. Este teste **precisa** de uma banda `gratuito` com administrador não-master.

- [ ] **Step 1: Escrever o teste**

Acrescente ao fim de `tests/cifro/78-convite-banda.spec.js`:

```js
test.describe('Convite da banda — limites do plano', () => {
  test('banda no plano Gratuito não gera link e é convidada a fazer upgrade', async ({ browser }) => {
    const sufixo = Date.now();
    const bandaId = `e2e-gratuita-${sufixo}`;
    const adminId = `e2e-admin-gratuito-${sufixo}`;
    const email = `admin-gratuito-${sufixo}@e2e.local`;
    const senha = 'CifroE2E#2026!';

    // Administrador NÃO-master: master pula a checagem de limite de plano.
    dbQuery('INSERT INTO bandas (id,nome,ativo,plano) VALUES (?,?,1,?)', [bandaId, 'Banda Gratuita', 'gratuito']);
    dbQuery('INSERT INTO usuarios (id,nome,email,senha_hash,perfil,ativo) VALUES (?,?,?,?,?,1)',
      [adminId, 'Admin Gratuito', email, phpPasswordHash(senha), 'usuario']);
    dbQuery('INSERT INTO usuario_banda (usuario_id,banda_id,perfil) VALUES (?,?,?)',
      [adminId, bandaId, 'administrador']);

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const admin = await ctx.newPage();

    await admin.goto('/login.php');
    await admin.fill('input[name="email"]', email);
    await admin.fill('input[name="senha"]', senha);
    await admin.click('button[type="submit"]');
    await admin.waitForURL(url => !url.toString().includes('login.php'));

    await admin.goto('/minha-banda.php?aba=membros');
    const csrf = await admin.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));

    const res = await admin.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });

    expect(res.status()).toBe(403);
    const corpo = await res.json();
    expect(corpo.plano_limit).toBe(true);
    expect(corpo.mensagem).toMatch(/Gratuito/);

    // E nenhum convite foi criado — o link impossível de usar nem chega a existir.
    const { rows } = dbQuery('SELECT COUNT(*) AS total FROM banda_convites WHERE banda_id = ?', [bandaId]);
    expect(Number(rows[0].total)).toBe(0);

    await ctx.close();
    dbQuery('DELETE FROM usuario_banda WHERE usuario_id = ?', [adminId]);
    dbQuery('DELETE FROM usuarios WHERE id = ?', [adminId]);
    dbQuery('DELETE FROM bandas WHERE id = ?', [bandaId]);
  });

  test('banda que atinge o teto durante a validade do link recusa o convidado sem criar conta órfã', async ({ page, browser }) => {
    await page.goto('/minha-banda.php?aba=membros');
    const csrfAdmin = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'));
    const { caminho } = await (await page.request.post('/api/bandas/convite.php', {
      data: JSON.stringify({ action: 'gerar' }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfAdmin },
    })).json();

    // O link foi gerado com a banda folgada; agora ela cai para o Gratuito,
    // que já não comporta nem mais um membro. É o caso do downgrade ou do
    // pagamento que falhou dentro das 24h de validade.
    const bandaId = await page.evaluate(() => window.CIFRO_BAND_ID);
    const { rows: antes } = dbQuery('SELECT plano FROM bandas WHERE id = ?', [bandaId]);
    dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', ['gratuito', bandaId]);

    try {
      const email = `orfao-${Date.now()}@e2e.local`;
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const convidado = await ctx.newPage();

      await convidado.goto(caminho);
      await convidado.click('#conviteCriarConta');
      await convidado.fill('#nome', 'Convidado Tardio');
      await convidado.fill('#email', email);
      await convidado.check('#legal_acceptance');
      await convidado.click('button[type="submit"]');

      await expect(convidado.getByText(/limite de músicos do plano/i)).toBeVisible();

      // A conta NÃO pode ter sobrado no banco sem banda: a transação volta atrás.
      const { rows } = dbQuery('SELECT id FROM usuarios WHERE email = ?', [email]);
      expect(rows).toHaveLength(0);

      await ctx.close();
    } finally {
      dbQuery('UPDATE bandas SET plano = ? WHERE id = ?', [antes[0].plano, bandaId]);
    }
  });
});
```

- [ ] **Step 2: Rodar**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js -g "limites do plano"`
Expected: PASS, 2 testes.

Se o segundo teste falhar porque o usuário ficou no banco, o problema está no `catch` do `RegisterController` (Task 9, step 3e): confirme que `RuntimeException` cai no `catch (Exception $e)` e que o `rollBack()` acontece antes do `render_view`.

- [ ] **Step 3: Pare para revisão**

Não commite.

---

### Task 12: Fechamento — suíte completa e documentação

**Files:**
- Modify: `docs/funcionalidades.md`
- Modify: `docs/api.md`
- Modify: `docs/modelo-de-dados.md`
- Modify: `docs/seguranca-e-permissoes.md`
- Modify: `docs/testes.md`
- Modify: `backlog.md`

- [ ] **Step 1: Rodar a suíte inteira do arquivo novo**

Run: `npx playwright test --project=cifro tests/cifro/78-convite-banda.spec.js`
Expected: PASS, todos os blocos.

- [ ] **Step 2: Rodar a suíte E2E principal**

Run: `npm run test:e2e`
Expected: PASS. DEBT-003 registra que esta suíte tem instabilidade por ordem — se algo falhar, rode o arquivo suspeito isolado antes de concluir que você quebrou alguma coisa. Falhas conhecidas estão listadas em DEBT-003 no `backlog.md`.

- [ ] **Step 3: Rodar os testes de unidade**

Run: `npm run test:unit`
Expected: PASS, tirando as 3 falhas pré-existentes de `tests/marketing/timeline.test.js` (DEBT-009).

- [ ] **Step 4: Documentar**

Em cada arquivo, acrescente na seção correspondente:

- **`docs/funcionalidades.md`** — o fluxo do convite por link: botão na aba Membros, validade de 24h, perfil `basico`, revogação, e o fato de ser funcionalidade de plano pago.
- **`docs/api.md`** — `GET/POST /api/bandas/convite.php` com os três formatos de resposta e os códigos de erro (403 `plano_limit`, 422 ação inválida).
- **`docs/modelo-de-dados.md`** — a tabela `banda_convites` e suas colunas.
- **`docs/seguranca-e-permissoes.md`** — token só como hash, aceite por POST com CSRF, rate limit, tela neutra que não revela o nome da banda, e a dupla checagem do teto do plano (geração e aceite).
- **`docs/testes.md`** — `78-convite-banda.spec.js` e os testes PHPUnit novos (`BandaConvitePolicyTest`, `BandaConviteRepositoryTest`, `BandaConviteFlowTest`).

- [ ] **Step 5: Marcar o item no backlog**

Em `backlog.md`, na seção `## ROLE-003`, acrescente logo abaixo do título:

```markdown
**Estado:** implementado em 2026-08-17. Plano: `docs/superpowers/plans/2026-08-17-convite-banda-por-link.md`.
```

E registre o desvio, para ninguém "corrigir" isso depois por engano:

```markdown
**Desvio do spec:** o link não é reaproveitado entre gerações — guardar só o hash do token torna impossível recuperar um link já compartilhado. Cada toque em "Convidar" gera um token novo e os anteriores continuam válidos até expirarem; revogar derruba todos. É o que evita que tocar o botão duas vezes mate em silêncio o link recém-enviado ao grupo.
```

- [ ] **Step 6: Pare para revisão final**

Mostre o diff completo. **Não commite** — o Felipe commita.
