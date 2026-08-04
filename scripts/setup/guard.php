<?php
require_once __DIR__ . '/../../public/config/env.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit('Not found.');
}

if (strtolower((string) env('APP_ENV', 'production')) === 'production') {
    fwrite(STDERR, "Scripts de setup e migração são bloqueados em produção.\n");
    exit(1);
}
