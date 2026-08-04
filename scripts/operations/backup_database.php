<?php
require_once __DIR__ . '/../../public/config/env.php';
require_once __DIR__ . '/../../public/src/Services/DatabaseBackupService.php';

if (PHP_SAPI !== 'cli') exit(1);
$target = rtrim((string) env('BACKUP_TARGET_DIR', ''), '/\\');
$key = (string) env('BACKUP_ENCRYPTION_KEY', '');
if ($target === '' || $key === '') throw new RuntimeException('BACKUP_TARGET_DIR e BACKUP_ENCRYPTION_KEY são obrigatórios.');
if (!is_dir($target) && !mkdir($target, 0700, true) && !is_dir($target)) throw new RuntimeException('Destino externo indisponível.');
$resolvedTarget = realpath($target);
$projectRoot = realpath(__DIR__ . '/../..');
if ($resolvedTarget === false || $projectRoot === false || str_starts_with(strtolower($resolvedTarget), strtolower($projectRoot . DIRECTORY_SEPARATOR))) {
    throw new RuntimeException('BACKUP_TARGET_DIR deve ficar fora do projeto.');
}

$binary = (string) env('MYSQLDUMP_BIN', 'mysqldump');
$command = escapeshellarg($binary) . ' --single-transaction --quick --skip-lock-tables --host=' . escapeshellarg((string) env('DB_HOST')) . ' --user=' . escapeshellarg((string) env('DB_USER')) . ' ' . escapeshellarg((string) env('DB_NAME'));
$environment = array_merge($_ENV, ['MYSQL_PWD' => (string) env('DB_PASS')]);
$process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $environment);
if (!is_resource($process)) throw new RuntimeException('Não foi possível iniciar mysqldump.');
$dump = stream_get_contents($pipes[1]);
$errorOutput = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$exitCode = proc_close($process);
if ($exitCode !== 0 || $dump === '') throw new RuntimeException('mysqldump falhou sem gerar backup válido.');

$filename = $target . DIRECTORY_SEPARATOR . 'cifro-' . gmdate('Ymd-His') . '.sql.enc';
if (file_put_contents($filename, DatabaseBackupService::encrypt($dump, $key), LOCK_EX) === false) throw new RuntimeException('Falha ao gravar backup criptografado.');
DatabaseBackupService::prune($target, max(1, (int) env('BACKUP_RETENTION_DAYS', 30)));
echo basename($filename) . "\n";
