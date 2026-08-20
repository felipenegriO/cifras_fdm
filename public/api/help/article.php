<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, max-age=300');

require_auth_json();
if (!help_center_visible_for_user()) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'help_disabled']);
    exit;
}

$id = trim((string)($_GET['id'] ?? ''));
if (!preg_match('/^[a-z0-9-]{2,80}$/', $id)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_article']);
    exit;
}

$article = (new HelpCenterService())->find($id);
if (!$article) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'article_not_found']);
    exit;
}

echo json_encode(['ok' => true, 'article' => $article], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
