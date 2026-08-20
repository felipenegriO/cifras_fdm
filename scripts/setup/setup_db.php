<?php
require_once __DIR__ . '/guard.php';
// SETUP DO BANCO — REMOVER APÓS EXECUTAR
header('Content-Type: text/plain; charset=utf-8');

// Carrega .env manualmente
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $k = trim($parts[0]);
            $v = trim($parts[1], "\"'");
            putenv("$k=$v");
        }
    }
}

$host = getenv('DB_HOST') ?: 'localhost';
$db   = getenv('DB_NAME');
$user = getenv('DB_USER');
$pass = getenv('DB_PASS');

echo "Conectando em $host / $db...\n";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "Conexão OK\n\n";
} catch (Exception $e) {
    die("ERRO de conexão: " . $e->getMessage() . "\n");
}

require_once __DIR__ . '/../../public/src/Services/MigrationRunner.php';

// O schema tem um lugar só: create_tables.sql. Este script LÊ o baseline em
// vez de reescrevê-lo — foi a reescrita que deixou produção com 12 das 17
// tabelas e causou o incidente de 13/08.
//
// splitStatements() em vez de explode(';'): ele respeita aspas, e um ponto e
// vírgula dentro de um valor default partiria o comando ao meio.
$schemaPath = __DIR__ . '/../../create_tables.sql';
if (!is_file($schemaPath)) {
    fwrite(STDERR, "Schema não encontrado em {$schemaPath}.\n");
    exit(1);
}

$statements = MigrationRunner::splitStatements((string) file_get_contents($schemaPath));
$ok = 0;

// Falha no primeiro erro, de propósito. Este script só roda contra banco
// vazio; ali, qualquer erro significa schema quebrado, e seguir em frente é
// exatamente como a divergência se escondeu por meses.
foreach ($statements as $stmt) {
    if (stripos($stmt, 'SET ') === 0) continue;
    try {
        $pdo->exec($stmt);
        $ok++;
    } catch (Throwable $e) {
        fwrite(STDERR, "\n✗ Falhou: " . substr($stmt, 0, 120) . "\n  " . $e->getMessage() . "\n");
        exit(1);
    }
}

echo "✓ {$ok} instruções aplicadas do baseline\n";

// Alterações para bancos que já existem. Num banco novo elas rodam sobre um
// schema que já as contém — por isso precisam ser idempotentes.
$aplicadas = (new MigrationRunner($pdo, __DIR__ . '/../../migrations'))->applyAll();
foreach ($aplicadas as $id) echo "✓ migration {$id}\n";

// Lista tabelas finais
$tabelas = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
echo "Tabelas no banco agora:\n";
foreach ($tabelas as $t) echo "  - $t\n";

echo "\n✅ PRONTO! Delete este arquivo (setup_db.php) do servidor.\n";
