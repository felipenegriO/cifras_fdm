<?php

use PHPUnit\Framework\TestCase;

final class SessionStorageTest extends TestCase
{
    public function testConfiguraDiretorioExclusivoEGravavel(): void
    {
        if (session_status() !== PHP_SESSION_NONE) {
            self::markTestSkipped('A sessão já foi iniciada pelo processo de teste.');
        }

        $original = (string) ini_get('session.save_path');
        $path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cifro-session-test-' . bin2hex(random_bytes(6));

        try {
            self::assertSame($path, SessionStorage::configure($path));
            self::assertDirectoryIsWritable($path);
            self::assertSame($path, ini_get('session.save_path'));
        } finally {
            ini_set('session.save_path', $original);
            if (is_dir($path)) rmdir($path);
        }
    }
}
