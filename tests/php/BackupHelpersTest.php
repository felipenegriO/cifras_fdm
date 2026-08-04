<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/backend/backup_helpers.php';

final class BackupHelpersTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cifro-backup-' . bin2hex(random_bytes(6));
        mkdir($this->dir, 0755, true);
    }

    protected function tearDown(): void
    {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->dir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($this->dir);
    }

    public function testIgnoraOrigemInvalidaOuInexistente(): void
    {
        cifro_backup_file(null);
        cifro_backup_file('');
        cifro_backup_file($this->dir . DIRECTORY_SEPARATOR . 'inexistente.json');

        self::assertDirectoryDoesNotExist($this->dir . DIRECTORY_SEPARATOR . 'backups');
    }

    public function testCriaBackupRealDoArquivo(): void
    {
        $source = $this->dir . DIRECTORY_SEPARATOR . 'dados.json';
        file_put_contents($source, '{"valor":1}');

        cifro_backup_file($source);

        $backups = glob($this->dir . DIRECTORY_SEPARATOR . 'backups' . DIRECTORY_SEPARATOR . 'dados.json.*.bak');
        self::assertCount(1, $backups);
        self::assertSame('{"valor":1}', file_get_contents($backups[0]));
    }

    public function testMantemSomenteOsBackupsMaisRecentes(): void
    {
        $backupDir = $this->dir . DIRECTORY_SEPARATOR . 'backups';
        mkdir($backupDir);
        for ($index = 1; $index <= 5; $index++) {
            $file = $backupDir . DIRECTORY_SEPARATOR . "dados.json.$index.bak";
            file_put_contents($file, (string)$index);
            touch($file, 1_700_000_000 + $index);
        }

        cifro_cleanup_backups($backupDir . DIRECTORY_SEPARATOR, 'dados.json', 2);

        $remaining = glob($backupDir . DIRECTORY_SEPARATOR . 'dados.json.*.bak');
        sort($remaining);
        self::assertCount(2, $remaining);
        self::assertStringEndsWith('dados.json.4.bak', $remaining[0]);
        self::assertStringEndsWith('dados.json.5.bak', $remaining[1]);

        cifro_cleanup_backups($backupDir, 'dados.json', 2);
        self::assertCount(2, glob($backupDir . DIRECTORY_SEPARATOR . 'dados.json.*.bak'));
    }

    public function testAtualizaVersaoDeCacheEmServiceWorkerRealTemporario(): void
    {
        $worker = $this->dir . DIRECTORY_SEPARATOR . 'service-worker.js';
        file_put_contents($worker, "const CACHE_NAME = 'cacheCifro-antigo';\nself.addEventListener('fetch', () => {});");

        $version = cifro_bump_cache_version($worker);

        self::assertMatchesRegularExpression('/^cacheCifro-\d{14}$/', $version);
        self::assertStringContainsString("const CACHE_NAME = '$version';", file_get_contents($worker));
    }

    public function testRecusaServiceWorkerAusenteVazioOuSemMarcador(): void
    {
        self::assertFalse(cifro_bump_cache_version($this->dir . DIRECTORY_SEPARATOR . 'ausente.js'));

        $worker = $this->dir . DIRECTORY_SEPARATOR . 'service-worker.js';
        file_put_contents($worker, '');
        self::assertFalse(cifro_bump_cache_version($worker));

        file_put_contents($worker, 'self.addEventListener("fetch", () => {});');
        self::assertFalse(cifro_bump_cache_version($worker));
    }
}
