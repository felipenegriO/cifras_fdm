<?php
function fdm_backup_file($filePath) {
    if (!is_string($filePath) || $filePath === '' || !file_exists($filePath)) {
        return;
    }

    $dir = dirname($filePath) . '/backups';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    $backupName = basename($filePath) . '.' . date('Ymd-His') . '.bak';
    @copy($filePath, $dir . '/' . $backupName);
    fdm_cleanup_backups($dir, basename($filePath), 20);
}

function fdm_cleanup_backups($dir, $baseName, $keep) {
    $pattern = rtrim($dir, '/\\') . '/' . $baseName . '.*.bak';
    $files = glob($pattern);
    if (!is_array($files) || count($files) <= $keep) {
        return;
    }

    usort($files, function ($a, $b) {
        return filemtime($b) <=> filemtime($a);
    });

    foreach (array_slice($files, $keep) as $file) {
        @unlink($file);
    }
}

function fdm_bump_cache_version() {
    $serviceWorker = __DIR__ . '/../../service-worker.js';
    if (!file_exists($serviceWorker) || !is_writable($serviceWorker)) {
        return false;
    }

    $content = file_get_contents($serviceWorker);
    if (!is_string($content) || $content === '') {
        return false;
    }

    $newVersion = 'cacheStageBox-' . date('YmdHis');
    $updated = preg_replace(
        "/const\s+CACHE_NAME\s*=\s*'[^']+';/",
        "const CACHE_NAME = '" . $newVersion . "';",
        $content,
        1
    );

    if (!is_string($updated) || $updated === $content) {
        return false;
    }

    file_put_contents($serviceWorker, $updated, LOCK_EX);
    return $newVersion;
}
