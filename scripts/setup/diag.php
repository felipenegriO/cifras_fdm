<?php
require_once __DIR__ . '/guard.php';
// DIAGNÓSTICO TEMPORÁRIO — REMOVER APÓS USO
// Acesse: https://lightblue-chinchilla-313984.hostingersite.com/diag.php

header('Content-Type: text/plain; charset=utf-8');

echo "=== PHP ===\n";
echo "Versão: " . PHP_VERSION . "\n";
echo "SAPI: " . PHP_SAPI . "\n";
echo "__FILE__: " . __FILE__ . "\n";
echo "__DIR__:  " . __DIR__ . "\n\n";

echo "=== ESTRUTURA DE DIRETÓRIOS ===\n";
$checks = [
    __DIR__ . '/src/backend/bootstrap.php',
    __DIR__ . '/src/backend/backup_helpers.php',
    __DIR__ . '/src/Views/partials/icons.php',
    __DIR__ . '/config/env.php',
    __DIR__ . '/../.env',
    __DIR__ . '/.env',
];
foreach ($checks as $path) {
    echo ($path) . " → " . (file_exists($path) ? "OK" : "NÃO ENCONTRADO") . "\n";
}

echo "\n=== .ENV ===\n";
$envPaths = [
    __DIR__ . '/../.env',
    __DIR__ . '/.env',
    dirname(__DIR__) . '/.env',
];
$envFound = false;
foreach ($envPaths as $p) {
    if (file_exists($p)) {
        echo "Encontrado em: $p\n";
        $envFound = true;
        // Mostra só as chaves, não os valores
        $lines = file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (trim($line) === '' || $line[0] === '#') continue;
            $key = explode('=', $line, 2)[0];
            echo "  $key = (definido)\n";
        }
        break;
    }
}
if (!$envFound) echo "NENHUM .env encontrado nos caminhos testados!\n";

echo "\n=== VARIÁVEIS DE AMBIENTE (DB) ===\n";
foreach (['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASS'] as $k) {
    $v = getenv($k);
    echo "$k: " . ($v !== false ? "(definido, " . strlen($v) . " chars)" : "NÃO DEFINIDO") . "\n";
}

echo "\n=== EXTENSÕES PHP ===\n";
foreach (['pdo', 'pdo_mysql', 'mbstring', 'json', 'openssl', 'session'] as $ext) {
    echo "$ext: " . (extension_loaded($ext) ? "OK" : "FALTANDO") . "\n";
}

echo "\n=== TESTE DE CONEXÃO COM BANCO ===\n";
// Tenta carregar env manualmente
$envFile = __DIR__ . '/../.env';
if (!file_exists($envFile)) $envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) putenv(trim($parts[0]) . '=' . trim($parts[1], "\"'"));
    }
}
$host = getenv('DB_HOST');
$db   = getenv('DB_NAME');
$user = getenv('DB_USER');
$pass = getenv('DB_PASS');
if (!$host || !$db || !$user) {
    echo "FALHOU: credenciais não carregadas do .env\n";
} else {
    try {
        $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        echo "Conexão OK — banco: $db em $host\n";
        $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        echo "Tabelas: " . (count($tables) ? implode(', ', $tables) : "(nenhuma)") . "\n";
    } catch (Exception $e) {
        echo "FALHOU: " . $e->getMessage() . "\n";
    }
}

echo "\n=== BOOTSTRAP (tentativa) ===\n";
try {
    require_once __DIR__ . '/src/backend/bootstrap.php';
    echo "bootstrap.php carregou OK\n";
} catch (Throwable $e) {
    echo "ERRO em bootstrap.php:\n";
    echo get_class($e) . ": " . $e->getMessage() . "\n";
    echo "Arquivo: " . $e->getFile() . " linha " . $e->getLine() . "\n";
}

echo "\nFIM DO DIAGNÓSTICO\n";
