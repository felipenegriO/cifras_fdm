<?php
require_once __DIR__ . '/../../public/config/env.php';
require_once __DIR__ . '/../../public/src/Services/DatabaseBackupService.php';

if (PHP_SAPI !== 'cli') exit(1);
$options = getopt('', ['file:', 'target-db:']);
$file = isset($options['file']) ? realpath((string) $options['file']) : false;
$targetDb = (string) ($options['target-db'] ?? '');
if ($file === false || !is_file($file)) throw new RuntimeException('Arquivo de backup inválido.');
if (!preg_match('/^[a-zA-Z0-9_]+_restore_[a-zA-Z0-9_]+$/', $targetDb) || $targetDb === env('DB_NAME')) {
    throw new RuntimeException('A restauração só pode usar banco isolado com _restore_ no nome.');
}

$sql = DatabaseBackupService::decrypt((string) file_get_contents($file), (string) env('BACKUP_ENCRYPTION_KEY', ''));
$binary = (string) env('MYSQL_BIN', 'mysql');
$base = escapeshellarg($binary) . ' --host=' . escapeshellarg((string) env('DB_HOST')) . ' --user=' . escapeshellarg((string) env('DB_USER'));
$environment = array_merge($_ENV, ['MYSQL_PWD' => (string) env('DB_PASS')]);

$create = proc_open($base, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $environment);
fwrite($pipes[0], 'CREATE DATABASE `' . $targetDb . '` CHARACTER SET utf8mb4;');
fclose($pipes[0]);
stream_get_contents($pipes[1]); fclose($pipes[1]);
stream_get_contents($pipes[2]); fclose($pipes[2]);
if (proc_close($create) !== 0) throw new RuntimeException('Falha ao criar banco isolado.');

$restore = proc_open($base . ' ' . escapeshellarg($targetDb), [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $environment);
fwrite($pipes[0], $sql); fclose($pipes[0]);
stream_get_contents($pipes[1]); fclose($pipes[1]);
stream_get_contents($pipes[2]); fclose($pipes[2]);
if (proc_close($restore) !== 0) throw new RuntimeException('Falha ao restaurar backup.');
echo $targetDb . "\n";
