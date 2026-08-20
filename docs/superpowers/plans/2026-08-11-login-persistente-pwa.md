# Login persistente no PWA (token "lembrar-me") — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manter o músico logado indefinidamente no PWA até ele sair, com um token revogável separado da sessão PHP.

**Architecture:** Cookie `cifro_lembrar` no padrão selector+validator, guardado na tabela nova `auth_tokens` (só o hash do validador vai ao banco). O `bootstrap.php` recria a sessão a partir do token antes de qualquer `require_auth`, rotacionando o validador a cada uso. A sessão PHP continua curta e descartável; o token é a única coisa de vida longa, e é revogável em massa.

**Tech Stack:** PHP 8.0 (XAMPP), MySQL/InnoDB, PHPUnit 9.6, Playwright.

Spec: `docs/superpowers/specs/2026-08-11-login-persistente-pwa-design.md`

## Global Constraints

- Nomes de teste em português de negócio (padrão da suíte). Ex.: `testTokenValidoRecriaSessao`.
- Classes carregadas por autoload de diretório: `Services/`, `Controllers/`, `Repositories/` — sem namespace, nome do arquivo == nome da classe.
- Serviços testáveis recebem dependências por construtor (padrão de `PasswordResetFlow`), para que os testes usem `$this->createMock(...)`.
- Repositórios obtêm a conexão com `Database::getConnection()` no construtor (padrão de `BandaRepository`).
- Cookie: nome `cifro_lembrar`, `httponly=true`, `samesite=Lax`, `secure` só sob HTTPS, validade 1 ano (`31536000` s).
- Nunca gravar o validador em claro: só `hash('sha256', $validador)`.
- Comparar validadores exclusivamente com `hash_equals`.
- Rodar testes PHP com: `npm run test:unit:php`
- Rodar um teste E2E: `npx playwright test --project=cifro <arquivo>` — **nunca** rodar duas invocações do Playwright ao mesmo tempo (elas compartilham `tests/.auth/*.json` e se atropelam).
- **Não alterar `SESSION_IDLE_SECONDS`** (`bootstrap.php:200`, 8h). Decisão do spec: a sessão em disco continua curta e a continuidade fica por conta do token, que é revogável. Esticar os dois seria redundante e enfraqueceria a sessão sem ganho.
- **Não commitar.** O usuário faz os commits. Onde o plano diz "Commit", pare e avise que a tarefa está pronta para revisão.

---

### Task 1: Tabela `auth_tokens`

**Files:**
- Modify: `create_tables.sql` (schema canônico — é o que `setup_e2e_db.php` executa)
- Modify: `scripts/setup/setup_db.php` (caminho paralelo; `password_reset_tokens` também vive nos dois)

**Interfaces:**
- Consumes: nada
- Produces: tabela `auth_tokens` com colunas `seletor CHAR(32) PK`, `validador_hash CHAR(64)`, `usuario_id CHAR(36)`, `criado_em TIMESTAMP`, `usado_em TIMESTAMP NULL`

- [ ] **Step 1: Adicionar a tabela ao setup**

Em `scripts/setup/setup_db.php`, logo após o bloco `CREATE TABLE IF NOT EXISTS password_reset_tokens (...)`, acrescentar:

```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
  seletor        CHAR(32)  NOT NULL,
  validador_hash CHAR(64)  NOT NULL,
  usuario_id     CHAR(36)  NOT NULL,
  criado_em      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usado_em       TIMESTAMP NULL,
  PRIMARY KEY (seletor),
  KEY idx_usuario (usuario_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Siga exatamente a forma como as outras tabelas são declaradas nesse arquivo (mesma variável/mesmo mecanismo de execução — leia o arquivo antes de editar).

- [ ] **Step 2: Recriar o banco E2E e conferir que a tabela existe**

Run: `npm run test:e2e:db:setup`
Expected: `Banco E2E local pronto: cifro_e2e_test`

Run: `C:/xampp/php/php.exe -r "$p=new PDO('mysql:host=localhost;dbname=cifro_e2e_test','root','');var_dump($p->query('SHOW TABLES LIKE \"auth_tokens\"')->rowCount());"`
Expected: `int(1)`

- [ ] **Step 3: Commit** (pare e avise — o usuário commita)

```
feat: tabela auth_tokens para login persistente
```

---

### Task 2: `AuthTokenService` — a decisão, sem banco nem HTTP

**Files:**
- Create: `public/src/Services/AuthTokenService.php`
- Create: `tests/php/AuthTokenServiceTest.php`

**Interfaces:**
- Consumes: `AuthTokenRepository` (Task 3) apenas como *type hint* do construtor. Esta task é escrita e testada com `createMock(AuthTokenRepository::class)`; como a classe real ainda não existe, **crie primeiro o stub vazio** descrito no Step 1.
- Produces:
  - `AuthTokenService::__construct(AuthTokenRepository $repo)`
  - `AuthTokenService::parseCookie(string $valor): ?array` → `['seletor' => string, 'validador' => string]` ou `null`
  - `AuthTokenService::validar(string $valorCookie): array` → sempre um array com a chave `status`, que vale `'valido'`, `'invalido'` ou `'reuso_detectado'`; quando `'valido'` ou `'reuso_detectado'` traz também `'usuarioId' => string`
  - Constantes: `AuthTokenService::COOKIE_NOME = 'cifro_lembrar'`, `AuthTokenService::VALIDADE_SEGUNDOS = 31536000`

- [ ] **Step 1: Criar o stub do repositório para o type hint**

Crie `public/src/Repositories/AuthTokenRepository.php` com apenas a forma dos métodos (o corpo real vem na Task 3):

```php
<?php
class AuthTokenRepository {
    private $pdo;

    public function __construct() {
        $this->pdo = Database::getConnection();
    }

    /** @return array{seletor:string,validador_hash:string,usuario_id:string}|null */
    public function encontrarPorSeletor(string $seletor): ?array { return null; }

    public function emitir(string $usuarioId): array { return []; }

