<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();
require_auth_json();

$bandaId = $_GET['banda_id'] ?? current_band_id();
if (!$bandaId) {
    echo json_encode(['version' => 0]);
    exit;
}

$repo = new MusicaRepository();
session_write_close();
echo json_encode(['version' => $repo->getVersion($bandaId)]);
