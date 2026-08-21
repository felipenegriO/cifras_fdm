<?php

require_once __DIR__ . '/../../public/config/env.php';
require_once __DIR__ . '/../../public/src/Services/MigrationRunner.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

$options = getopt('', ['status', 'allow-production']);
$migrationsDir = __DIR__ . '/../../migrations';

$host = (string) env('DB_HOST', '');
$database = (string) env('DB_NAME', '');
$user = (string) env('DB_USER', '');
if ($host === '' || $database === '' || $user === '') {
    fwrite(STDERR, "DB_HOST, DB_NAME e DB_USER são obrigatórios.\n");
    exit(1);
}

$pdo = new PDO(
    'mysql:host=' . $host . ';dbname=' . $database . ';charset=utf8mb4',
    $user,
    (string) env('DB_PASS', ''),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$runner = new MigrationRunner($pdo, $migrationsDir);

// --status vem ANTES do guard de produção de propósito: é leitura pura, e é
// exatamente em produção que a pergunta "o banco está atrasado?" importa.
// Exigir --allow-production para consultar significava destravar a escrita só
// para olhar — ninguém faz isso por rotina, e foi assim que 8 migrations
// pendentes ficaram invisíveis até derrubarem o sync.
if (isset($options['status'])) {
    $pendentes = $runner->pendingIds();
    foreach (MigrationRunner::discover($migrationsDir) as $migration) {
        echo (in_array($migration['id'], $pendentes, true) ? 'pending ' : 'applied ') . $migration['id'] . "\n";
    }
    exit(0);
}

$production = strtolower((string) env('APP_ENV', 'production')) === 'production';
$productionAllowed = filter_var(env('MIGRATIONS_ALLOW_PRODUCTION', 'false'), FILTER_VALIDATE_BOOLEAN);
if ($production && (!isset($options['allow-production']) || !$productionAllowed)) {
    fwrite(STDERR, "Use --allow-production e MIGRATIONS_ALLOW_PRODUCTION=true para migrar produção.\n");
    exit(1);
}

$applied = $runner->applyAll();
foreach ($applied as $migrationId) {
    echo 'applied ' . $migrationId . "\n";
}
if ($applied === []) {
    echo "up-to-date\n";
}
