<?php
class AuthController {
    private $authService;
    private $userRepository;
    private $usersFile;
    private $appDebug;

    public function __construct(AuthService $authService, UserRepository $userRepository, $usersFile, $appDebug) {
        $this->authService = $authService;
        $this->userRepository = $userRepository;
        $this->usersFile = $usersFile;
        $this->appDebug = (bool) $appDebug;
    }

    public function handleLogin() {
        $this->initLoginAttempts();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return null;
        }

        $login = Validator::username($_POST['username'] ?? '');
        $senha = (string) ($_POST['senha'] ?? '');

        if ($_SESSION['login_attempts']['count'] >= 8) {
            return 'Muitas tentativas. Tente novamente em alguns minutos.';
        }

        if ($login === '' || $senha === '') {
            return 'Informe usuário e senha.';
        }

        if ($this->appDebug && isset($_GET['debug']) && $_GET['debug'] === '1') {
            $this->renderDebugInfo($login);
        }

        $user = $this->userRepository->findByUsername($login);

        if ($this->appDebug && isset($_GET['debug']) && $_GET['debug'] === '2') {
            $this->renderPasswordDebug($user, $senha);
        }

        $result = $this->authService->authenticate($login, $senha);
        if ($result['error']) {
            $_SESSION['login_attempts']['count']++;
            return $result['error'];
        }

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

    private function finalizeLogin($user) {
        session_regenerate_id(true);
        $_SESSION['autenticado'] = true;
        $_SESSION['usuario'] = [
            'id' => $user['id'] ?? null,
            'nome' => $user['nome'] ?? '',
            'username' => $user['username'] ?? '',
            'perfil' => $user['perfil'] ?? 'administrador',
            'validade' => $user['validade'] ?? ''
        ];

        $_SESSION['login_attempts'] = ['count' => 0, 'time' => time()];

        $redirect = $_GET['urlcallback'] ?? 'index.php';
        header('Location: ' . $redirect);
        exit;
    }

    private function renderDebugInfo($login) {
        $usuarios = $this->userRepository->getAll();
        $uDebug = $this->userRepository->findByUsername($login);

        echo "<pre style='background:#111;color:#0f0;padding:10px'>";
        echo "usuariosFile: " . htmlspecialchars($this->usersFile) . "\n";
        echo "file_exists: " . (file_exists($this->usersFile) ? "SIM" : "NAO") . "\n";
        echo "is_readable: " . (is_readable($this->usersFile) ? "SIM" : "NAO") . "\n";
        echo "qtd_usuarios: " . count($usuarios) . "\n";
        echo "login_digitado: " . htmlspecialchars($login) . "\n";
        echo "usuario_encontrado: " . ($uDebug ? "SIM" : "NAO") . "\n";

        if ($uDebug) {
            echo "ativo: " . ((bool)($uDebug['ativo'] ?? false) ? "SIM" : "NAO") . "\n";
            echo "tem_senhaHash: " . (!empty($uDebug['senhaHash']) ? "SIM" : "NAO") . "\n";
            echo "username_no_json: " . htmlspecialchars($uDebug['username'] ?? '') . "\n";
        }

        echo "</pre>";
        exit;
    }

    private function renderPasswordDebug($user, $senha) {
        $hash = $user['senhaHash'] ?? null;

        echo "<pre style='background:#111;color:#0f0;padding:10px'>";
        echo "hash: " . substr((string) $hash, 0, 20) . "...\n";
        echo "senha_digitada_len: " . strlen($senha) . "\n";
        echo "verify: " . ($hash && password_verify($senha, $hash) ? "OK" : "FALHOU") . "\n";
        echo "</pre>";
        exit;
    }
}
