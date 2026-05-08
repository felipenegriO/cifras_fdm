<?php
require_once __DIR__ . '/../../config/env.php';

spl_autoload_register(function ($class) {
    $baseDir = __DIR__ . '/../';
    $paths = [
        $baseDir . 'Services/' . $class . '.php',
        $baseDir . 'Controllers/' . $class . '.php',
        $baseDir . 'Repositories/' . $class . '.php',
    ];

    foreach ($paths as $path) {
        if (file_exists($path)) {
            require_once $path;
            return;
        }
    }
});

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function send_no_cache_headers() {
    header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
    header("Pragma: no-cache");
    header("Expires: 0");
}

function require_auth() {
    if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true) {
        header('Location: /login.php');
        exit;
    }
}

function asset_url($path) {
    $path = (string) $path;
    if ($path === '') {
        return $path;
    }

    $filePath = $path[0] === '/' ? ($_SERVER['DOCUMENT_ROOT'] . $path) : $path;
    if (file_exists($filePath)) {
        return $path . '?v=' . filemtime($filePath);
    }

    return $path;
}

function render_view($view, $data = []) {
    $view = trim((string) $view, '/');
    $viewPath = __DIR__ . '/../Views/' . $view . '.php';
    if (!file_exists($viewPath)) {
        http_response_code(500);
        echo 'View not found.';
        exit;
    }

    if (is_array($data)) {
        extract($data, EXTR_SKIP);
    }

    require $viewPath;
}

function render_partial($partial, $data = []) {
    $partial = trim((string) $partial, '/');
    $partialPath = __DIR__ . '/../Views/partials/' . $partial . '.php';
    if (!file_exists($partialPath)) {
        http_response_code(500);
        echo 'Partial not found.';
        exit;
    }

    if (is_array($data)) {
        extract($data, EXTR_SKIP);
    }

    require $partialPath;
}

send_no_cache_headers();
