<?php
require_once __DIR__ . '/bootstrap.php';

if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true) {
    http_response_code(401);
    echo '0';
    exit;
}

$service = new LiveStateService(__DIR__ . '/data/live-state.json');
$status = $service->status('default');

echo !empty($status['hasHost']) && !empty($status['cifraAtual'])
    ? $status['cifraAtual']
    : '0';
