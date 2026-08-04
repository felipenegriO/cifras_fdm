<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Metodo nao permitido']);
    exit;
}

require_current_band_json();

$salaId  = current_band_id();
session_write_close();
$service = new LiveStateService(new LiveStateRepository());
echo json_encode($service->status($salaId));
