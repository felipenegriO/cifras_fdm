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

    private function addAuthRefreshToken(string $target): string {
        $path = parse_url($target, PHP_URL_PATH);
        if (!in_array($path, ['index.php', '/index.php', '/select-banda.php'], true)) return $target;
        return $target . (str_contains($target, '?') ? '&' : '?') . '_cifro_auth=' . bin2hex(random_bytes(8));
    }

    /** Isolated seam so tests can observe the redirect without exit() killing the process. */
    protected function redirect(string $location): void {
        header('Location: ' . base_url($location));
        exit;
    }

    /**
     * Popula $_SESSION a partir de um usuário já autenticado.
     * Sem redirect e sem emitir token, para poder ser reaproveitado pela
     * revalidação por token "lembrar-me" no bootstrap.
     */
    public function popularSessao(array $user): void {
        if (session_status() === PHP_SESSION_ACTIVE && !headers_sent()) {
            session_regenerate_id(true);
        }
        // Monta tudo antes de publicar em $_SESSION: se a consulta da banda
        // falhar no meio (banco caindo), uma sessão com autenticado=true e sem
        // banda_atual ficaria presa para sempre — toda requisição seguinte
        // acharia que já está logada e nunca tentaria o token de novo,
        // devolvendo 404 "Banda não encontrada" em todo endpoint.
        $sessao = [
            'usuario' => [
                'id'       => $user['id'] ?? null,
                'nome'     => $user['nome'] ?? '',
                'email'    => $user['email'] ?? '',
                'perfil'   => $user['perfil'] ?? 'usuario',
                'validade' => $user['validade'] ?? '',
                'config'   => $user['config'] ?? [],
                'bandas'   => $user['bandas'] ?? [],
            ],
        ];

        $bandas = $user['bandas'] ?? [];
        $configBandaAtual = ($user['config'] ?? [])['banda_atual'] ?? null;
        $bandaAtual = $this->resolveBandaAtual($bandas, $configBandaAtual);

        if ($bandaAtual) {
            $bandaRepo = $this->bandaRepository ?? new BandaRepository();
            $bandaInfo = $bandaRepo->findById($bandaAtual['id']);
            $sessao['banda_atual'] = [
                'id'    => $bandaAtual['id'],
                'nome'  => $bandaInfo['nome'] ?? '',
                'perfil'=> $bandaAtual['perfil'],
                'plano' => $bandaInfo['plano'] ?? 'ativo',
                'trial_expira_em' => $bandaInfo['trial_expira_em'] ?? null,
                'logo'            => $bandaInfo['logo'] ?? null,
            ];
        }

        $_SESSION['autenticado'] = true;
        foreach ($sessao as $chave => $valor) {
            $_SESSION[$chave] = $valor;
        }
        $_SESSION['login_attempts'] = ['count' => 0, 'time' => time()];
    }

    public function finalizeLogin($user) {
        // Convite pendente: quem chegou por um link entra na banda convidada
        // antes de a sessão ser montada, senão popularSessao escolheria a banda
        // antiga e o músico acharia que o convite não funcionou.
        $convite = BandaConviteFlow::pendente();
        if ($convite && !empty($user['id'])) {
            $resultado = (new BandaConviteFlow())->aceitar($convite['token'], (string) $user['id']);
            if ($resultado['ok']) {
                $banda = $resultado['banda'];
                if (!BandaSelectionHelper::isBandaJaNaLista($user['bandas'] ?? [], $banda['id'])) {
                    $user['bandas'][] = ['id' => $banda['id'], 'perfil' => BandaConvitePolicy::PERFIL];
                }
                // Faz a banda convidada ser a que abre depois do login — e
                // persiste, senão o próximo login volta para a banda antiga.
                $user['config']['banda_atual'] = $banda['id'];
                ($this->userRepository ?? new UserRepository())->updateConfig((string) $user['id'], ['banda_atual' => (string) $banda['id']]);
            } else {
                // Sem flash message: o usuário entra normalmente (na banda que
                // já tinha). O log é o que permite ao suporte explicar por que
                // o convite não valeu.
                OperationalLogger::log('warning', 'convite.recusado_no_login', ['operation' => 'convite_aceitar', 'result' => 'denied']);
            }
            BandaConviteFlow::limparSessao();
        }

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

    /**
     * Recria a sessão a partir de um token "lembrar-me" já validado.
     *
     * Reaproveita popularSessao (não finalizeLogin, que redireciona e faz exit).
     * findById() não traz as bandas — só findByEmail traz —, então elas são
     * carregadas à parte: sem isso a sessão nasce sem banda_atual e todo
     * endpoint passa a responder 404 "Banda não encontrada".
     */
    public function finalizeLoginPorToken(string $usuarioId): bool {
        $repo = new UserRepository();
        $user = $repo->findById($usuarioId);
        if (!$user) return false;

        // O token não pode ser um atalho que pula as barreiras do login por
        // senha: desativar um músico ou deixar a validade vencer precisa tirar
        // o acesso também de quem já está "lembrado" no aparelho.
        if ($this->authService->motivoParaRecusarConta($user) !== null) {
            return false;
        }

        // getBandasDoUsuario devolve a coluna como 'usuario_perfil';
        // popularSessao espera 'perfil'.
        $user['bandas'] = array_map(
            fn(array $b): array => ['id' => $b['id'], 'perfil' => $b['usuario_perfil']],
            $repo->getBandasDoUsuario($usuarioId)
        );

        $this->popularSessao($user);
        return true;
    }

}
