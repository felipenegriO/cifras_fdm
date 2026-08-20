<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
if (isset($_SESSION['autenticado']) && $_SESSION['autenticado'] === true) {
    $controller = new IndexController();
    $controller->show();
    return;
}

$requestPath = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
if (basename((string) $requestPath) === 'index.php') {
    header('Location: ' . base_url('/landing.php'));
    exit;
}

require __DIR__ . '/landing.php';
