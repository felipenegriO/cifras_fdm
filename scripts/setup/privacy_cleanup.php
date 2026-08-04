<?php
require_once __DIR__ . '/guard.php';

$pdo = Database::getConnection();
$stmt = $pdo->prepare(
    'DELETE FROM password_reset_tokens
     WHERE expira_em < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
        OR (usado=1 AND expira_em < UTC_TIMESTAMP())'
);
$stmt->execute();
echo 'Tokens removidos: ' . $stmt->rowCount() . "\n";
