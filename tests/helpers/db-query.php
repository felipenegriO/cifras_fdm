<?php
/**
 * Ponte de banco para os testes E2E (usada por tests/helpers/db.js).
 * Lê JSON {"sql": "...", "params": [...]} do stdin e imprime as linhas em JSON.
 * Usa o mesmo carregador de .env da aplicação.
 */
require_once __DIR__ . '/../../public/config/env.php';

$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input || !isset($input['sql'])) {
    fwrite(STDERR, "payload inválido\n");
    exit(1);
}

try {
    $database = strtolower((string) env('APP_ENV', 'production')) === 'test'
        ? trim((string) env('E2E_DB_NAME', ''))
        : trim((string) env('DB_NAME', ''));
    if ($database === '' || $database === env('DB_NAME')) {
        throw new RuntimeException('Banco E2E exclusivo não configurado.');
    }
    $pdo = new PDO(
        'mysql:host=' . env('DB_HOST') . ';dbname=' . $database . ';charset=utf8mb4',
        env('DB_USER'),
        env('DB_PASS'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $stmt = $pdo->prepare($input['sql']);
    $stmt->execute($input['params'] ?? []);
    $rows = $stmt->columnCount() > 0 ? $stmt->fetchAll() : [];
    echo json_encode(['rows' => $rows, 'affected' => $stmt->rowCount()]);
} catch (Exception $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
