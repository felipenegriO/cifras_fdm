<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
// Already logged in → go to app
if (isset($_SESSION['autenticado']) && $_SESSION['autenticado'] === true) {
    header('Location: ' . base_url('/index.php')); exit;
}
// Intenção de plano vinda da landing (?plano=mensal|semestral|anual).
// A conta é sempre criada no gratuito; isto só lembra para onde levar depois.
$planoIntencao = strtolower(trim((string) ($_GET['plano'] ?? '')));
if (in_array($planoIntencao, ['mensal', 'semestral', 'anual'], true)) {
    $_SESSION['cifro_plano_intencao'] = $planoIntencao;
}

$ctrl = new RegisterController();
$ctrl->handle();