    public function rotacionar(string $seletor): string { return ''; }

    public function revogar(string $seletor): void {}

    public function revogarTodosDoUsuario(string $usuarioId): void {}
}
```

- [ ] **Step 2: Escrever os testes que falham**

Crie `tests/php/AuthTokenServiceTest.php`:

```php
<?php

use PHPUnit\Framework\TestCase;

final class AuthTokenServiceTest extends TestCase
{
    private function repoQueRetorna(?array $linha): AuthTokenRepository
    {
        $repo = $this->createMock(AuthTokenRepository::class);
        $repo->method('encontrarPorSeletor')->willReturn($linha);
        return $repo;
    }

    private function linha(string $validador, string $usuarioId = 'user-1'): array
    {
        return [
            'seletor'        => 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
            'validador_hash' => hash('sha256', $validador),
            'usuario_id'     => $usuarioId,
        ];
    }

    // ---- parseCookie ----

    public function testParseCookieAceitaFormatoSeletorDoisPontosValidador(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna(null));
        self::assertSame(
            ['seletor' => 'abc', 'validador' => 'xyz'],
            $service->parseCookie('abc:xyz')
        );
    }

    public function testParseCookieRejeitaCookieSemSeparador(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna(null));
        self::assertNull($service->parseCookie('semseparador'));
    }

    public function testParseCookieRejeitaCookieVazioOuIncompleto(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna(null));
        self::assertNull($service->parseCookie(''));
        self::assertNull($service->parseCookie('abc:'));
        self::assertNull($service->parseCookie(':xyz'));
    }

    // ---- validar ----

    public function testTokenValidoIdentificaOUsuario(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna($this->linha('validador-secreto')));
        $resultado = $service->validar('a1b2c3d4e5f60718293a4b5c6d7e8f90:validador-secreto');
        self::assertSame('valido', $resultado['status']);
        self::assertSame('user-1', $resultado['usuarioId']);
    }

    public function testValidadorErradoNaoAutentica(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna($this->linha('validador-secreto')));
        $resultado = $service->validar('a1b2c3d4e5f60718293a4b5c6d7e8f90:validador-errado');
        self::assertSame('reuso_detectado', $resultado['status']);
        self::assertSame('user-1', $resultado['usuarioId']);
    }

    public function testSeletorInexistenteEhInvalido(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna(null));
        $resultado = $service->validar('naoexiste:qualquer');
        self::assertSame('invalido', $resultado['status']);
        self::assertArrayNotHasKey('usuarioId', $resultado);
    }

    public function testCookieMalformadoEhTratadoComoAusente(): void
    {
        $repo = $this->createMock(AuthTokenRepository::class);
        $repo->expects(self::never())->method('encontrarPorSeletor');
        $service = new AuthTokenService($repo);
        self::assertSame('invalido', $service->validar('lixo-sem-dois-pontos')['status']);
    }
}
```

Nota sobre `testValidadorErradoNaoAutentica`: seletor existente com validador que não confere é exatamente a assinatura de um cookie clonado sendo reusado depois da rotação — por isso o status é `reuso_detectado` (e não apenas `invalido`), e ele carrega o `usuarioId` para que o chamador possa revogar tudo daquele usuário.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm run test:unit:php`
Expected: FAIL — `Class "AuthTokenService" not found`

- [ ] **Step 4: Implementar o serviço**

Crie `public/src/Services/AuthTokenService.php`:

```php
<?php
/**
 * AuthTokenService — decide se um cookie "lembrar-me" autentica alguém.
 *
 * Sem HTTP e sem $_SESSION de propósito: toda a decisão fica testável com um
 * AuthTokenRepository mockado. Quem chama (bootstrap.php) é que traduz o
 * resultado em sessão, cookie e revogação.
 */
class AuthTokenService
{
    public const COOKIE_NOME = 'cifro_lembrar';
    public const VALIDADE_SEGUNDOS = 31536000; // 1 ano

    private AuthTokenRepository $repo;

    public function __construct(AuthTokenRepository $repo)
    {
        $this->repo = $repo;
    }

    /** @return array{seletor:string,validador:string}|null */
    public function parseCookie(string $valor): ?array
    {
        if (substr_count($valor, ':') !== 1) return null;
        [$seletor, $validador] = explode(':', $valor, 2);
        if ($seletor === '' || $validador === '') return null;
        return ['seletor' => $seletor, 'validador' => $validador];
    }

    /**
     * @return array{status:string,usuarioId?:string}
     *   status: 'valido' | 'invalido' | 'reuso_detectado'
     */
    public function validar(string $valorCookie): array
    {
        $partes = $this->parseCookie($valorCookie);
        if ($partes === null) return ['status' => 'invalido'];

        $linha = $this->repo->encontrarPorSeletor($partes['seletor']);
        if ($linha === null) return ['status' => 'invalido'];

        $esperado = (string) ($linha['validador_hash'] ?? '');
        $recebido = hash('sha256', $partes['validador']);

        // Seletor existe mas o validador não confere: assinatura de cookie
        // clonado reusado depois da rotação. Quem chama deve revogar tudo.
        if (!hash_equals($esperado, $recebido)) {
            return ['status' => 'reuso_detectado', 'usuarioId' => (string) $linha['usuario_id']];
        }

        return ['status' => 'valido', 'usuarioId' => (string) $linha['usuario_id']];
    }
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm run test:unit:php`
Expected: PASS — os 6 testes novos de `AuthTokenServiceTest` verdes, e nenhum dos 455 existentes quebrado.

- [ ] **Step 6: Commit** (pare e avise)

```
feat: AuthTokenService com validação e detecção de reuso
```

---

### Task 3: `AuthTokenRepository` — o SQL de verdade

**Files:**
- Modify: `public/src/Repositories/AuthTokenRepository.php` (substituir os stubs da Task 2)
- Create: `tests/cifro/68-auth-token-repository.spec.js`

