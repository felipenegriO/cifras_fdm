<?php
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
$version = substr(hash('sha256', $source), 0, 12);
$source = preg_replace("/const APP_VERSION = '[^']+';/", "const APP_VERSION = '{$version}';", $source, 1);
header('X-Cifro-App-Version: ' . $version);
echo 'const SW_BASE = ' . json_encode($base) . ';' . "\n";
echo $source;
