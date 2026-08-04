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

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = $_POST;

$salaId  = require_current_band_json();
$service = new LiveStateService(new LiveStateRepository());
echo json_encode($service->assumirHost($salaId, $_SESSION['usuario'] ?? []));
