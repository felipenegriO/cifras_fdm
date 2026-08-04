<?php
require_once __DIR__ . '/../../public/config/env.php';

if (PHP_SAPI !== 'cli') exit(1);
$baseUrl = rtrim((string) env('APP_URL', ''), '/');
$backupDir = rtrim((string) env('BACKUP_TARGET_DIR', ''), '/\\');
$failures = [];

foreach (['health' => 200, 'ready' => 200] as $endpoint => $expected) {
    $context = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
    $body = @file_get_contents($baseUrl . '/' . $endpoint, false, $context);
    $statusLine = $http_response_header[0] ?? '';
    if ($body === false || !str_contains($statusLine, (string) $expected)) $failures[] = $endpoint;
}

$backups = glob($backupDir . DIRECTORY_SEPARATOR . 'cifro-*.sql.enc') ?: [];
$latest = $backups ? max(array_map('filemtime', $backups)) : 0;
if ($latest < time() - 90000) $failures[] = 'backup_stale';

if ($failures) {
    $payload = json_encode(['service' => 'cifro', 'event' => 'operational_check_failed', 'checks' => $failures, 'timestamp' => gmdate('c')]);
    $webhook = (string) env('ALERT_WEBHOOK_URL', '');
    if ($webhook !== '') {
        @file_get_contents($webhook, false, stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $payload,
            'timeout' => 5,
            'ignore_errors' => true,
        ]]));
    }
    fwrite(STDERR, $payload . "\n");
    exit(1);
}

echo json_encode(['service' => 'cifro', 'status' => 'ok', 'timestamp' => gmdate('c')]) . "\n";
