<?php

final class SessionStorage
{
    public static function configure(?string $configuredPath = null, ?string $applicationRoot = null): string
    {
        if (session_status() !== PHP_SESSION_NONE) {
            return (string) ini_get('session.save_path');
        }

        $path = trim($configuredPath ?? (string) env('SESSION_SAVE_PATH', ''));
        if ($path === '') {
            $root = $applicationRoot ?? dirname(__DIR__, 3);
            $suffix = substr(hash('sha256', realpath($root) ?: $root), 0, 12);
            $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'cifro-sessions-' . $suffix;
        }

        if (!is_dir($path) && !mkdir($path, 0700, true) && !is_dir($path)) {
            throw new RuntimeException('Não foi possível criar o diretório próprio de sessões.');
        }
        if (!is_writable($path)) {
            throw new RuntimeException('O diretório próprio de sessões não permite gravação.');
        }
        if (ini_set('session.save_path', $path) === false) {
            throw new RuntimeException('Não foi possível configurar o diretório próprio de sessões.');
        }

        return $path;
    }
}
