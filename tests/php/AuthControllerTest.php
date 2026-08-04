<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/backend/bootstrap.php';

final class AuthControllerTest extends TestCase
{
    private array $session;
    private array $server;
    private array $post;
    private array $get;

    protected function setUp(): void
    {
        $this->session = $_SESSION ?? [];
        $this->server = $_SERVER ?? [];
        $this->post = $_POST ?? [];
        $this->get = $_GET ?? [];
        $_SESSION = [];
        $_SERVER = ['REQUEST_METHOD' => 'GET'];
        $_POST = [];
        $_GET = [];
    }

    protected function tearDown(): void
    {
        $_SESSION = $this->session;
        $_SERVER = $this->server;
        $_POST = $this->post;
        $_GET = $this->get;
    }

    private function controller(array $authResult = ['user' => null, 'error' => 'Usuário ou senha inválidos.']): AuthController
    {
        $auth = $this->createMock(AuthService::class);
        $auth->method('authenticate')->willReturn($authResult);
        $users = $this->createMock(UserRepository::class);
        $users->method('findByEmail')->willReturn(null);
        $users->method('getAll')->willReturn([]);
        return new AuthController($auth, $users, false);
    }

    public function testHandleLoginIgnoraGetEInicializaTentativas(): void
    {
        self::assertNull($this->controller()->handleLogin());
        self::assertSame(0, $_SESSION['login_attempts']['count']);
        self::assertArrayHasKey('time', $_SESSION['login_attempts']);
    }

    public function testHandleLoginReiniciaJanelaExpiradaEValidaCampos(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_SESSION['login_attempts'] = ['count' => 7, 'time' => time() - 301];
        $_POST = ['email' => '', 'senha' => ''];

        self::assertSame('Informe e-mail e senha.', $this->controller()->handleLogin());
        self::assertSame(0, $_SESSION['login_attempts']['count']);
    }

    public function testHandleLoginBloqueiaAposMuitasTentativas(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_SESSION['login_attempts'] = ['count' => 8, 'time' => time()];
        $_POST = ['email' => 'usuario@exemplo.test', 'senha' => 'senha-invalida'];

        self::assertSame('Muitas tentativas. Tente novamente em alguns minutos.', $this->controller()->handleLogin());
    }

    public function testHandleLoginFalhaIncrementaTentativas(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['email' => ' FELIPE@LEGACY.INVALID ', 'senha' => 'errada'];

        self::assertSame('Usuário ou senha inválidos.', $this->controller()->handleLogin());
        self::assertSame(1, $_SESSION['login_attempts']['count']);
    }

    // ---- resolveBandaAtual ----

    public function testResolveBandaAtualUsaBandaDoConfigQuandoExiste(): void
    {
        $controller = $this->controller();
        $bandas = [['id' => 'b1', 'perfil' => 'basico'], ['id' => 'b2', 'perfil' => 'gestor']];
        self::assertSame($bandas[1], $controller->resolveBandaAtual($bandas, 'b2'));
    }

    public function testResolveBandaAtualIgnoraConfigInexistenteEUsaPrimeira(): void
    {
        $controller = $this->controller();
        $bandas = [['id' => 'b1', 'perfil' => 'basico'], ['id' => 'b2', 'perfil' => 'gestor']];
        self::assertSame($bandas[0], $controller->resolveBandaAtual($bandas, 'b-inexistente'));
    }

    public function testResolveBandaAtualUsaPrimeiraQuandoSemConfig(): void
    {
        $controller = $this->controller();
        $bandas = [['id' => 'b1', 'perfil' => 'basico']];
        self::assertSame($bandas[0], $controller->resolveBandaAtual($bandas, null));
    }

    public function testResolveBandaAtualNullQuandoSemBandas(): void
    {
        $controller = $this->controller();
        self::assertNull($controller->resolveBandaAtual([], null));
        self::assertNull($controller->resolveBandaAtual([], 'algo'));
    }

    // ---- resolveRedirectTarget ----

    public function testResolveRedirectTargetUsaUrlcallbackQuandoPresente(): void
    {
        $controller = $this->controller();
        self::assertSame('/editor.php', $controller->resolveRedirectTarget(['perfil' => 'usuario'], [], '/editor.php'));
    }

    public function testResolveRedirectTargetMasterComMultiplasBandasVaiParaIndex(): void
    {
        $controller = $this->controller();
        $bandas = [['id' => 'b1'], ['id' => 'b2']];
        self::assertSame('index.php', $controller->resolveRedirectTarget(['perfil' => 'master'], $bandas, null));
    }

    public function testResolveRedirectTargetUsuarioComMultiplasBandasVaiParaSelectBanda(): void
    {
        $controller = $this->controller();
        $bandas = [['id' => 'b1'], ['id' => 'b2']];
        self::assertSame('/select-banda.php', $controller->resolveRedirectTarget(['perfil' => 'usuario'], $bandas, null));
    }