**Interfaces:**
- Consumes: tabela `auth_tokens` (Task 1)
- Produces:
  - `emitir(string $usuarioId): array` → `['seletor' => string(32), 'validador' => string(64)]` (valores em claro, para montar o cookie)
  - `encontrarPorSeletor(string $seletor): ?array`
  - `rotacionar(string $seletor): string` → devolve o **novo validador em claro** e atualiza `validador_hash` + `usado_em`
  - `revogar(string $seletor): void`
  - `revogarTodosDoUsuario(string $usuarioId): void`

Este repositório fala com o banco, então é coberto por um teste E2E (que tem banco), não por PHPUnit puro — mesmo critério usado no resto da suíte.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/cifro/68-auth-token-repository.spec.js`:

```js
/**
 * 68-auth-token-repository.spec.js
 * Exercita o AuthTokenRepository contra o banco E2E real, via PHP CLI.
 */
import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

/** Roda um trecho PHP com o autoload do app e devolve o que ele imprimir em JSON. */
function runPhp(codigo) {
  const script = `
    require 'public/src/backend/bootstrap.php';
    ${codigo}
  `;
  const saida = execFileSync('C:/xampp/php/php.exe', ['-r', script], {
    encoding: 'utf8',
    env: { ...process.env, APP_ENV: 'test' },
  });
  const ultimaLinha = saida.trim().split('\n').pop();
  return JSON.parse(ultimaLinha);
}

let userId;

test.beforeEach(() => {
  userId = crypto.randomUUID();
  dbQuery(
    `INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, plano)
     VALUES (?, 'Token E2E', ?, 'x', 'usuario', 1, 'ativo')`,
    [userId, `token-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@e2e.local`],
  );
});

test.afterEach(() => {
  dbQuery('DELETE FROM auth_tokens WHERE usuario_id = ?', [userId]);
  dbQuery('DELETE FROM usuarios WHERE id = ?', [userId]);
});

test('emitir cria um token que é encontrado pelo seletor', () => {
  const par = runPhp(`
    $r = new AuthTokenRepository();
    echo json_encode($r->emitir(${JSON.stringify(userId)}));
  `);
  expect(par.seletor).toHaveLength(32);
  expect(par.validador).toHaveLength(64);

  const { rows } = dbQuery('SELECT usuario_id, validador_hash FROM auth_tokens WHERE seletor = ?', [par.seletor]);
  expect(rows).toHaveLength(1);
  expect(rows[0].usuario_id).toBe(userId);
  // o validador em claro nunca é gravado
  expect(rows[0].validador_hash).not.toBe(par.validador);
});

test('rotacionar troca o validador e invalida o anterior', () => {
  const resultado = runPhp(`
    $r = new AuthTokenRepository();
    $par = $r->emitir(${JSON.stringify(userId)});
    $novo = $r->rotacionar($par['seletor']);
    echo json_encode(['seletor' => $par['seletor'], 'antigo' => $par['validador'], 'novo' => $novo]);
  `);
  expect(resultado.novo).not.toBe(resultado.antigo);

  const { rows } = dbQuery('SELECT validador_hash, usado_em FROM auth_tokens WHERE seletor = ?', [resultado.seletor]);
  expect(rows[0].validador_hash).toBe(
    crypto.createHash('sha256').update(resultado.novo).digest('hex'),
  );
  expect(rows[0].usado_em).not.toBeNull();
});

test('sair de todos os aparelhos remove todos os tokens do usuário', () => {
  runPhp(`
    $r = new AuthTokenRepository();
    $r->emitir(${JSON.stringify(userId)});
    $r->emitir(${JSON.stringify(userId)});
    $r->revogarTodosDoUsuario(${JSON.stringify(userId)});
    echo json_encode(true);
  `);
  const { rows } = dbQuery('SELECT seletor FROM auth_tokens WHERE usuario_id = ?', [userId]);
  expect(rows).toHaveLength(0);
});

