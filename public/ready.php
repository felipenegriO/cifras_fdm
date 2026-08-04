<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    $pdo = Database::getConnection();
    $pdo->query('SELECT 1')->fetchColumn();
    http_response_code(200);
    echo json_encode(['status' => 'ready', 'dependencies' => ['database' => 'ok'], 'request_id' => request_id()]);
} catch (Throwable $error) {
    OperationalLogger::log('error', 'readiness.failed', ['error_type' => get_class($error), 'http_status' => 503]);
    http_response_code(503);
    echo json_encode(['status' => 'not_ready', 'dependencies' => ['database' => 'unavailable'], 'request_id' => request_id()]);
}
