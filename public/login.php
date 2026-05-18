<?php
require_once __DIR__ . '/src/backend/bootstrap.php';

$appDebug = strtolower((string) env('APP_DEBUG', 'false')) === 'true';

$usuariosFile = $_SERVER['DOCUMENT_ROOT'] . '/src/backend/users/usuarios.json';

$userRepository = new UserRepository($usuariosFile);
$authService = new AuthService($userRepository);
$authController = new AuthController($authService, $userRepository, $usuariosFile, $appDebug);
$erro = $authController->handleLogin();

render_view('login', ['erro' => $erro]);