test('excluir a conta leva os tokens junto', () => {
  const par = runPhp(`
    $r = new AuthTokenRepository();
    echo json_encode($r->emitir(${JSON.stringify(userId)}));
  `);
  dbQuery('DELETE FROM usuarios WHERE id = ?', [userId]);
  const { rows } = dbQuery('SELECT seletor FROM auth_tokens WHERE seletor = ?', [par.seletor]);
  expect(rows).toHaveLength(0);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx playwright test --project=cifro tests/cifro/68-auth-token-repository.spec.js`
Expected: FAIL — `emitir` devolve `[]` (o stub da Task 2), então `par.seletor` é `undefined`.

- [ ] **Step 3: Implementar o repositório**

Substitua o conteúdo de `public/src/Repositories/AuthTokenRepository.php`:

```php
<?php
/**
 * AuthTokenRepository — persistência dos tokens "lembrar-me".
 *
 * O validador só existe em claro no cookie do usuário; aqui guardamos
 * apenas o SHA-256, de modo que um vazamento do banco não vira acesso.
 */
class AuthTokenRepository {
    private $pdo;

    public function __construct() {
        $this->pdo = Database::getConnection();
    }

    /** @return array{seletor:string,validador:string} valores em claro, para o cookie */
    public function emitir(string $usuarioId): array {
        $seletor   = bin2hex(random_bytes(16)); // 32 chars
        $validador = bin2hex(random_bytes(32)); // 64 chars
        $stmt = $this->pdo->prepare(
            'INSERT INTO auth_tokens (seletor, validador_hash, usuario_id) VALUES (?, ?, ?)'
        );
        $stmt->execute([$seletor, hash('sha256', $validador), $usuarioId]);
        return ['seletor' => $seletor, 'validador' => $validador];
    }

    /** @return array{seletor:string,validador_hash:string,usuario_id:string}|null */
    public function encontrarPorSeletor(string $seletor): ?array {
        $stmt = $this->pdo->prepare(
            'SELECT seletor, validador_hash, usuario_id FROM auth_tokens WHERE seletor = ? LIMIT 1'
        );
        $stmt->execute([$seletor]);
        $linha = $stmt->fetch(PDO::FETCH_ASSOC);
        return $linha ?: null;
    }

    /** Gera um validador novo para o mesmo seletor. @return string validador em claro */
    public function rotacionar(string $seletor): string {
        $validador = bin2hex(random_bytes(32));
        $stmt = $this->pdo->prepare(
            'UPDATE auth_tokens SET validador_hash = ?, usado_em = NOW() WHERE seletor = ?'
        );
        $stmt->execute([hash('sha256', $validador), $seletor]);
        return $validador;
    }

    public function revogar(string $seletor): void {
        $stmt = $this->pdo->prepare('DELETE FROM auth_tokens WHERE seletor = ?');
        $stmt->execute([$seletor]);
    }

    public function revogarTodosDoUsuario(string $usuarioId): void {
        $stmt = $this->pdo->prepare('DELETE FROM auth_tokens WHERE usuario_id = ?');
        $stmt->execute([$usuarioId]);
    }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx playwright test --project=cifro tests/cifro/68-auth-token-repository.spec.js`
Expected: PASS — 4 testes verdes.

Run: `npm run test:unit:php`
Expected: PASS — `AuthTokenServiceTest` continua verde (o mock não depende do corpo real).

- [ ] **Step 5: Commit** (pare e avise)

```
feat: AuthTokenRepository com emissão, rotação e revogação
```

---

### Task 4: Emitir o cookie no login e revogar no logout

**Files:**
- Modify: `public/src/Controllers/AuthController.php` (dentro de `finalizeLogin`, após `$_SESSION['usuario'] = [...]`)
- Modify: `public/logout.php`
- Create: `public/src/Services/AuthTokenCookie.php`

**Interfaces:**
- Consumes: `AuthTokenService::COOKIE_NOME`, `AuthTokenService::VALIDADE_SEGUNDOS` (Task 2); `AuthTokenRepository::emitir`, `::revogar` (Task 3)
- Produces:
  - `AuthTokenCookie::gravar(string $seletor, string $validador): void`
  - `AuthTokenCookie::apagar(): void`
  - `AuthTokenCookie::ler(): string` → valor cru do cookie, ou `''`

Isolar a manipulação do cookie numa classe própria evita repetir os cinco parâmetros de `setcookie` em três lugares diferentes e mantém a regra de `secure` num ponto só.

- [ ] **Step 1: Criar o helper de cookie**

Crie `public/src/Services/AuthTokenCookie.php`:

```php
<?php
/**
 * AuthTokenCookie — leitura e escrita do cookie "lembrar-me".
 * Mantém os atributos de segurança num lugar só.
 */
class AuthTokenCookie
{
    public static function ler(): string
    {
        return (string) ($_COOKIE[AuthTokenService::COOKIE_NOME] ?? '');
    }

    public static function gravar(string $seletor, string $validador): void
    {
        if (headers_sent()) return;
        setcookie(AuthTokenService::COOKIE_NOME, $seletor . ':' . $validador, self::opcoes(time() + AuthTokenService::VALIDADE_SEGUNDOS));
        $_COOKIE[AuthTokenService::COOKIE_NOME] = $seletor . ':' . $validador;
    }

    public static function apagar(): void
    {
        unset($_COOKIE[AuthTokenService::COOKIE_NOME]);
        if (headers_sent()) return;
        setcookie(AuthTokenService::COOKIE_NOME, '', self::opcoes(time() - 42000));
    }

    private static function opcoes(int $expira): array
    {
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        return [
            'expires'  => $expira,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax',
        ];
    }
}
```

- [ ] **Step 2: Separar "popular a sessão" de "concluir o login", e emitir o token**

`finalizeLogin` termina em `$this->redirect(...)`, que faz `exit`. A Task 5 precisa popular a sessão **sem** redirecionar (senão toda página com token válido viraria um redirect). Extraia a parte reutilizável.

Em `public/src/Controllers/AuthController.php`, substitua o corpo de `finalizeLogin` (linhas 111-148) por:

```php
    /**
     * Popula $_SESSION a partir de um usuário já autenticado.
     * Sem redirect e sem emitir token, para poder ser reaproveitado pela
     * revalidação por token "lembrar-me" no bootstrap.
     */
    public function popularSessao(array $user): void {
        if (session_status() === PHP_SESSION_ACTIVE && !headers_sent()) {
            session_regenerate_id(true);
        }
        $_SESSION['autenticado'] = true;
        $_SESSION['usuario'] = [
            'id'       => $user['id'] ?? null,
            'nome'     => $user['nome'] ?? '',
            'email'    => $user['email'] ?? '',
            'perfil'   => $user['perfil'] ?? 'usuario',
            'validade' => $user['validade'] ?? '',
            'config'   => $user['config'] ?? [],
            'bandas'   => $user['bandas'] ?? [],
        ];

        $bandas = $user['bandas'] ?? [];
        $configBandaAtual = ($user['config'] ?? [])['banda_atual'] ?? null;
        $bandaAtual = $this->resolveBandaAtual($bandas, $configBandaAtual);

        if ($bandaAtual) {
            $bandaRepo = $this->bandaRepository ?? new BandaRepository();
            $bandaInfo = $bandaRepo->findById($bandaAtual['id']);
            $_SESSION['banda_atual'] = [
                'id'    => $bandaAtual['id'],
                'nome'  => $bandaInfo['nome'] ?? '',
                'perfil'=> $bandaAtual['perfil'],
                'plano' => $bandaInfo['plano'] ?? 'ativo',
                'trial_expira_em' => $bandaInfo['trial_expira_em'] ?? null,
                'logo'            => $bandaInfo['logo'] ?? null,
            ];
        }

        $_SESSION['login_attempts'] = ['count' => 0, 'time' => time()];
    }

    public function finalizeLogin($user) {
        $this->popularSessao($user);

        // Token "lembrar-me": mantém o músico logado entre sessões do
        // navegador. Vive separado do PHPSESSID justamente para poder ser
        // revogado sem depender de encontrar arquivos de sessão em disco.
        if (!empty($user['id'])) {
            try {
                $par = (new AuthTokenRepository())->emitir((string) $user['id']);
                AuthTokenCookie::gravar($par['seletor'], $par['validador']);
            } catch (Throwable $e) {
                // Um login válido não pode falhar por causa do "lembrar-me".
                OperationalLogger::log('warning', 'auth.remember_token_failed', ['result' => 'degraded']);
            }
        }

        $bandas = $user['bandas'] ?? [];
        $redirect = $this->resolveRedirectTarget($user, $bandas, $_GET['urlcallback'] ?? null);

        $this->redirect($this->addAuthRefreshToken($redirect));
    }
```

O comportamento externo de `finalizeLogin` não muda — quem já o chamava continua vendo o mesmo redirect.

- [ ] **Step 3: Revogar no logout**

Em `public/logout.php`, **antes** de `$_SESSION = [];`, inserir:

```php
$valorLembrar = AuthTokenCookie::ler();
if ($valorLembrar !== '') {
    $partes = (new AuthTokenService(new AuthTokenRepository()))->parseCookie($valorLembrar);
    if ($partes !== null) {
        try { (new AuthTokenRepository())->revogar($partes['seletor']); } catch (Throwable $e) {}
    }
    AuthTokenCookie::apagar();
}
```

- [ ] **Step 4: Escrever o teste E2E do ciclo cookie**

Crie `tests/cifro/69-login-persistente.spec.js`:

```js
/**
 * 69-login-persistente.spec.js
 * O músico fecha o navegador e volta depois: continua logado, sem digitar senha.
 */
import { test, expect } from '../fixtures/coverage.js';
import { TEST_EMAIL, TEST_PASSWORD } from '../helpers/auth.js';

/** Remove só o cookie de sessão, preservando o "lembrar-me" — é o que fechar o navegador faz. */
async function simularFechamentoDoNavegador(context) {
  const cookies = await context.cookies();
  await context.clearCookies();
  const lembrar = cookies.filter(c => c.name === 'cifro_lembrar');
  expect(lembrar, 'o login deveria ter emitido o cookie cifro_lembrar').toHaveLength(1);
  await context.addCookies(lembrar);
}

test('login emite o cookie de lembrar-me', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await page.goto('/login.php');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="senha"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });

    const cookies = await context.cookies();
    const lembrar = cookies.find(c => c.name === 'cifro_lembrar');
    expect(lembrar).toBeTruthy();
    expect(lembrar.httpOnly).toBe(true);
    expect(lembrar.value).toContain(':');
  } finally {
    await context.close();
  }
});

