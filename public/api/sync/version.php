<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();
require_auth_json();

$bandaId = current_band_id();
if (!$bandaId) {
    echo json_encode(['content_revision' => 0]);
    exit;
}

$revision = (new SyncRevisionRepository())->get($bandaId);
session_write_close();
echo json_encode(['content_revision' => $revision, 'banda_id' => $bandaId]);
