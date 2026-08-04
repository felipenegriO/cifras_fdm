<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (env('APP_ENV', 'production') !== 'test') {
    http_response_code(404);
    echo json_encode(['ok' => false]);
    exit;
}

require_auth();
session_regenerate_id(false);
echo json_encode(['ok' => true]);
