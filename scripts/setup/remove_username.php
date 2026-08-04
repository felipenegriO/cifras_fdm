<?php
require_once __DIR__ . '/guard.php';
require_once __DIR__ . '/../../public/config/env.php';
require_once __DIR__ . '/../../public/src/Services/Database.php';

$pdo = Database::getConnection();
$database = env('DB_NAME');

$columnExists = function (string $table, string $column) use ($pdo, $database): bool {
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?'
    );
    $stmt->execute([$database, $table, $column]);
    return (bool)$stmt->fetchColumn();
};

if ($columnExists('usuarios', 'username')) {
    $pdo->exec(
        "UPDATE usuarios
         SET email=CONCAT(username, '@legacy.invalid')
         WHERE email IS NULL OR TRIM(email)=''"
    );

    $index = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?'
    );
    $index->execute([$database, 'usuarios', 'uq_username']);
    if ($index->fetchColumn()) $pdo->exec('ALTER TABLE usuarios DROP INDEX uq_username');

    $pdo->exec('ALTER TABLE usuarios MODIFY email VARCHAR(180) NOT NULL');
    $pdo->exec('ALTER TABLE usuarios DROP COLUMN username');
}

if ($columnExists('live_state', 'host_username')) {
    $pdo->exec('ALTER TABLE live_state DROP COLUMN host_username');
}

echo "Migração concluída.\n";
