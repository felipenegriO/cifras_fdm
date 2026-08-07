<?php
// Bootstrap dos testes PHPUnit: autoload do Composer + helpers globais (env, etc).
// OpenSSL on Windows/XAMPP needs the cnf path set before key generation.
if (PHP_OS_FAMILY === 'Windows' && !getenv('OPENSSL_CONF')) {
    foreach (['C:\\xampp\\apache\\conf\\openssl.cnf', 'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.cfg'] as $cnf) {
        if (file_exists($cnf)) { putenv("OPENSSL_CONF=$cnf"); break; }
    }
}
require_once __DIR__ . '/../../public/vendor/autoload.php';
require_once __DIR__ . '/../../public/config/env.php';
spl_autoload_register(function (string $class): void {
    foreach (['Services', 'Repositories', 'Controllers'] as $directory) {
        $path = __DIR__ . '/../../public/src/' . $directory . '/' . $class . '.php';
        if (is_file($path)) {
            require_once $path;
            return;
        }
    }
});
