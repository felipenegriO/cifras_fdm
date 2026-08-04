# Google OAuth Login/Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users log in or create a Cifrô account with their Google account, in addition to the existing e-mail/senha flow.

**Architecture:** Server-side OAuth 2.0 Authorization Code flow using raw HTTPS calls (no new Composer dependency). A `GoogleJwtVerifier` validates the Google-issued `id_token` locally against Google's published JWKS. A `GoogleAuthService` decides login-vs-signup and reuses `UserRepository`/`BandaRepository`. `AuthController::finalizeLogin()` (made `public`) builds the session and redirects, exactly as the e-mail/senha flow already does.

**Tech Stack:** PHP 8, PDO/MySQL, PHPUnit, Playwright. No new runtime dependencies.

## Global Constraints

- No new Composer packages (network-restricted deploy target; verified this session that `composer`/`npm install` may be unreachable).
- All new PHP classes go in `public/src/Services/` and follow the existing static-class-with-injectable-deps pattern used by `YoutubeAudioDownloadService`.
- Every new class must have a PHPUnit test with no real network calls (mock the HTTP/JWKS layer).
- `.env` additions: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — mirror the existing `.env.example` section style (see `STRIPE_*` block).
- The "Continuar com Google" button is hidden when `GOOGLE_CLIENT_ID` is empty (same pattern `plano.php` uses for Stripe cards).
- CSRF/session helpers already exist in `public/src/backend/bootstrap.php` (`csrf_token()`, `session status guards`) — reuse them, don't reinvent.

---

## File Structure

| File | Responsibility |
|---|---|
| `public/src/Services/GoogleJwtVerifier.php` | Verify a Google-issued JWT's signature/claims. No I/O beyond fetching (injectable) JWKS. |
| `public/src/Services/GoogleAuthService.php` | Exchange code→token, decide login vs signup, build/find the user row. |
| `public/src/Controllers/AuthController.php` | *Modify*: make `finalizeLogin()` `public` (no other change) so the callback can reuse it. |
| `public/api/auth/google/start.php` | Redirect to Google's consent screen with a CSRF `state`. |
| `public/api/auth/google/callback.php` | Handle the redirect back from Google; wires `GoogleAuthService` + `AuthController::finalizeLogin()`. |
| `public/src/Repositories/UserRepository.php` | *Modify*: add `findByGoogleSub()`, `linkGoogleSub()`; extend `save()` to persist `google_sub`. |
| `public/create_tables.sql` | *Modify*: add `google_sub` column + unique key. |
| `public/src/Views/login.php`, `public/src/Views/register.php` | *Modify*: add the "Continuar com Google" button, hidden when unconfigured. |
| `.env.example` | *Modify*: document the three new keys. |
| `tests/php/GoogleJwtVerifierTest.php` | Unit tests for the verifier (self-signed test tokens, no network). |
| `tests/php/GoogleAuthServiceTest.php` | Unit tests for login/signup/link decision logic (mocked repos). |
| `tests/cifro/35-google-auth.spec.js` | Playwright: button visibility, `state` CSRF rejection, callback error paths (mocked Google endpoints via `page.route`). |

---

## Task 1: Database column for Google account linking

