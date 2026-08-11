<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo nao permitido']);
    exit;
}

require_auth_json();
require_csrf();
require_live_host();
OperationalLogger::log('info', 'live.update_requested', ['operation' => 'update']);

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = $_POST;

$salaId  = current_band_id();
$service = new LiveStateService(new LiveStateRepository());
$result = $service->atualizar(
    $salaId,
    $input['hostId']       ?? '',
    array_key_exists('cifraAtual',     $input) ? $input['cifraAtual']     : null,
    array_key_exists('paginaAtual',    $input) ? $input['paginaAtual']    : null,
    !empty($input['keepAlive']),
    array_key_exists('scrollTop',      $input) ? $input['scrollTop']      : null,
    array_key_exists('scrollPercent',  $input) ? $input['scrollPercent']  : null,
    array_key_exists('canSyncScroll',  $input) ? $input['canSyncScroll']  : null
);
OperationalLogger::log('info', 'live.update_succeeded', ['operation' => 'update', 'result' => 'success']);
echo json_encode($result);
