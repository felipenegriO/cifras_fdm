<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/Services/DatabaseBackupService.php';

final class DatabaseBackupServiceTest extends TestCase
{
    public function testCriptografaERecuperaBackupAutenticado(): void
    {
        $key = base64_encode(random_bytes(32));
        $encrypted = DatabaseBackupService::encrypt('CREATE TABLE teste (id INT);', $key);
        self::assertStringStartsWith('CIFROBK1', $encrypted);
        self::assertStringNotContainsString('CREATE TABLE', $encrypted);
        self::assertSame('CREATE TABLE teste (id INT);', DatabaseBackupService::decrypt($encrypted, $key));
    }

    public function testRejeitaChaveInvalidaEPayloadAdulterado(): void
    {
        $this->expectException(RuntimeException::class);
        DatabaseBackupService::encrypt('dados', base64_encode('curta'));
    }

    public function testRemoveSomenteBackupsForaDaRetencao(): void
    {
        $directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cifro-prune-' . bin2hex(random_bytes(5));
        mkdir($directory);
        $old = $directory . DIRECTORY_SEPARATOR . 'cifro-old.sql.enc';
        $new = $directory . DIRECTORY_SEPARATOR . 'cifro-new.sql.enc';
        file_put_contents($old, 'old'); file_put_contents($new, 'new');
        touch($old, time() - 40 * 86400);
        try {
            self::assertSame(1, DatabaseBackupService::prune($directory, 30));
            self::assertFileDoesNotExist($old);
            self::assertFileExists($new);
        } finally {
            if (is_file($old)) unlink($old);
            if (is_file($new)) unlink($new);
            rmdir($directory);
        }
    }
}
