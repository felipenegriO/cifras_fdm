<?php
class AuthController {
    private $authService;
    private $userRepository;
    private $bandaRepository;

    public function __construct(AuthService $authService, UserRepository $userRepository, $appDebug = false, ?BandaRepository $bandaRepository = null) {
        $this->authService = $authService;
        $this->userRepository = $userRepository;
        $this->bandaRepository = $bandaRepository;
    }

    public function handleLogin() {
        $this->initLoginAttempts();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return null;
        }

        $login = Validator::login($_POST['email'] ?? '');
        $senha = (string) ($_POST['senha'] ?? '');

        if ($_SESSION['login_attempts']['count'] >= 8) {
            return 'Muitas tentativas. Tente novamente em alguns minutos.';
        }

        if ($login === '' || $senha === '') {
            return 'Informe e-mail e senha.';
        }

        if (cifro_rate_limit('login', 8, 300, $login)) {
            OperationalLogger::log('warning', 'auth.rate_limited', ['result' => 'blocked']);
            return 'Muitas tentativas. Tente novamente em alguns minutos.';
        }

        $result = $this->authService->authenticate($login, $senha);
        if ($result['error']) {
            $_SESSION['login_attempts']['count']++;
            OperationalLogger::log('warning', 'auth.login_failed', ['result' => 'denied']);
            return $result['error'];
        }

        cifro_rate_limit_reset('login', $login);
        OperationalLogger::log('info', 'auth.login_succeeded', ['result' => 'success']);
        $this->finalizeLogin($result['user']);
        return null;
    }

    private function initLoginAttempts() {
        $_SESSION['login_attempts'] = $_SESSION['login_attempts'] ?? [
            'count' => 0,
            'time' => time()
        ];

        if (time() - $_SESSION['login_attempts']['time'] > 300) {
            $_SESSION['login_attempts'] = ['count' => 0, 'time' => time()];
        }
    }

    /**
     * Picks the band a user should land in after login: the band recorded
     * in their config (if it still exists in their band list), or their
     * first band, or null if they belong to none.
     */
    public function resolveBandaAtual(array $bandas, $configBandaAtual): ?array {
        if ($configBandaAtual) {
            foreach ($bandas as $b) {
                if ($b['id'] === $configBandaAtual) {
                    return $b;
                }
            }
        }
        return !empty($bandas) ? $bandas[0] : null;
    }

    /**
     * master: single band → go directly; no bands → index
     * normal: single band → go directly; multiple → select-banda.php
     */
    public function resolveRedirectTarget(array $user, array $bandas, $urlcallback): string {
        if ($urlcallback && $this->isSafeLocalRedirect((string) $urlcallback)) {
            return (string) $urlcallback;
        }
        $isMaster = ($user['perfil'] ?? '') === 'master';
        if (!$isMaster && count($bandas) > 1) {
            return '/select-banda.php';
        }
        return 'index.php';
    }

    private function isSafeLocalRedirect(string $target): bool {
        if ($target === '' || str_starts_with($target, '//') || str_contains($target, "\r") || str_contains($target, "\n")) {
            return false;
        }
        $parts = parse_url($target);
        return $parts !== false && !isset($parts['scheme']) && !isset($parts['host']);
    }

    /** Isolated seam so tests can observe the redirect without exit() killing the process. */
    protected function redirect(string $location): void {
        header('Location: ' . base_url($location));
        exit;
    }

    public function finalizeLogin($user) {
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

        $redirect = $this->resolveRedirectTarget($user, $bandas, $_GET['urlcallback'] ?? null);

        $this->redirect($redirect);
    }

}
