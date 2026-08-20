<?php
require_once __DIR__ . '/config/env.php';
if ((string) env('APP_ENV', '') === 'test' && ($_GET['e2e_stale_login'] ?? '') === '1') {
    require __DIR__ . '/service-worker-e2e-stale-login.php';
    return;
}
/**
 * Serve o service worker como JS puro.
 * Necessário porque o nginx roteia tudo que não está em /src/ para o PHP.
 * Service-Worker-Allowed: / garante escopo global mesmo sendo servido via PHP.
 */
$file = __DIR__ . '/service-worker.js';
if (!file_exists($file)) {
    http_response_code(404);
    exit;
}

$requestedBase = rawurldecode((string)($_GET['base'] ?? ''));
$validRequestedBase = $requestedBase === '' || (
    str_starts_with($requestedBase, '/')
    && !str_contains($requestedBase, '..')
    && preg_match('#^/[A-Za-z0-9._~/-]*$#', $requestedBase) === 1
);
$base = $validRequestedBase ? rtrim($requestedBase, '/') : '';
if ($base === '') {
    $base = rtrim((string)getenv('APP_BASE'), '/');
}
if ($base === '') {
    $requestPath = parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    $scriptPath = $requestPath ?: parse_url((string)($_SERVER['SCRIPT_NAME'] ?? ''), PHP_URL_PATH);
    $directory = str_replace('\\', '/', dirname((string)$scriptPath));
    $base = $directory === '/' || $directory === '.' ? '' : rtrim($directory, '/');
}

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store');
header('Service-Worker-Allowed: /');

$source = file_get_contents($file);
$helpEnabled = filter_var(env('HELP_CENTER_ENABLED', 'true'), FILTER_VALIDATE_BOOLEAN);
$fingerprint = hash_init('sha256');
hash_update($fingerprint, $source . ($helpEnabled ? ':help-on' : ':help-off') . ':' . (string) env('APP_VERSION', ''));
$roots = [__DIR__ . '/src/js', __DIR__ . '/src/css', __DIR__ . '/src/Views'];
$files = [__FILE__, __DIR__ . '/offline.php', __DIR__ . '/manifest.json'];
foreach ($roots as $root) {
    if (!is_dir($root)) continue;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $asset) {
        if ($asset->isFile()) $files[] = $asset->getPathname();
    }
}
sort($files, SORT_STRING);
foreach ($files as $asset) {
    if (!is_file($asset)) continue;
    hash_update($fingerprint, str_replace('\\', '/', substr($asset, strlen(__DIR__))) . ':' . hash_file('sha256', $asset));
}
$version = substr(hash_final($fingerprint), 0, 12);
$source = preg_replace("/const APP_VERSION = '[^']+';/", "const APP_VERSION = '{$version}';", $source, 1);
header('X-Cifro-App-Version: ' . $version);
echo 'const SW_BASE = ' . json_encode($base) . ';' . "\n";
echo 'const SW_HELP_ENABLED = ' . ($helpEnabled ? 'true' : 'false') . ';' . "\n";
echo $source;