test('fecha o navegador e volta depois: entra direto, sem digitar senha', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await page.goto('/login.php');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="senha"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });

    await simularFechamentoDoNavegador(context);

    await page.goto('/index.php');
    await expect(page).not.toHaveURL(/login\.php|landing\.php/);
    await expect(page.locator('#loginForm')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('sair de verdade não deixa rastro para ressuscitar o login', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  try {
    await page.goto('/login.php');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="senha"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });

    await page.goto('/logout.php');

    const cookies = await context.cookies();
    expect(cookies.find(c => c.name === 'cifro_lembrar' && c.value !== '')).toBeFalsy();

    await page.goto('/index.php');
    await expect(page).toHaveURL(/login\.php|landing\.php/);
  } finally {
    await context.close();
  }
});
```

- [ ] **Step 5: Rodar e confirmar o estado esperado**

Run: `npx playwright test --project=cifro tests/cifro/69-login-persistente.spec.js`
Expected: o 1º e o 3º testes **passam** (o cookie já é emitido e revogado). O 2º (`fecha o navegador e volta depois`) **falha**, porque ninguém ainda lê o cookie para recriar a sessão — isso é a Task 5.

- [ ] **Step 6: Commit** (pare e avise)

```
feat: emite e revoga o cookie de lembrar-me no login/logout
```

---

### Task 5: Recriar a sessão a partir do token no `bootstrap.php`

**Files:**
- Modify: `public/src/backend/bootstrap.php` (após o bloco de inatividade que termina na linha ~207, antes das funções de auth)

**Interfaces:**
- Consumes: `AuthTokenService::validar` (Task 2), `AuthTokenRepository::rotacionar`/`revogarTodosDoUsuario` (Task 3), `AuthTokenCookie` (Task 4), `UserRepository` para carregar o usuário
- Produces: função `cifro_tentar_login_por_token(): void`, chamada uma vez durante o bootstrap

- [ ] **Step 1: Entender a armadilha das bandas antes de codar**

`finalizeLogin` resolve a banda atual a partir de `$user['bandas']`, esperando itens no formato `['id' => ..., 'perfil' => ...]` (`AuthController.php:126-137`).

`UserRepository::findById()` **não preenche `bandas`** — só `findByEmail()` preenche. Se você recriar a sessão com `findById` puro, o usuário fica logado **sem banda atual**, e toda chamada a `/api/` devolve 404 "Banda não encontrada" (`bootstrap.php:377`). É uma falha silenciosa e chata de diagnosticar.

Além disso, `getBandasDoUsuario()` devolve a coluna como `usuario_perfil`, não `perfil` — precisa mapear. A Task já traz o código correto no Step 3.

- [ ] **Step 2: Implementar a revalidação**

Em `public/src/backend/bootstrap.php`, logo após o bloco `if (session_status() === PHP_SESSION_ACTIVE) { $_SESSION['_last_activity'] = time(); }`, inserir:

```php
// ===== Login persistente via token "lembrar-me" =====
// Roda antes de qualquer require_auth: se a sessão morreu (navegador fechado,
// inatividade, coleta do GC) mas o token continua válido, a sessão é recriada
// de forma transparente. A página então já sai autenticada do servidor, o que
// mantém o cache do service worker sendo alimentado normalmente.
function cifro_tentar_login_por_token(): void {
    if (!empty($_SESSION['autenticado'])) return;

    $valor = AuthTokenCookie::ler();
    if ($valor === '') return;

    try {
        $repo      = new AuthTokenRepository();
        $resultado = (new AuthTokenService($repo))->validar($valor);

        if ($resultado['status'] === 'reuso_detectado') {
            // Cookie clonado: derruba a família inteira e exige senha.
            $repo->revogarTodosDoUsuario($resultado['usuarioId']);
            AuthTokenCookie::apagar();
            OperationalLogger::log('warning', 'auth.remember_token_reuse', ['result' => 'revoked']);
            return;
        }

        if ($resultado['status'] !== 'valido') {
            AuthTokenCookie::apagar();
            return;
        }

        $partes = (new AuthTokenService($repo))->parseCookie($valor);
        $novoValidador = $repo->rotacionar($partes['seletor']);
        AuthTokenCookie::gravar($partes['seletor'], $novoValidador);

        (new AuthController())->finalizeLoginPorToken($resultado['usuarioId']);
        OperationalLogger::log('info', 'auth.remember_token_used', ['result' => 'success']);
    } catch (Throwable $e) {
        // Banco fora do ar: não recria a sessão e NÃO apaga o cookie — o
        // usuário cai no fluxo normal de não autenticado e o token volta a
        // funcionar quando o banco voltar.
        return;
    }
}

