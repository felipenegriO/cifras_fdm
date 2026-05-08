<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo nao permitido']);
    exit;
}

if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Nao autenticado']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = $_POST;
}

$service = new LiveStateService(__DIR__ . '/../../src/backend/data/live-state.json');
$result = $service->atualizar(
    $input['salaId'] ?? 'default',
    $input['hostId'] ?? '',
    array_key_exists('cifraAtual', $input) ? $input['cifraAtual'] : null,
    array_key_exists('paginaAtual', $input) ? $input['paginaAtual'] : null,
    !empty($input['keepAlive'])
);

echo json_encode($result);
