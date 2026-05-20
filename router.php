<?php
/**
 * PHP built-in server router — blocks sensitive files
 * Usage: php -S localhost:8090 -t public router.php
 */
$blocked = [
    '/composer.json', '/composer.lock', '/package.json', '/package-lock.json',
    '/.env', '/.env.example',
];

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (in_array($uri, $blocked, true)) {
    http_response_code(403);
    echo '403 Forbidden';
    return true;
}

// Fall through to default built-in server behaviour
return false;