cifro_tentar_login_por_token();
```

- [ ] **Step 3: Expor a recriação de sessão no AuthController**

Em `public/src/Controllers/AuthController.php`, acrescentar:

```php
    /**
     * Recria a sessão a partir de um token "lembrar-me" já validado.
     *
     * Reaproveita finalizeLogin para que a sessão fique idêntica à de um login
     * normal. findById() não traz as bandas (só findByEmail traz), então elas
     * são carregadas à parte — sem isso a sessão nasce sem banda_atual e todo
     * endpoint passa a responder 404 "Banda não encontrada".
     */
    public function finalizeLoginPorToken(string $usuarioId): void {
        $repo = new UserRepository();
        $user = $repo->findById($usuarioId);
        if (!$user) return;

        // getBandasDoUsuario devolve a coluna como 'usuario_perfil';
        // finalizeLogin espera 'perfil'.
        $user['bandas'] = array_map(
            fn(array $b): array => ['id' => $b['id'], 'perfil' => $b['usuario_perfil']],
            $repo->getBandasDoUsuario($usuarioId)
        );

        // popularSessao, NÃO finalizeLogin: este último redireciona e faz exit,
        // o que no bootstrap jogaria o usuário para fora da página que ele
        // pediu. Também não emitimos token novo — já temos um, rotacionado
        // logo acima.
        $this->popularSessao($user);
    }

- [ ] **Step 4: Rodar o teste que estava falhando**

Run: `npx playwright test --project=cifro tests/cifro/69-login-persistente.spec.js`
Expected: PASS — os 3 testes verdes, incluindo `fecha o navegador e volta depois`.

- [ ] **Step 5: Conferir que nada regrediu na autenticação**

Run: `npm run test:unit:php`
Expected: PASS

Run: `npx playwright test --project=cifro tests/cifro/10-seguranca.spec.js tests/cifro/23-perfis-permissoes.spec.js tests/cifro/35-google-auth.spec.js`
Expected: PASS

- [ ] **Step 6: Commit** (pare e avise)

```
feat: recria a sessão a partir do token lembrar-me
```

---

### Task 6: "Sair de todos os aparelhos"

**Files:**
- Create: `public/api/account/logout-all.php`
- Modify: `public/src/Views/config.php` (junto dos botões de conta, perto de `#deleteAccountButton`)
- Modify: `tests/cifro/69-login-persistente.spec.js` (acrescentar teste)

**Interfaces:**
- Consumes: `AuthTokenRepository::revogarTodosDoUsuario` (Task 3), `AuthTokenCookie::apagar` (Task 4)
- Produces: `POST /api/account/logout-all.php` → `{ok:true}`; exige autenticação e CSRF

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao final de `tests/cifro/69-login-persistente.spec.js`:

```js
test('sair de todos os aparelhos derruba a sessão lembrada dos outros', async ({ browser }) => {
  const celular = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const tablet  = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    for (const ctx of [celular, tablet]) {
      const p = await ctx.newPage();
      await p.goto('/login.php');
      await p.fill('input[name="email"]', TEST_EMAIL);
      await p.fill('input[name="senha"]', TEST_PASSWORD);
      await p.click('button[type="submit"]');
      await p.waitForURL(url => !url.toString().includes('login.php'), { timeout: 10000 });
    }

    // No tablet, o usuário manda desconectar tudo.
    const tabletPage = tablet.pages()[0];
    const csrf = await tabletPage.evaluate(() => document.querySelector('meta[name=csrf-token]')?.content || '');
    const res = await tabletPage.request.post('/api/account/logout-all.php', {
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    });
    expect(res.status()).toBe(200);

    // O celular perde a sessão e o token não o ressuscita.
    await simularFechamentoDoNavegador(celular);
    const celularPage = celular.pages()[0];
    await celularPage.goto('/index.php');
    await expect(celularPage).toHaveURL(/login\.php|landing\.php/);
  } finally {
    await celular.close();
    await tablet.close();
  }
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx playwright test --project=cifro tests/cifro/69-login-persistente.spec.js -g "sair de todos"`
Expected: FAIL — 404, o endpoint ainda não existe.

- [ ] **Step 3: Criar o endpoint**

Leia antes `public/api/account/delete.php` e siga a mesma estrutura de guardas. Crie `public/api/account/logout-all.php`:

```php
<?php
/**
 * POST /api/account/logout-all.php
 * Revoga todos os tokens "lembrar-me" do usuário — o caminho para cortar o
 * acesso de um aparelho perdido sem precisar trocar a senha.
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'mensagem' => 'Método não permitido.']);
    exit;
}

require_auth_json();
require_csrf();

$usuarioId = $_SESSION['usuario']['id'] ?? '';
if ($usuarioId === '') {
    http_response_code(401);
    echo json_encode(['ok' => false, 'mensagem' => 'Não autenticado.']);
    exit;
}

(new AuthTokenRepository())->revogarTodosDoUsuario((string) $usuarioId);
AuthTokenCookie::apagar();
OperationalLogger::log('info', 'auth.logout_all', ['result' => 'success']);

echo json_encode(['ok' => true]);
```