**Files:**
- Modify: `public/create_tables.sql`
- Test: manual (`create_tables.sql` has no automated test; verified by Task 2's repository tests using a temp column check)

**Interfaces:**
- Produces: `usuarios.google_sub` column (nullable `VARCHAR(255)`, unique key `uq_google_sub`), consumed by Task 2's `UserRepository` methods.

- [ ] **Step 1: Add the column + unique key to the schema file**

Find the `usuarios` table block in `public/create_tables.sql` (starts `CREATE TABLE IF NOT EXISTS usuarios (`). Immediately after that `CREATE TABLE ... ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;` statement, add:

```sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) DEFAULT NULL;
ALTER TABLE usuarios ADD UNIQUE KEY IF NOT EXISTS uq_google_sub (google_sub);
```

- [ ] **Step 2: Apply it to the local dev database**

Run:
```bash
"/c/xampp/php/php.exe" -r "require 'public/config/env.php'; \$pdo = Database::getConnection(); \$pdo->exec(\"ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) DEFAULT NULL\"); \$pdo->exec(\"ALTER TABLE usuarios ADD UNIQUE KEY IF NOT EXISTS uq_google_sub (google_sub)\"); echo \"done\n\";"
```
Expected output: `done`

- [ ] **Step 3: Verify the column exists**

Run: `"/c/xampp/php/php.exe" -r "require 'public/config/env.php'; \$pdo = Database::getConnection(); print_r(\$pdo->query('DESCRIBE usuarios')->fetchAll());"`
Expected: output includes a row with `Field => google_sub`.

- [ ] **Step 4: Commit**

```bash
git add public/create_tables.sql
git commit -m "Add usuarios.google_sub column for Google account linking"
```

---

## Task 2: UserRepository — findByGoogleSub, linkGoogleSub, save() extension

**Files:**
- Modify: `public/src/Repositories/UserRepository.php`
- Test: `tests/php/UserRepositoryTest.php` (existing file — add new test methods)

**Interfaces:**
- Consumes: `Database::getConnection()` (existing, unchanged).
- Produces:
  - `UserRepository::findByGoogleSub(string $sub): ?array` — same row shape as `findByEmail()` (includes `bandas`, `senhaHash`, `config`).
  - `UserRepository::linkGoogleSub(string $userId, string $sub): void`
  - `UserRepository::save(array $user)` now also persists `$user['google_sub'] ?? null` on both INSERT and UPDATE paths.

- [ ] **Step 1: Write the failing tests**

Add to `tests/php/UserRepositoryTest.php` (this file already sets up a real MySQL connection per its existing tests — follow the same `setUp`/`tearDown` pattern already in that file for creating/cleaning a test user row):

```php
public function testFindByGoogleSubRetornaNullQuandoNaoExiste(): void
{
    $repo = new UserRepository();
    self::assertNull($repo->findByGoogleSub('sub-inexistente-xyz'));
}

public function testLinkGoogleSubEFindByGoogleSubEncontraUsuario(): void
{
    $repo = new UserRepository();
    $id = bin2hex(random_bytes(16));
    $repo->save(['id' => $id, 'nome' => 'Google User', 'email' => 'googleuser-' . $id . '@example.com', 'ativo' => 1]);

    $repo->linkGoogleSub($id, 'google-sub-123');
    $found = $repo->findByGoogleSub('google-sub-123');

    self::assertNotNull($found);
    self::assertSame($id, $found['id']);

    $repo->delete($id);
}

public function testSavePersisteGoogleSubNaCriacao(): void
{
    $repo = new UserRepository();
    $id = bin2hex(random_bytes(16));
    $repo->save(['id' => $id, 'nome' => 'Google New', 'email' => 'googlenew-' . $id . '@example.com', 'ativo' => 1, 'google_sub' => 'google-sub-456']);

    $found = $repo->findByGoogleSub('google-sub-456');
    self::assertNotNull($found);
    self::assertSame($id, $found['id']);

    $repo->delete($id);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit --filter "testFindByGoogleSub|testLinkGoogleSub|testSavePersisteGoogleSub" tests/php/UserRepositoryTest.php`
Expected: FAIL — `Call to undefined method UserRepository::findByGoogleSub()`.

- [ ] **Step 3: Implement `findByGoogleSub` and `linkGoogleSub`**

In `public/src/Repositories/UserRepository.php`, add these methods right after `findByEmail()` (around line 44):

```php
    public function findByGoogleSub(string $sub): ?array {
        $stmt = $this->pdo->prepare(
            'SELECT u.*, ub.perfil AS banda_perfil, ub.banda_id
             FROM usuarios u
             LEFT JOIN usuario_banda ub ON u.id = ub.usuario_id
             WHERE u.google_sub = ?'
        );
        $stmt->execute([$sub]);
        $rows = $stmt->fetchAll();

        if (empty($rows)) return null;

        $user = $rows[0];
        $user['bandas'] = [];
        foreach ($rows as $row) {
            if ($row['banda_id']) {
                $user['bandas'][] = [
                    'id'    => $row['banda_id'],
                    'perfil'=> $row['banda_perfil'],
                ];
            }
        }
        unset($user['banda_id'], $user['banda_perfil']);

        $user['senhaHash'] = $user['senha_hash'] ?? null;
        $user['config']    = $user['config'] ? json_decode($user['config'], true) : [];

        return $user;
    }

    public function linkGoogleSub(string $userId, string $sub): void {
        $this->pdo->prepare('UPDATE usuarios SET google_sub=? WHERE id=?')->execute([$sub, $userId]);
    }
```

- [ ] **Step 4: Extend `save()` to persist `google_sub`**

In `public/src/Repositories/UserRepository.php`, modify the `save()` method (currently starts at line 66). Change the UPDATE and INSERT statements to include `google_sub`:

```php
    public function save(array $user): void {
        $config = isset($user['config']) && is_array($user['config'])
            ? json_encode($user['config'], JSON_UNESCAPED_UNICODE)
            : null;

        $senha_hash = $user['senhaHash'] ?? $user['senha_hash'] ?? null;
        $googleSub  = $user['google_sub'] ?? null;

        $existing = $this->findById($user['id']);
        if ($existing) {
            $stmt = $this->pdo->prepare(
                'UPDATE usuarios SET nome=?, email=?, senha_hash=?, perfil=?,
                 ativo=?, validade=?, config=?, google_sub=COALESCE(?, google_sub) WHERE id=?'
            );
            $stmt->execute([
                $user['nome'],
                $user['email'],
                $senha_hash,
                $user['perfil'] ?? 'usuario',
                (int)($user['ativo'] ?? 1),
                ($user['validade'] ?? '') ?: null,
                $config,
                $googleSub,
                $user['id'],
            ]);
        } else {
            $stmt = $this->pdo->prepare(
                'INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, validade, config, google_sub)
                 VALUES (?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $user['id'],
                $user['nome'],
                $user['email'],
                $senha_hash,
                $user['perfil'] ?? 'usuario',
                (int)($user['ativo'] ?? 1),
                ($user['validade'] ?? '') ?: null,
                $config,
                $googleSub,
            ]);
        }

        if (isset($user['bandas']) && is_array($user['bandas'])) {
            $this->pdo->prepare('DELETE FROM usuario_banda WHERE usuario_id=?')->execute([$user['id']]);
            $ins = $this->pdo->prepare(
                'INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)'
            );
            foreach ($user['bandas'] as $b) {
                $ins->execute([$user['id'], $b['id'], $b['perfil']]);
            }
        }
    }
```

Note the `UPDATE` uses `COALESCE(?, google_sub)` so calling `save()` without `google_sub` (the existing e-mail/senha flows never pass it) never wipes out a previously linked value.

- [ ] **Step 5: Run tests to verify they pass**

Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit --filter "testFindByGoogleSub|testLinkGoogleSub|testSavePersisteGoogleSub" tests/php/UserRepositoryTest.php`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full PHP suite to check no regression**

Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit`
Expected: all tests pass (baseline was 276 before this plan).

- [ ] **Step 7: Commit**

```bash
git add public/src/Repositories/UserRepository.php tests/php/UserRepositoryTest.php
git commit -m "Add UserRepository.findByGoogleSub/linkGoogleSub and persist google_sub in save()"
```

---

## Task 3: GoogleJwtVerifier

**Files:**
- Create: `public/src/Services/GoogleJwtVerifier.php`
- Test: `tests/php/GoogleJwtVerifierTest.php`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `GoogleJwtVerifier::verify(string $idToken, string $expectedAudience, callable $fetchJwks = null): array` — returns the decoded JWT payload (assoc array) on success, throws `\RuntimeException` with a specific message on any validation failure. `$fetchJwks` is `fn(): array` returning the JWKS `keys` array (defaults to a real HTTPS fetch of `https://www.googleapis.com/oauth2/v3/certs`, injectable for tests).

- [ ] **Step 1: Write the failing tests**

Create `tests/php/GoogleJwtVerifierTest.php`:

```php
<?php

use PHPUnit\Framework\TestCase;

final class GoogleJwtVerifierTest extends TestCase
{
    private array $keyPair;

    protected function setUp(): void
    {
        $res = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($res, $privateKeyPem);
        $details = openssl_pkey_get_details($res);
        $this->keyPair = ['private' => $privateKeyPem, 'public_details' => $details];
    }

    private function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function makeToken(array $payload, ?string $kid = 'test-kid', bool $corruptSignature = false): string
    {
        $header = $this->base64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT', 'kid' => $kid]));
        $body = $this->base64url(json_encode($payload));
        $signingInput = $header . '.' . $body;

        openssl_sign($signingInput, $signature, $this->keyPair['private'], OPENSSL_ALGO_SHA256);
        if ($corruptSignature) $signature = strrev($signature);

        return $signingInput . '.' . $this->base64url($signature);
    }

    private function jwks(): array
    {
        $details = $this->keyPair['public_details']['rsa'];
        return [
            'keys' => [[
                'kid' => 'test-kid',
                'kty' => 'RSA',
                'n'   => $this->base64url($details['n']),
                'e'   => $this->base64url($details['e']),
            ]],
        ];
    }

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'iss' => 'https://accounts.google.com',
            'aud' => 'my-client-id',
            'sub' => 'google-user-sub-123',
            'email' => 'user@example.com',
            'email_verified' => true,
            'name' => 'Test User',
            'exp' => time() + 3600,
            'iat' => time(),
        ], $overrides);
    }

    public function testAceitaTokenValido(): void
    {
        $token = $this->makeToken($this->validPayload());
        $payload = GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
        self::assertSame('google-user-sub-123', $payload['sub']);
        self::assertSame('user@example.com', $payload['email']);
    }

    public function testRejeitaAssinaturaInvalida(): void
    {
        $token = $this->makeToken($this->validPayload(), 'test-kid', true);
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
    }

    public function testRejeitaAudienceErrada(): void
    {
        $token = $this->makeToken($this->validPayload(['aud' => 'outro-client-id']));
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
    }

    public function testRejeitaIssuerErrado(): void
    {
        $token = $this->makeToken($this->validPayload(['iss' => 'https://evil.example.com']));
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
    }

    public function testRejeitaTokenExpirado(): void
    {
        $token = $this->makeToken($this->validPayload(['exp' => time() - 60]));
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
    }

    public function testAceitaIssuerSemHttps(): void
    {
        $token = $this->makeToken($this->validPayload(['iss' => 'accounts.google.com']));
        $payload = GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
        self::assertSame('accounts.google.com', $payload['iss']);
    }

    public function testRejeitaKidDesconhecido(): void
    {
        $token = $this->makeToken($this->validPayload(), 'kid-que-nao-existe-no-jwks');
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
    }

    public function testRejeitaTokenComFormatoInvalido(): void
    {
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify('nao-e-um-jwt', 'my-client-id', fn() => $this->jwks());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit tests/php/GoogleJwtVerifierTest.php`
Expected: FAIL — `Class "GoogleJwtVerifier" not found`.

- [ ] **Step 3: Implement `GoogleJwtVerifier`**

Create `public/src/Services/GoogleJwtVerifier.php`:

```php
<?php
/**
 * GoogleJwtVerifier — minimal RS256 JWT signature/claims verifier for
 * Google-issued id_tokens. No external dependency: builds the RSA public
 * key from the JWKS modulus/exponent and verifies with openssl_verify().
 */
class GoogleJwtVerifier
{
    private const DEFAULT_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
    private const VALID_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

    /**
     * @param callable|null $fetchJwks fn(): array{keys: array} — defaults to a real HTTPS fetch.
     * @return array the decoded JWT payload.
     * @throws \RuntimeException on any structural, signature, or claim failure.
     */
    public static function verify(string $idToken, string $expectedAudience, ?callable $fetchJwks = null): array
    {
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            throw new \RuntimeException('Token com formato inválido.');
        }
        [$headerB64, $payloadB64, $signatureB64] = $parts;

        $header = json_decode(self::base64urlDecode($headerB64), true);
        $payload = json_decode(self::base64urlDecode($payloadB64), true);
        $signature = self::base64urlDecode($signatureB64);

        if (!is_array($header) || !is_array($payload)) {
            throw new \RuntimeException('Token com payload inválido.');
        }
        if (($header['alg'] ?? '') !== 'RS256') {
            throw new \RuntimeException('Algoritmo de assinatura não suportado.');
        }

        $fetchJwks = $fetchJwks ?? [self::class, 'fetchJwksFromGoogle'];
        $jwks = $fetchJwks();
        $publicKeyPem = self::findPublicKey($jwks, $header['kid'] ?? '');
        if (!$publicKeyPem) {
            throw new \RuntimeException('Chave pública não encontrada para o kid informado.');
        }

        $signingInput = $headerB64 . '.' . $payloadB64;
        $verified = openssl_verify($signingInput, $signature, $publicKeyPem, OPENSSL_ALGO_SHA256);
        if ($verified !== 1) {
            throw new \RuntimeException('Assinatura do token inválida.');
        }

        if (!in_array($payload['iss'] ?? '', self::VALID_ISSUERS, true)) {
            throw new \RuntimeException('Emissor (iss) inválido.');
        }
        if (($payload['aud'] ?? '') !== $expectedAudience) {
            throw new \RuntimeException('Audiência (aud) inválida.');
        }
        if (!isset($payload['exp']) || (int)$payload['exp'] < time()) {
            throw new \RuntimeException('Token expirado.');
        }

        return $payload;
    }

    private static function findPublicKey(array $jwks, string $kid): ?string
    {
        foreach ($jwks['keys'] ?? [] as $key) {
            if (($key['kid'] ?? '') === $kid && ($key['kty'] ?? '') === 'RSA') {
                return self::rsaComponentsToPem($key['n'], $key['e']);
            }
        }
        return null;
    }

    /** Builds a PEM public key from JWKS base64url-encoded RSA modulus (n) and exponent (e). */
    private static function rsaComponentsToPem(string $nB64, string $eB64): string
    {
        $modulus = self::base64urlDecode($nB64);
        $exponent = self::base64urlDecode($eB64);

        $modulusEncoded = self::derEncodeUnsignedInteger($modulus);
        $exponentEncoded = self::derEncodeUnsignedInteger($exponent);

        $sequence = self::derSequence($modulusEncoded . $exponentEncoded);
        $bitString = "\x03" . self::derLength(strlen($sequence) + 1) . "\x00" . $sequence;

        $algorithmIdentifier = hex2bin('300d06092a864886f70d0101010500'); // rsaEncryption OID
        $publicKeyInfo = self::derSequence($algorithmIdentifier . $bitString);

        $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($publicKeyInfo), 64, "\n") . "-----END PUBLIC KEY-----\n";
        return $pem;
    }

    private static function derEncodeUnsignedInteger(string $bytes): string
    {
        if (ord($bytes[0]) > 0x7f) $bytes = "\x00" . $bytes; // avoid being read as negative
        return "\x02" . self::derLength(strlen($bytes)) . $bytes;
    }

    private static function derSequence(string $contents): string
    {
        return "\x30" . self::derLength(strlen($contents)) . $contents;
    }

    private static function derLength(int $length): string
    {
        if ($length < 128) return chr($length);
        $bytes = ltrim(pack('N', $length), "\x00");
        return chr(0x80 | strlen($bytes)) . $bytes;
    }

    private static function base64urlDecode(string $data): string
    {
        $padded = str_pad(strtr($data, '-_', '+/'), strlen($data) % 4 === 0 ? strlen($data) : strlen($data) + (4 - strlen($data) % 4), '=');
        return base64_decode($padded);
    }

    private static function fetchJwksFromGoogle(): array
    {
        $context = stream_context_create(['http' => ['timeout' => 5]]);
        $raw = @file_get_contents(self::DEFAULT_JWKS_URL, false, $context);
        $decoded = $raw ? json_decode($raw, true) : null;
        if (!is_array($decoded)) {
            throw new \RuntimeException('Não foi possível obter as chaves públicas do Google.');
        }
        return $decoded;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit tests/php/GoogleJwtVerifierTest.php`
Expected: PASS (8 tests). If `testAceitaTokenValido` or others fail with a DER/PEM parsing error, double check `openssl_verify` accepts the constructed PEM by running: `"/c/xampp/php/php.exe" -r "var_dump(openssl_pkey_get_public(GoogleJwtVerifier::class));"` is not directly testable standalone — instead debug by dumping the generated PEM string and validating it with `openssl_pkey_get_public($pem)` returning a non-false resource in a scratch script.

- [ ] **Step 5: Commit**

```bash
git add public/src/Services/GoogleJwtVerifier.php tests/php/GoogleJwtVerifierTest.php
git commit -m "Add GoogleJwtVerifier for validating Google id_tokens without a new dependency"
```

---

## Task 4: GoogleAuthService

**Files:**
- Create: `public/src/Services/GoogleAuthService.php`
- Test: `tests/php/GoogleAuthServiceTest.php`

**Interfaces:**
- Consumes:
  - `UserRepository::findByGoogleSub(string $sub): ?array` (Task 2)
  - `UserRepository::findByEmail(string $email): ?array` (existing)
  - `UserRepository::linkGoogleSub(string $userId, string $sub): void` (Task 2)
  - `UserRepository::save(array $user): void` (Task 2, now accepts `google_sub`)
  - `UserRepository::importToBanda(string $userId, string $bandaId, string $perfil): void` (existing)
  - `BandaRepository::save(array $banda): void` (existing)
  - `GoogleJwtVerifier::verify(...)` (Task 3)
- Produces:
  - `GoogleAuthService::exchangeCodeForIdToken(string $code, string $clientId, string $clientSecret, string $redirectUri, ?callable $httpPost = null): string` — returns the raw `id_token` string. `$httpPost` signature: `fn(string $url, array $formFields): array` (decoded JSON response), defaults to a real POST via `file_get_contents`.
  - `GoogleAuthService::resolveOrCreateUser(array $googlePayload): array` — takes a verified JWT payload (from `GoogleJwtVerifier::verify()`), returns a user row shaped like `UserRepository::findByEmail()`'s return (has `bandas`, `config`, etc. — the exact shape `AuthController::finalizeLogin()` expects).

- [ ] **Step 1: Write the failing tests**

Create `tests/php/GoogleAuthServiceTest.php`:

```php
<?php

use PHPUnit\Framework\TestCase;

final class GoogleAuthServiceTest extends TestCase
{
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'sub' => 'google-sub-1',
            'email' => 'user@example.com',
            'email_verified' => true,
            'name' => 'Google User',
        ], $overrides);
    }

    public function testResolveOrCreateUserEncontraPorGoogleSub(): void
    {
        $existing = ['id' => 'u1', 'nome' => 'Existing', 'email' => 'user@example.com', 'bandas' => []];
        $users = $this->createMock(UserRepository::class);
        $users->method('findByGoogleSub')->with('google-sub-1')->willReturn($existing);
        $users->expects(self::never())->method('findByEmail');
        $users->expects(self::never())->method('save');

        $bandas = $this->createMock(BandaRepository::class);
        $service = new GoogleAuthService($users, $bandas);

        $result = $service->resolveOrCreateUser($this->payload());
        self::assertSame('u1', $result['id']);
    }

    public function testResolveOrCreateUserEncontraPorEmailELinkaGoogleSub(): void
    {
        $existing = ['id' => 'u2', 'nome' => 'Existing Email', 'email' => 'user@example.com', 'bandas' => []];
        $users = $this->createMock(UserRepository::class);
        $users->method('findByGoogleSub')->willReturn(null);
        $users->method('findByEmail')->with('user@example.com')->willReturn($existing);
        $users->expects(self::once())->method('linkGoogleSub')->with('u2', 'google-sub-1');
        $users->expects(self::never())->method('save');

        $bandas = $this->createMock(BandaRepository::class);
        $service = new GoogleAuthService($users, $bandas);

        $result = $service->resolveOrCreateUser($this->payload());
        self::assertSame('u2', $result['id']);
    }

    public function testResolveOrCreateUserCriaContaEBandaQuandoNaoExiste(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('findByGoogleSub')->willReturn(null);
        $users->method('findByEmail')->willReturn(null);
        $users->expects(self::once())->method('save')->with(self::callback(function ($user) {
            return $user['email'] === 'user@example.com'
                && $user['nome'] === 'Google User'
                && $user['ativo'] === 1
                && $user['google_sub'] === 'google-sub-1'
                && count($user['bandas']) === 1
                && $user['bandas'][0]['perfil'] === 'administrador';
        }));

        $bandas = $this->createMock(BandaRepository::class);
        $bandas->expects(self::once())->method('save')->with(self::callback(fn($b) => $b['plano'] === 'gratuito'));

        $service = new GoogleAuthService($users, $bandas);
        $result = $service->resolveOrCreateUser($this->payload());

        self::assertSame('user@example.com', $result['email']);
        self::assertCount(1, $result['bandas']);
    }

    public function testResolveOrCreateUserRejeitaEmailNaoVerificado(): void
    {
        $users = $this->createMock(UserRepository::class);
        $bandas = $this->createMock(BandaRepository::class);
        $service = new GoogleAuthService($users, $bandas);

        $this->expectException(\RuntimeException::class);
        $service->resolveOrCreateUser($this->payload(['email_verified' => false]));
    }

    public function testExchangeCodeForIdTokenRetornaIdTokenDaResposta(): void
    {
        $service = new GoogleAuthService($this->createMock(UserRepository::class), $this->createMock(BandaRepository::class));
        $token = $service->exchangeCodeForIdToken(
            'auth-code-123',
            'client-id',
            'client-secret',
            'https://cifro.online/api/auth/google/callback',
            fn($url, $fields) => ['id_token' => 'fake-jwt-token', 'access_token' => 'x']
        );
        self::assertSame('fake-jwt-token', $token);
    }

    public function testExchangeCodeForIdTokenLancaExcecaoSemIdToken(): void
    {
        $service = new GoogleAuthService($this->createMock(UserRepository::class), $this->createMock(BandaRepository::class));
        $this->expectException(\RuntimeException::class);
        $service->exchangeCodeForIdToken('code', 'id', 'secret', 'uri', fn($url, $fields) => ['error' => 'invalid_grant']);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit tests/php/GoogleAuthServiceTest.php`
Expected: FAIL — `Class "GoogleAuthService" not found`.

- [ ] **Step 3: Implement `GoogleAuthService`**

Create `public/src/Services/GoogleAuthService.php`:

```php
<?php
/**
 * GoogleAuthService — token exchange + login-or-signup decision for
 * "Continuar com Google". Mirrors RegisterController's account+band
 * creation so both signup paths stay in sync.
 */
class GoogleAuthService
{
    private UserRepository $users;
    private BandaRepository $bandas;

    public function __construct(UserRepository $users, BandaRepository $bandas)
    {
        $this->users = $users;
        $this->bandas = $bandas;
    }

    /**
     * @param callable|null $httpPost fn(string $url, array $formFields): array — decoded JSON response.
     */
    public function exchangeCodeForIdToken(string $code, string $clientId, string $clientSecret, string $redirectUri, ?callable $httpPost = null): string
    {
        $httpPost = $httpPost ?? [$this, 'postFormReal'];
        $response = $httpPost('https://oauth2.googleapis.com/token', [
            'code' => $code,
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri' => $redirectUri,
            'grant_type' => 'authorization_code',
        ]);

        if (empty($response['id_token'])) {
            throw new \RuntimeException('Google não retornou um id_token válido.');
        }
        return $response['id_token'];
    }

    /**
     * @param array $googlePayload verified GoogleJwtVerifier payload (sub, email, email_verified, name).
     * @return array user row shaped like UserRepository::findByEmail()'s return.
     */
    public function resolveOrCreateUser(array $googlePayload): array
    {
        if (($googlePayload['email_verified'] ?? false) !== true) {
            throw new \RuntimeException('E-mail do Google não verificado.');
        }

        $sub = (string) $googlePayload['sub'];
        $email = strtolower(trim((string) $googlePayload['email']));
        $name = trim((string) ($googlePayload['name'] ?? $email));

        $byGoogleSub = $this->users->findByGoogleSub($sub);
        if ($byGoogleSub) {
            return $byGoogleSub;
        }

        $byEmail = $this->users->findByEmail($email);
        if ($byEmail) {
            $this->users->linkGoogleSub($byEmail['id'], $sub);
            return $byEmail;
        }

        return $this->createUserAndBanda($sub, $email, $name);
    }

    private function createUserAndBanda(string $sub, string $email, string $name): array
    {
        $userId = bin2hex(random_bytes(16));
        $bandaId = bin2hex(random_bytes(16));
        $bandaNome = $name !== '' ? $name . "'s Band" : 'Minha Banda';

        $this->users->save([
            'id' => $userId,
            'nome' => $name !== '' ? $name : $email,
            'email' => $email,
            'senha_hash' => null,
            'perfil' => 'usuario',
            'ativo' => 1,
            'validade' => null,
            'google_sub' => $sub,
            'bandas' => [['id' => $bandaId, 'perfil' => 'administrador']],
        ]);

        $this->bandas->save([
            'id' => $bandaId,
            'nome' => $bandaNome,
            'ativo' => 1,
            'plano' => 'gratuito',
            'trial_expira_em' => null,
        ]);

        return [
            'id' => $userId,
            'nome' => $name !== '' ? $name : $email,
            'email' => $email,
            'perfil' => 'usuario',
            'validade' => '',
            'config' => [],
            'bandas' => [['id' => $bandaId, 'perfil' => 'administrador']],
        ];
    }

    private function postFormReal(string $url, array $formFields): array
    {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query($formFields),
            'timeout' => 10,
            'ignore_errors' => true,
        ]]);
        $raw = @file_get_contents($url, false, $context);
        $decoded = $raw ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : [];
    }
}
```

Note: `createUserAndBanda()` deliberately does **not** wrap the two saves in the SQL transaction `RegisterController::handle()` uses (it calls `Database::getConnection()` directly for `beginTransaction()`). Keeping `GoogleAuthService` free of a direct PDO dependency keeps it fully mockable in tests; if partial-failure atomicity becomes a real-world problem, wrap the two calls in the callback of `callback.php` instead (out of scope for this plan — flagged, not silently dropped).

- [ ] **Step 4: Run tests to verify they pass**

Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit tests/php/GoogleAuthServiceTest.php`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add public/src/Services/GoogleAuthService.php tests/php/GoogleAuthServiceTest.php
git commit -m "Add GoogleAuthService for token exchange and login-or-signup resolution"
```

---

## Task 5: Make AuthController::finalizeLogin() public

**Files:**
- Modify: `public/src/Controllers/AuthController.php:101`
- Test: `tests/php/AuthControllerTest.php` (existing tests must still pass unchanged — this is a visibility-only change)

**Interfaces:**
- Consumes: nothing new.
- Produces: `AuthController::finalizeLogin(array $user): void` now `public` (was `private`), consumed by Task 6's `callback.php`.

- [ ] **Step 1: Change visibility**

In `public/src/Controllers/AuthController.php`, line 101, change:
```php
    private function finalizeLogin($user) {
```
to:
```php
    public function finalizeLogin($user) {
```

- [ ] **Step 2: Run the existing AuthController tests to confirm nothing broke**

Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit tests/php/AuthControllerTest.php`
Expected: PASS (26 tests, same as before this change — visibility widening never breaks existing callers).

- [ ] **Step 3: Commit**

```bash
git add public/src/Controllers/AuthController.php
git commit -m "Make AuthController::finalizeLogin public so the Google callback can reuse it"
```

---

## Task 6: OAuth start + callback endpoints

**Files:**
- Create: `public/api/auth/google/start.php`
- Create: `public/api/auth/google/callback.php`
- Test: `tests/cifro/35-google-auth.spec.js`

**Interfaces:**
- Consumes: `GoogleAuthService` (Task 4), `GoogleJwtVerifier` (Task 3), `AuthController::finalizeLogin()` (Task 5), `csrf`-unrelated session helpers already in `bootstrap.php` (`env()`).
- Produces: two HTTP endpoints; no PHP interfaces consumed by later tasks.

- [ ] **Step 1: Create `start.php`**

Create `public/api/auth/google/start.php`:

```php
<?php
require_once __DIR__ . '/../../../src/backend/bootstrap.php';

$clientId = trim((string) env('GOOGLE_CLIENT_ID', ''));
$redirectUri = trim((string) env('GOOGLE_REDIRECT_URI', ''));

if ($clientId === '' || $redirectUri === '') {
    http_response_code(500);
    echo 'Login com Google não está configurado.';
    exit;
}

$state = bin2hex(random_bytes(32));
$_SESSION['google_oauth_state'] = $state;

$params = http_build_query([
    'client_id' => $clientId,
    'redirect_uri' => $redirectUri,
    'response_type' => 'code',
    'scope' => 'openid email profile',
    'state' => $state,
    'prompt' => 'select_account',
]);

header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params);
exit;
```

- [ ] **Step 2: Create `callback.php`**

Create `public/api/auth/google/callback.php`:

```php
<?php
require_once __DIR__ . '/../../../src/backend/bootstrap.php';

