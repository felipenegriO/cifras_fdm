<?php
// Bootstrap dos testes PHPUnit: autoload do Composer + helpers globais (env, etc).
require_once __DIR__ . '/../../vendor/autoload.php';
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