- [ ] **Step 4: Adicionar o botão em config.php**

Leia `public/src/Views/config.php` na região do `#deleteAccountButton` e acrescente, seguindo o mesmo estilo de marcação e de chamada JS já usados ali, um botão `id="logoutAllButton"` com o texto **"Sair de todos os aparelhos"** que faz `POST /api/account/logout-all.php` com o header `X-CSRF-Token` e, ao receber `ok:true`, redireciona para `/login.php`. Não invente um padrão novo de botão nem de toast — copie o que o vizinho faz.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx playwright test --project=cifro tests/cifro/69-login-persistente.spec.js`
Expected: PASS — 4 testes verdes.

Run: `npx playwright test --project=cifro tests/cifro/05-config.spec.js tests/cifro/58-privacidade-conta.spec.js`
Expected: PASS

- [ ] **Step 6: Commit** (pare e avise)

```
feat: sair de todos os aparelhos revoga os tokens lembrar-me
```

---

### Task 7: Revogar tudo quando a senha muda

**Files:**
- Modify: `public/src/Services/PasswordResetFlow.php` (no ponto em que a senha é efetivamente gravada)
- Modify: `tests/php/PasswordResetFlowTest.php`

**Interfaces:**
- Consumes: `AuthTokenRepository::revogarTodosDoUsuario` (Task 3)
- Produces: nenhuma interface nova

- [ ] **Step 1: Conhecer o ponto exato da troca de senha**

O método é `PasswordResetFlow::handleSubmit(string $token, string $senha, string $senha2): array`. A gravação acontece na linha 41:

```php
        $this->repo->updatePassword($userId, password_hash($senha, PASSWORD_DEFAULT));
        return ['erro' => null, 'ok' => true, 'userId' => $userId, 'tokenInvalido' => false];
```

A variável com o id é `$userId`, vinda de `consumeToken($token)` na linha 36.

- [ ] **Step 2: Escrever o teste que falha**

Em `tests/php/PasswordResetFlowTest.php`, seguindo o estilo dos testes já existentes no arquivo (com `createMock`), acrescente um teste chamado `testTrocaDeSenhaRevogaTokensDeTodosOsAparelhos` que injeta um mock de `AuthTokenRepository`, espera `revogarTodosDoUsuario` ser chamado **uma vez** com o id do usuário, e executa o método de conclusão identificado no Step 1.

Para o mock ser injetável, `PasswordResetFlow::__construct` precisa aceitar um segundo parâmetro opcional:

```php
    public function __construct(UserRepository $repo, ?AuthTokenRepository $authTokens = null)
    {
        $this->repo = $repo;
        $this->authTokens = $authTokens;
    }
```

Deixar opcional (`?AuthTokenRepository $authTokens = null`) mantém compatível quem já constrói a classe com um argumento só.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm run test:unit:php`
Expected: FAIL — `revogarTodosDoUsuario` não foi chamado.

- [ ] **Step 4: Implementar**

Em `handleSubmit`, entre a linha do `updatePassword` e o `return` de sucesso:

```php
        $this->repo->updatePassword($userId, password_hash($senha, PASSWORD_DEFAULT));

        // Trocar a senha derruba os "lembrar-me" de todos os aparelhos: é a
        // expectativa de quem troca a senha justamente por suspeitar de acesso
        // indevido.
        ($this->authTokens ?? new AuthTokenRepository())->revogarTodosDoUsuario($userId);

        return ['erro' => null, 'ok' => true, 'userId' => $userId, 'tokenInvalido' => false];
```

Declare a propriedade junto de `private UserRepository $repo;`:

```php
    private ?AuthTokenRepository $authTokens;
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm run test:unit:php`
Expected: PASS

Run: `npx playwright test --project=cifro tests/cifro/14-senha-reset.spec.js`
Expected: PASS

- [ ] **Step 6: Commit** (pare e avise)

```
feat: troca de senha revoga os tokens de todos os aparelhos
```

---

### Task 8: Endpoint de status e banner de sessão expirada

**Files:**
- Create: `public/api/auth/status.php`
- Modify: `public/src/js/cifro-sync.js` (junto de `checkOfflinePlanBanner`, ~linha 717)
- Create: `tests/cifro/70-sessao-expirada-banner.spec.js`

**Interfaces:**
- Consumes: nada das tasks anteriores
- Produces:
  - `GET /api/auth/status.php` → `{ok:true, autenticado:bool}`, sempre HTTP 200, **nunca** redireciona
  - `checkSessaoExpiradaBanner(): Promise<void>` em `cifro-sync.js`, exposta em `window.cifroSync`

- [ ] **Step 1: Criar o endpoint**

Crie `public/api/auth/status.php`:

```php
<?php
/**
 * GET /api/auth/status.php
 * Diz apenas se a requisição está autenticada. Nunca redireciona e nunca
 * devolve 401: o cliente precisa distinguir "sem sessão" de "sem rede", e um
 * redirect atrapalharia essa leitura.
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

echo json_encode([
    'ok'          => true,
    'autenticado' => !empty($_SESSION['autenticado']),
]);
```

- [ ] **Step 2: Escrever o teste que falha**

Crie `tests/cifro/70-sessao-expirada-banner.spec.js`:

