<?php
/**
 * Teste de integração do fluxo completo de login com Google.
 *
 * Cobre toda a pilha real: GoogleAuthService → UserRepository → BandaRepository
 * → AuthController::finalizeLogin → $_SESSION. Só o HTTP ao Google é mockado.
 */
class GoogleLoginIntegrationTest extends \PHPUnit\Framework\TestCase
{
    private PDO $pdo;
    private array $createdUserIds = [];
    private array $createdBandaIds = [];

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();

        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
        $_SESSION = [];
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private function makeAuthController(): AuthController
    {
        $userRepo  = new UserRepository();
        $bandaRepo = new BandaRepository();
        $authSvc   = new AuthService($userRepo);

        return new class($authSvc, $userRepo, false, $bandaRepo) extends AuthController {
            public string $redirectTarget = '';
            protected function redirect(string $location): void
            {
                $this->redirectTarget = $location;
                // não chama exit()
            }
        };
    }

    private function makeGoogleAuthService(): GoogleAuthService
    {
        return new GoogleAuthService(new UserRepository(), new BandaRepository());
    }

    private function fakeGooglePayload(string $sub, string $email, string $name = 'Teste Google'): array
    {
        return [
            'sub'            => $sub,
            'email'          => $email,
            'name'           => $name,
            'email_verified' => true,
        ];
    }

    // ── testes ───────────────────────────────────────────────────────────────

    public function testFluxoCompletoNovoConta(): void
    {
        $sub   = 'google-sub-' . bin2hex(random_bytes(8));
        $email = 'googletest-' . bin2hex(random_bytes(4)) . '@example.com';

        $googleAuth = $this->makeGoogleAuthService();
        $user = $googleAuth->resolveOrCreateUser($this->fakeGooglePayload($sub, $email));

        self::assertNotEmpty($user['id']);
        self::assertSame($email, $user['email']);
        self::assertNotEmpty($user['bandas'], 'Nova conta deve ter uma banda criada automaticamente');

        $controller = $this->makeAuthController();
        $controller->finalizeLogin($user);

        self::assertTrue($_SESSION['autenticado'] ?? false, 'Sessão deve marcar autenticado');
        self::assertSame($user['id'], $_SESSION['usuario']['id'] ?? null);
        self::assertNotEmpty($_SESSION['banda_atual']['id'] ?? '', 'banda_atual deve ser preenchida na sessão');
        self::assertNotEmpty($controller->redirectTarget, 'finalizeLogin deve definir redirect');
    }

    public function testFluxoCompletoContaExistentePorEmail(): void
    {
        $userId  = bin2hex(random_bytes(16));
        $bandaId = bin2hex(random_bytes(16));
        $email   = 'existing-' . bin2hex(random_bytes(4)) . '@example.com';

        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?,?,?)')->execute([$bandaId, 'Banda Existente', 'gratuito']);
        $this->pdo->prepare('INSERT INTO usuarios (id, nome, email, perfil, ativo) VALUES (?,?,?,?,?)')->execute([$userId, 'Usuário Existente', $email, 'usuario', 1]);
        $this->pdo->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)')->execute([$userId, $bandaId, 'administrador']);

        $sub = 'google-sub-novo-' . bin2hex(random_bytes(8));
        $googleAuth = $this->makeGoogleAuthService();
        $user = $googleAuth->resolveOrCreateUser($this->fakeGooglePayload($sub, $email));

        self::assertSame($userId, $user['id'], 'Deve retornar o usuário existente, não criar um novo');

        $stmt = $this->pdo->prepare('SELECT google_sub FROM usuarios WHERE id=?');
        $stmt->execute([$userId]);
        self::assertSame($sub, $stmt->fetchColumn(), 'google_sub deve ser vinculado ao usuário existente');

        $controller = $this->makeAuthController();
        $controller->finalizeLogin($user);

        self::assertTrue($_SESSION['autenticado'] ?? false);
        self::assertSame($userId, $_SESSION['usuario']['id'] ?? null);
    }

    public function testFluxoCompletoContaExistentePorGoogleSub(): void
    {
        $userId  = bin2hex(random_bytes(16));
        $bandaId = bin2hex(random_bytes(16));
        $sub     = 'google-sub-fixed-' . bin2hex(random_bytes(8));
        $email   = 'bysub-' . bin2hex(random_bytes(4)) . '@example.com';

        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?,?,?)')->execute([$bandaId, 'Banda Sub', 'gratuito']);
        $this->pdo->prepare('INSERT INTO usuarios (id, nome, email, google_sub, perfil, ativo) VALUES (?,?,?,?,?,?)')->execute([$userId, 'Usuário Sub', $email, $sub, 'usuario', 1]);
        $this->pdo->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)')->execute([$userId, $bandaId, 'administrador']);

        $googleAuth = $this->makeGoogleAuthService();
        $user = $googleAuth->resolveOrCreateUser($this->fakeGooglePayload($sub, $email));

        self::assertSame($userId, $user['id'], 'Deve encontrar pelo google_sub sem criar conta nova');

        $controller = $this->makeAuthController();
        $controller->finalizeLogin($user);

        self::assertTrue($_SESSION['autenticado'] ?? false);
        self::assertSame($userId, $_SESSION['usuario']['id'] ?? null);
        self::assertSame($bandaId, $_SESSION['banda_atual']['id'] ?? null);
    }

    public function testEmailNaoVerificadoRejeita(): void
    {
        $googleAuth = $this->makeGoogleAuthService();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/verificado/i');

        $googleAuth->resolveOrCreateUser([
            'sub'            => 'sub-unverified',
            'email'          => 'unverified@example.com',
            'name'           => 'Unverified',
            'email_verified' => false,
        ]);
    }

    public function testExchangeCodeForIdTokenComHttpMockado(): void
    {
        $fakeIdToken = 'header.payload.signature';
        $httpPost = function (string $url, array $fields) use ($fakeIdToken): array {
            self::assertStringContainsString('oauth2.googleapis.com', $url);
            self::assertArrayHasKey('code', $fields);
            return ['id_token' => $fakeIdToken, 'access_token' => 'fake-access'];
        };

        $googleAuth = $this->makeGoogleAuthService();
        $result = $googleAuth->exchangeCodeForIdToken('fake-code', 'client-id', 'secret', 'http://localhost/cb', $httpPost);

        self::assertSame($fakeIdToken, $result);
    }

    public function testExchangeCodeSemIdTokenLancaExcecao(): void
    {
        $httpPost = fn() => ['access_token' => 'only-access-no-id'];

        $googleAuth = $this->makeGoogleAuthService();

        $this->expectException(RuntimeException::class);
        $googleAuth->exchangeCodeForIdToken('code', 'cid', 'secret', 'http://cb', $httpPost);
    }
}
