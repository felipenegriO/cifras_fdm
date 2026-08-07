<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
// Already logged in → go to app
if (isset($_SESSION['autenticado']) && $_SESSION['autenticado'] === true) {
    header('Location: ' . base_url('/index.php')); exit;
}
$ctrl = new RegisterController();
$ctrl->handle();
