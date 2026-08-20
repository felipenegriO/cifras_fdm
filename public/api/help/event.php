<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_auth_json();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}
require_csrf();
if (!help_center_visible_for_user()) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'help_disabled']);
    exit;
}

$payload = json_decode((string)file_get_contents('php://input'), true);
$event = is_array($payload) ? (string)($payload['event'] ?? '') : '';
$article = is_array($payload) ? (string)($payload['article'] ?? '') : '';
$allowed = ['opened', 'search', 'search_empty', 'article_opened', 'guide_completed', 'problem_resolved', 'support_requested'];
if (!in_array($event, $allowed, true) || ($article !== '' && !preg_match('/^[a-z0-9-]{2,80}$/', $article))) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'invalid_event']);
    exit;
}

OperationalLogger::log('info', 'help.' . $event, [
    'operation' => $article === '' ? 'help_center' : $article,
    'result' => 'recorded',
]);
http_response_code(204);
