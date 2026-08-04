<?php
require_once __DIR__ . '/guard.php';
// MIGRAÇÃO DE PLANOS — REMOVER APÓS EXECUTAR
header('Content-Type: text/plain; charset=utf-8');

$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) putenv(trim($parts[0]) . '=' . trim($parts[1], "\"'"));
    }
}

try {
    $pdo = new PDO(
        "mysql:host=" . getenv('DB_HOST') . ";dbname=" . getenv('DB_NAME') . ";charset=utf8mb4",
        getenv('DB_USER'), getenv('DB_PASS'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    echo "Conexão OK\n\n";
} catch (Exception $e) {
    die("ERRO: " . $e->getMessage() . "\n");
}

$sqls = [
    "Ampliar ENUM de planos em bandas" =>
        "ALTER TABLE bandas MODIFY COLUMN plano ENUM('trial','gratuito','mensal','semestral','anual','bloqueado','ativo','basico','banda') NOT NULL DEFAULT 'gratuito'",
    "Converter trials em gratuitos" =>
        "UPDATE bandas SET plano = 'gratuito', trial_expira_em = NULL WHERE plano = 'trial'",
];

foreach ($sqls as $desc => $sql) {
    try {
        $pdo->exec($sql);
        echo "✓ $desc\n";
    } catch (Exception $e) {
        echo "✗ $desc: " . $e->getMessage() . "\n";
    }
}

echo "\n✅ Migração concluída! Delete este arquivo do servidor.\n";
