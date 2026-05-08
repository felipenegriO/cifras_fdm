<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'Metodo nao permitido.';
    exit;
}

if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true) {
    http_response_code(401);
    echo 'Nao autenticado.';
    exit;
}

$numero = $_POST['numero'] ?? '';
$hostId = $_POST['hostId'] ?? '';

$service = new LiveStateService(__DIR__ . '/data/live-state.json');
$result = $service->atualizar('default', $hostId, $numero, $numero !== '' ? 'music.php?id=' . $numero : 'index.php');

echo !empty($result['success']) ? 'OK' : ($result['message'] ?? 'Erro ao atualizar live.');
