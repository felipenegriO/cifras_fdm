<?php
require_once __DIR__ . '/src/backend/bootstrap.php';

// Logout via ?logout=1
if (!empty($_GET['logout'])) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    header('Location: ' . base_url('/landing.php')); exit;
}

$appDebug = strtolower((string) env('APP_DEBUG', 'false')) === 'true';

$userRepository = new UserRepository();
$authService = new AuthService($userRepository);
$authController = new AuthController($authService, $userRepository, $appDebug);
$erro = $authController->handleLogin();

render_view('login', ['erro' => $erro]);
