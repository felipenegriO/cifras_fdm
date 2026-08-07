<?php
require_once __DIR__ . '/../../public/config/env.php';

$host = (string) env('DB_HOST', '127.0.0.1');
$port = (string) env('DB_PORT', '3306');
$user = (string) env('DB_USER', 'root');
$pass = (string) env('DB_PASS', '');
$database = trim((string) env('E2E_DB_NAME', 'cifro_e2e'));
$production = trim((string) env('DB_NAME', ''));
if (!in_array($host, ['localhost', '127.0.0.1', '::1'], true)) throw new RuntimeException('Setup E2E permitido apenas em MySQL local.');
if (!preg_match('/^[a-zA-Z0-9_]+$/', $database) || $database === $production) throw new RuntimeException('Nome do banco E2E inválido.');

$server = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$server->exec("DROP DATABASE IF EXISTS `{$database}`");
$server->exec("CREATE DATABASE `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$pdo = new PDO("mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$schemaPath = __DIR__ . '/../../create_tables.sql';
if (!is_file($schemaPath)) {
    throw new RuntimeException("Schema não encontrado em {$schemaPath}. O banco E2E ficaria vazio.");
}
$schema = file_get_contents($schemaPath);
$statements = preg_split('/;\s*(?:\r?\n|$)/', preg_replace('/^\s*--.*$/m', '', $schema));
foreach ($statements as $statement) {
    if (trim($statement) === '') continue;
    try { $pdo->exec($statement); }
    catch (PDOException $error) {
        if (!in_array((int)($error->errorInfo[1] ?? 0), [1060, 1061], true)) throw $error;
    }
}

$email = (string) env('TEST_EMAIL', 'admin@e2e.local');
$password = (string) env('TEST_PASSWORD', 'CifroE2E#2026!');
$userId = '00000000-0000-4000-8000-000000000001';
$bandId = '00000000-0000-4000-8000-000000000002';
$pdo->beginTransaction();
try {
    $pdo->prepare("INSERT INTO bandas (id,nome,ativo,plano) VALUES (?, 'Banda E2E', 1, 'gratuito') ON DUPLICATE KEY UPDATE nome=VALUES(nome), ativo=1")->execute([$bandId]);
    $pdo->prepare("INSERT INTO usuarios (id,nome,email,senha_hash,perfil,ativo,plano) VALUES (?, 'Administrador E2E', ?, ?, 'master', 1, 'ativo') ON DUPLICATE KEY UPDATE nome=VALUES(nome), senha_hash=VALUES(senha_hash), ativo=1")
        ->execute([$userId, $email, password_hash($password, PASSWORD_DEFAULT)]);
    $pdo->prepare("INSERT INTO usuario_banda (usuario_id,banda_id,perfil) VALUES (?,?,'administrador') ON DUPLICATE KEY UPDATE perfil='administrador'")->execute([$userId, $bandId]);
    $song = $pdo->prepare('INSERT INTO musicas (banda_id,nome,artista,cifra,bit) VALUES (?,?,?,?,?)');
    $song->execute([$bandId, 'Música E2E 1', 'Cifrô', '<p><b>C G Am F</b></p><p>Canção de teste.</p>', '120']);
    $song->execute([$bandId, 'Música E2E 2', 'Cifrô', '<p><b>D A Bm G</b></p><p>Outra canção de teste.</p>', '100']);
    $pdo->commit();
} catch (Throwable $error) {
    $pdo->rollBack();
    throw $error;
}

echo "Banco E2E local pronto: {$database}\n";