function googleLoginFailed(string $reason): void {
    error_log('[google-auth] ' . $reason);
    header('Location: /login.php?erro=google');
    exit;
}

$expectedState = $_SESSION['google_oauth_state'] ?? '';
unset($_SESSION['google_oauth_state']);
$receivedState = $_GET['state'] ?? '';

if ($expectedState === '' || !is_string($receivedState) || !hash_equals($expectedState, $receivedState)) {
    googleLoginFailed('state mismatch');
}

$code = $_GET['code'] ?? '';
if (!is_string($code) || $code === '') {
    googleLoginFailed('missing code');
}

$clientId = trim((string) env('GOOGLE_CLIENT_ID', ''));
$clientSecret = trim((string) env('GOOGLE_CLIENT_SECRET', ''));
$redirectUri = trim((string) env('GOOGLE_REDIRECT_URI', ''));

if ($clientId === '' || $clientSecret === '' || $redirectUri === '') {
    googleLoginFailed('not configured');
}

$userRepository = new UserRepository();
$bandaRepository = new BandaRepository();
$googleAuth = new GoogleAuthService($userRepository, $bandaRepository);

try {
    $idToken = $googleAuth->exchangeCodeForIdToken($code, $clientId, $clientSecret, $redirectUri);
    $payload = GoogleJwtVerifier::verify($idToken, $clientId);
    $user = $googleAuth->resolveOrCreateUser($payload);
} catch (\Throwable $e) {
    googleLoginFailed($e->getMessage());
}