```js
/**
 * 70-sessao-expirada-banner.spec.js
 * Com a sessão inválida e cifras já salvas, o app não expulsa o músico:
 * mantém o conteúdo e avisa que precisa entrar de novo.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

test('status.php responde autenticado para quem tem sessão', async ({ page }) => {
  const res = await page.request.get('/api/auth/status.php');
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, autenticado: true });
});

test('status.php responde não autenticado para visitante, sem redirecionar', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const res = await ctx.request.get('/api/auth/status.php');
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, autenticado: false });
  await ctx.close();
});

test('sessão expirada mostra aviso sem tirar as cifras da tela', async ({ page }) => {
  await page.goto('/index.php');
  await expect(page.locator('#music-list')).toBeVisible();

  await page.route('**/api/auth/status.php', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, autenticado: false }) }));

  await page.evaluate(() => window.cifroSync.checkSessaoExpiradaBanner());

  const banner = page.locator('#_sessaoExpiradaBanner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Sessão expirada');
  // o conteúdo continua na tela
  await expect(page.locator('#music-list')).toBeVisible();
});

test('sessão válida não mostra aviso nenhum', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => window.cifroSync.checkSessaoExpiradaBanner());
  await expect(page.locator('#_sessaoExpiradaBanner')).toHaveCount(0);
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx playwright test --project=cifro tests/cifro/70-sessao-expirada-banner.spec.js`
Expected: os 2 primeiros passam; os 2 últimos falham — `checkSessaoExpiradaBanner is not a function`.

- [ ] **Step 4: Implementar o banner**

Em `public/src/js/cifro-sync.js`, imediatamente após a função `checkOfflinePlanBanner` (~linha 717), acrescentar — copiando o estilo visual dela para as duas telas ficarem consistentes:

```javascript
    // Sessão morta no servidor mas com conteúdo já salvo: avisa sem expulsar.
    // Tirar o músico da cifra no meio de um culto seria pior do que deixá-lo
    // em modo leitura até poder logar de novo.
    async function checkSessaoExpiradaBanner() {
        if (document.getElementById('_sessaoExpiradaBanner')) return;
        let autenticado = true;
        try {
            const res = await fetch((window.APP_BASE || '') + '/api/auth/status.php', { credentials: 'same-origin', cache: 'no-store' });
            autenticado = (await res.json()).autenticado !== false;
        } catch (_) {
            return; // sem rede: é offline normal, não sessão expirada
        }
        if (autenticado) return;
        sessaoInvalida = true;
        const banner = document.createElement('a');
        banner.id = '_sessaoExpiradaBanner';
        banner.href = (window.APP_BASE || '') + '/login.php';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:#111;text-align:center;padding:8px 16px;font-size:13px;font-weight:600;text-decoration:none;display:block';
        banner.textContent = 'Sessão expirada — suas cifras continuam disponíveis. Toque para entrar.';
        document.body.appendChild(banner);
    }
```

Declare `let sessaoInvalida = false;` junto das outras variáveis de módulo no topo do arquivo (perto de `const loadInFlight = new Map();`).

- [ ] **Step 5: Bloquear escrita quando a sessão é conhecidamente inválida**

Na função `sync(bandaId, options)` de `cifro-sync.js`, trocar a primeira linha:

```javascript
    function sync(bandaId, options = {}) {
        if (!bandaId || !isOnline()) return Promise.resolve(false);
```

por:

```javascript
    function sync(bandaId, options = {}) {
        // Sem sessão válida, sincronizar só produz 401 e ruído no console.
        if (!bandaId || !isOnline() || sessaoInvalida) return Promise.resolve(false);
```

- [ ] **Step 6: Expor a função e ligá-la ao reconectar**

Localize o objeto exportado (`window.cifroSync = cifroSync;`, ~linha 755) e acrescente `checkSessaoExpiradaBanner` à lista de métodos expostos, seguindo o formato já usado ali.

Ligue-a ao evento de reconexão, junto dos outros listeners de `cifro:connectivity` do arquivo:

```javascript
    document.addEventListener('cifro:connectivity', () => {
        if (isOnline()) checkSessaoExpiradaBanner();
    });
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `npx playwright test --project=cifro tests/cifro/70-sessao-expirada-banner.spec.js`
Expected: PASS — 4 testes verdes.

Run: `npx playwright test --project=cifro tests/cifro/26-offline-sync.spec.js tests/cifro/56-offline-auto-sync.spec.js tests/cifro/66-offline-persistent-login.spec.js`
Expected: PASS

- [ ] **Step 8: Commit** (pare e avise)

```
feat: avisa sessão expirada sem tirar as cifras da tela
```

---

### Task 9: Verificação final e documentação

**Files:**
- Modify: `docs/funcionalidades.md` e/ou `docs/api.md` (o que couber — leia antes para escolher)

**Interfaces:**
- Consumes: tudo
- Produces: nada

- [ ] **Step 1: Rodar a suíte inteira, sozinha**

Run: `npm run test:unit && npx playwright test --project=cifro`
Expected: PASS. Referência da última execução limpa: 701 passaram / 1 falhou (`64-help-center:57`, pré-existente e já corrigida em separado).

**Importante:** não rode nenhuma outra invocação do Playwright em paralelo — elas compartilham `tests/.auth/*.json` e uma sobrescreve a sessão da outra, produzindo falhas fantasma em `23-perfis-permissoes`.

- [ ] **Step 2: Documentar o comportamento novo**

Acrescente à documentação: o cookie `cifro_lembrar` (o que é, validade, como revogar), o endpoint `POST /api/account/logout-all.php`, o endpoint `GET /api/auth/status.php`, e a nota de que trocar a senha derruba todos os aparelhos. Siga o formato de seções já usado no arquivo escolhido.

- [ ] **Step 3: Commit** (pare e avise)

```
docs: login persistente e revogação de aparelhos
```

---

## Notas de segurança para quem implementa

- O validador **nunca** vai ao banco em claro — só `hash('sha256', ...)`. Se você se pegar gravando o valor do cookie, parou algo errado.
- Comparação **sempre** com `hash_equals`. `===` em string de segredo vaza tempo.
- Seletor e validador vêm de `random_bytes`, nunca de `rand`/`uniqid`.
- O cookie é `httponly`: nenhum JavaScript deve tentar lê-lo — inclusive os testes, que verificam presença via `context.cookies()` do Playwright, não via `document.cookie`.
- Se `emitir` falhar, o **login não pode falhar junto** — o `try/catch` da Task 4 é intencional.
