<?php
require_once __DIR__ . '/src/backend/bootstrap.php';

// O logout por GET saiu daqui: um link de terceiro conseguia deslogar o músico
// à distância, e desde que o logout revoga o "lembrar-me" isso custaria
// redigitar a senha. Sair agora tem uma porta só — /logout.php, que confirma e
// exige POST com CSRF. Quem apontava para cá foi redirecionado para lá.
if (!empty($_GET['logout'])) {
    header('Location: ' . base_url('/logout.php')); exit;
}

$appDebug = strtolower((string) env('APP_DEBUG', 'false')) === 'true';

$userRepository = new UserRepository();
$authService = new AuthService($userRepository);
$authController = new AuthController($authService, $userRepository, $appDebug);
$erro = $authController->handleLogin();

// Quem foi desconectado por conta desativada chega aqui com ?inativo=1 e
// precisa entender o motivo — sem isso a tela de login parece um bug.
if ($erro === null && ($_GET['inativo'] ?? '') === '1') {
    $erro = 'Sua conta foi desativada. Fale com o administrador da sua banda.';
}

render_view('login', ['erro' => $erro]);