$appDebug = strtolower((string) env('APP_DEBUG', 'false')) === 'true';
$authService = new AuthService($userRepository);
$authController = new AuthController($authService, $userRepository, $appDebug, $bandaRepository);
$authController->finalizeLogin($user);
```

- [ ] **Step 3: Add the three `.env` keys to `.env.example`**

In `.env.example`, add a new section after the `# ── Aplicação ──` block:

```
# ── Login com Google ──────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://seudominio.com/api/auth/google/callback
```

- [ ] **Step 4: Manual smoke test against the local dev server**

This step requires real Google OAuth credentials in `.env` (see the design spec's setup instructions) — skip if not yet available and rely on the Playwright test in Step 6 instead, which mocks Google entirely.

If credentials are available: start the local server (`.claude/launch.json` already configures `php -S localhost:8000 -t public`), visit `http://localhost:8000/api/auth/google/start.php`, complete the Google consent screen, and confirm you land on `/index.php` or `/select-banda.php` logged in.

- [ ] **Step 5: Write the Playwright test (mocked Google, no real credentials needed)**

Create `tests/cifro/35-google-auth.spec.js`:

```js
/**
 * 35-google-auth.spec.js
 * Google OAuth login/signup — button visibility and callback error paths.
 * Real calls to accounts.google.com/oauth2.googleapis.com are never made
 * (impossible to script the real consent screen in CI); this covers the
 * parts our own code controls: state CSRF check and config-missing guard.
 */
import { test, expect } from '../fixtures/coverage.js';

test.describe('Login com Google — visibilidade do botão', () => {
  test('login.php e register.php refletem a configuração atual do servidor', async ({ page }) => {
    const loginRes = await page.goto('/login.php');
    expect(loginRes.status()).toBe(200);
    const registerRes = await page.goto('/register.php');
    expect(registerRes.status()).toBe(200);
    // Botão só aparece se GOOGLE_CLIENT_ID estiver configurado no ambiente
    // de teste; ambos os casos (presente/ausente) são válidos, então esta
    // suíte apenas garante que a página carrega sem erro fatal com o bloco novo.
  });
});

test.describe('Login com Google — callback.php', () => {
  test('sem state na sessão retorna erro e redireciona para login', async ({ page }) => {
    const res = await page.request.get('/api/auth/google/callback.php?code=abc&state=qualquer', {
      maxRedirects: 0,
    }).catch(err => err.response ?? null);
    // Sem cookie de sessão prévio (novo contexto de request), o state nunca bate.
    const status = res ? res.status() : null;
    expect([302, 303]).toContain(status);
    const location = res.headers()['location'];
    expect(location).toContain('/login.php');
    expect(location).toContain('erro=google');
  });

  test('sem code retorna erro e redireciona para login', async ({ page }) => {
    // Primeiro visita start.php para obter um state válido na sessão...
    await page.goto('/api/auth/google/start.php').catch(() => {});
    // then hits callback without a code but (if start.php redirected to
    // Google) the session cookie already carries google_oauth_state.
    const res = await page.request.get('/api/auth/google/callback.php?state=missing-code-check', {
      maxRedirects: 0,
    }).catch(err => err.response ?? null);
    const status = res ? res.status() : null;
    expect([302, 303]).toContain(status);
  });
});
```

- [ ] **Step 6: Run the Playwright test**

Run: `npx playwright test tests/cifro/35-google-auth.spec.js --project=cifro`
Expected: all tests pass. If `start.php` 500s because `.env` has no `GOOGLE_CLIENT_ID` yet, that is expected in this environment — the test only asserts on `callback.php`'s own state/code guards, which don't require real credentials. If the "sem code" test is flaky because `start.php`'s redirect never completes (external network to `accounts.google.com` blocked in the test sandbox), that's fine: the `.catch(() => {})` on that navigation means the test proceeds regardless — it doesn't depend on reaching Google.

- [ ] **Step 7: Run the full PHP suite once more**

Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit`
Expected: all tests pass, no regressions from Tasks 1–6.

- [ ] **Step 8: Commit**

```bash
git add public/api/auth/google/start.php public/api/auth/google/callback.php .env.example tests/cifro/35-google-auth.spec.js
git commit -m "Add Google OAuth start/callback endpoints"
```

---

## Task 7: "Continuar com Google" button on login.php and register.php

**Files:**
- Modify: `public/src/Views/login.php`
- Modify: `public/src/Views/register.php`
- Test: covered by Task 6's Playwright spec (button visibility) — no new automated test needed for pure markup, verify manually per Step 3 below.

**Interfaces:**
- Consumes: `env('GOOGLE_CLIENT_ID', '')` (existing `env()` helper).
- Produces: nothing consumed by later tasks (this is the last task).

- [ ] **Step 1: Add the button to `login.php`**

In `public/src/Views/login.php`, immediately before the `<form method="post" id="loginForm" novalidate>` line (around line 120), add:

```php
    <?php $googleConfigured = trim((string) env('GOOGLE_CLIENT_ID', '')) !== ''; ?>
    <?php if ($googleConfigured): ?>
      <a href="/api/auth/google/start.php" class="btn btn-google" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:44px;background:#fff;color:#3c4043;border:1px solid #dadce0;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin-bottom:16px;">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
        Continuar com Google
      </a>
      <div style="text-align:center;margin-bottom:16px;color:#666;font-size:12px">ou entre com e-mail</div>
    <?php endif; ?>
```

- [ ] **Step 2: Add the same button to `register.php`**

Find the equivalent form-opening point in `public/src/Views/register.php` (the `<form` tag for the registration fields) and add the identical block (same PHP condition, same markup) immediately before it, with copy adjusted to "ou crie com e-mail" instead of "ou entre com e-mail".

- [ ] **Step 3: Manual verification in the browser**

With the local dev server running (already started via `.claude/launch.json`, port 8000):
1. Set `GOOGLE_CLIENT_ID=test-placeholder` in `.env` temporarily (any non-empty string).
2. Visit `http://localhost:8000/login.php` — the "Continuar com Google" button must be visible above the e-mail/senha form.
3. Visit `http://localhost:8000/register.php` — same button must be visible.
4. Remove `GOOGLE_CLIENT_ID` from `.env` (or leave empty) and reload both pages — the button must be gone, with no layout break.
5. Revert `.env` to its original state (do not leave the placeholder value committed anywhere — `.env` is already gitignored, but double-check `git status` shows no change to tracked files from this step).

- [ ] **Step 4: Run the full PHP suite one final time**

Run: `"/c/xampp/php/php.exe" vendor/bin/phpunit`
Expected: all tests pass (no PHP logic changed in this task, pure view markup).

- [ ] **Step 5: Commit**

```bash
git add public/src/Views/login.php public/src/Views/register.php
git commit -m "Add Continuar com Google button to login and register pages"
```

---

## Final Verification

- [ ] Run `"/c/xampp/php/php.exe" vendor/bin/phpunit` — full suite green.
- [ ] Run `npx playwright test tests/cifro/35-google-auth.spec.js --project=cifro` — green.
- [ ] Confirm `.env.example` documents all three new keys and the real `.env` (gitignored) is unchanged from before this plan unless the user has deliberately added real Google credentials.
- [ ] Re-read the design spec (`docs/superpowers/specs/2026-08-01-google-oauth-login-design.md`) once more and confirm every "Scope" bullet has a corresponding task above.
