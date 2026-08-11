<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
// Logado → app. Anônimo → landing renderizada aqui mesmo (200, sem redirect)
// para que "/" seja a home indexável, em vez de /landing.php.
if (isset($_SESSION['autenticado']) && $_SESSION['autenticado'] === true) {
    $controller = new IndexController();
    $controller->show();
    return;
}
require __DIR__ . '/landing.php';
