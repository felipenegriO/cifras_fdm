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

if ($uri === '/health' || $uri === '/ready') {
    require __DIR__ . '/public' . $uri . '.php';
    return true;
}

if (in_array($uri, $blocked, true)) {
    http_response_code(403);
    echo '403 Forbidden';
    return true;
}

if (getenv('PHP_WEB_COVERAGE') === '1') {
    $relative = $uri === '/' ? '/index.php' : $uri;
    $target = realpath(__DIR__ . '/public' . $relative);
    $public = realpath(__DIR__ . '/public');
    if ($target && strpos($target, $public . DIRECTORY_SEPARATOR) === 0 && pathinfo($target, PATHINFO_EXTENSION) === 'php') {
        require __DIR__ . '/tests/coverage/php-web-prepend.php';
        require $target;
        return true;
    }
}

// Fall through to default built-in server behaviour
return false;
