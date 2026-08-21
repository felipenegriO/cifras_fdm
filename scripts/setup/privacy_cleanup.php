<?php
require_once __DIR__ . '/guard.php';
require_once __DIR__ . '/../../public/src/Services/Database.php';
require_once __DIR__ . '/../../public/src/Services/ErrorLogger.php';

$pdo = Database::getConnection();
$stmt = $pdo->prepare(
    'DELETE FROM password_reset_tokens
     WHERE expira_em < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
        OR (usado=1 AND expira_em < UTC_TIMESTAMP())'
);
$stmt->execute();
echo 'Tokens removidos: ' . $stmt->rowCount() . "\n";

$retencaoLogs = max(1, (int) env('ERROR_LOG_RETENTION_DAYS', '30'));
echo 'Logs técnicos removidos: ' . ErrorLogger::limparAntigos($retencaoLogs) . "\n";