    public function testResolveRedirectTargetUsuarioComUmaBandaVaiParaIndex(): void
    {
        $controller = $this->controller();
        self::assertSame('index.php', $controller->resolveRedirectTarget(['perfil' => 'usuario'], [['id' => 'b1']], null));
    }

    public function testResolveRedirectTargetSemBandasVaiParaIndex(): void
    {
        $controller = $this->controller();
        self::assertSame('index.php', $controller->resolveRedirectTarget(['perfil' => 'usuario'], [], null));
    }

    // ---- handleLogin: fluxo de sucesso completo ----

    private function nonExitingController(AuthService $auth, UserRepository $users, ?BandaRepository $bandaRepo, array &$redirects): AuthController
    {
        return new class($auth, $users, false, $bandaRepo, $redirects) extends AuthController {
            private array $redirects;
            public function __construct($auth, $users, $appDebug, $bandaRepo, array &$redirects) {
                parent::__construct($auth, $users, $appDebug, $bandaRepo);
                $this->redirects =& $redirects;
            }
            protected function redirect(string $location): void {
                $this->redirects[] = $location;
            }
        };
    }

    public function testHandleLoginSucessoComUmaBandaRedirecionaParaIndex(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['email' => 'user@example.com', 'senha' => 'correta'];

        $user = [
            'id' => 'u1', 'nome' => 'User', 'email' => 'user@example.com',
            'perfil' => 'usuario', 'validade' => '', 'config' => [], 'bandas' => [['id' => 'b1', 'perfil' => 'basico']],
        ];

        $auth = $this->createMock(AuthService::class);
        $auth->method('authenticate')->willReturn(['user' => $user, 'error' => null]);
        $users = $this->createMock(UserRepository::class);
        $bandaRepo = $this->createMock(BandaRepository::class);
        $bandaRepo->method('findById')->willReturn(['nome' => 'Banda 1', 'plano' => 'mensal']);

        $redirects = [];
        $controller = $this->nonExitingController($auth, $users, $bandaRepo, $redirects);

        self::assertNull($controller->handleLogin());
        self::assertTrue($_SESSION['autenticado']);
        self::assertSame('b1', $_SESSION['banda_atual']['id']);
        self::assertSame('Banda 1', $_SESSION['banda_atual']['nome']);
        self::assertSame('mensal', $_SESSION['banda_atual']['plano']);
        self::assertSame(['index.php'], $redirects);
    }

    public function testHandleLoginSucessoComConfigBandaAtualUsaEssaBanda(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['email' => 'user@example.com', 'senha' => 'correta'];

        $user = [
            'id' => 'u1', 'nome' => 'User', 'perfil' => 'usuario',
            'config' => ['banda_atual' => 'b2'],
            'bandas' => [['id' => 'b1', 'perfil' => 'basico'], ['id' => 'b2', 'perfil' => 'gestor']],
        ];

        $auth = $this->createMock(AuthService::class);
        $auth->method('authenticate')->willReturn(['user' => $user, 'error' => null]);
        $users = $this->createMock(UserRepository::class);
        $bandaRepo = $this->createMock(BandaRepository::class);
        $bandaRepo->method('findById')->willReturn(['nome' => 'Banda 2', 'plano' => 'gratuito']);

        $redirects = [];
        $controller = $this->nonExitingController($auth, $users, $bandaRepo, $redirects);

        $controller->handleLogin();
        self::assertSame('b2', $_SESSION['banda_atual']['id']);
        self::assertSame(['/select-banda.php'], $redirects);
    }

    public function testHandleLoginSucessoSemBandasNaoDefineBandaAtual(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['email' => 'user@example.com', 'senha' => 'correta'];

        $user = ['id' => 'u1', 'perfil' => 'usuario', 'config' => [], 'bandas' => []];

        $auth = $this->createMock(AuthService::class);
        $auth->method('authenticate')->willReturn(['user' => $user, 'error' => null]);
        $users = $this->createMock(UserRepository::class);

        $redirects = [];
        $controller = $this->nonExitingController($auth, $users, null, $redirects);

        $controller->handleLogin();
        self::assertArrayNotHasKey('banda_atual', $_SESSION);
        self::assertSame(['index.php'], $redirects);
    }

    public function testHandleLoginRespeitaUrlcallback(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = ['email' => 'user@example.com', 'senha' => 'correta'];
        $_GET['urlcallback'] = '/roteiro.php?id=42';

        $user = ['id' => 'u1', 'perfil' => 'usuario', 'config' => [], 'bandas' => []];

        $auth = $this->createMock(AuthService::class);
        $auth->method('authenticate')->willReturn(['user' => $user, 'error' => null]);
        $users = $this->createMock(UserRepository::class);

        $redirects = [];
        $controller = $this->nonExitingController($auth, $users, null, $redirects);

        $controller->handleLogin();
        self::assertSame(['/roteiro.php?id=42'], $redirects);
    }

}
