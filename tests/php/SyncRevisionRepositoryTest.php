<?php

use PHPUnit\Framework\TestCase;

final class SyncRevisionRepositoryTest extends TestCase
{
    private PDO $pdo;
    private string $bandaId;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $suffix = bin2hex(random_bytes(8));
        $this->bandaId = 'phpunit-sync-' . $suffix;
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$this->bandaId, 'Banda Sync PHPUnit', 'gratuito']);
    }

    protected function tearDown(): void
    {
        // band_sync_state cascades on DELETE of bandas
        $this->pdo->prepare('DELETE FROM bandas WHERE id = ?')->execute([$this->bandaId]);
    }

    public function testGetReturns0WhenBandaHasNoState(): void
    {
        $repo = new SyncRevisionRepository();
        self::assertSame(0, $repo->get('phpunit-nonexistent-' . bin2hex(random_bytes(4))));
    }

    public function testMutateCreatesStateAndIncrementsRevision(): void
    {
        $repo = new SyncRevisionRepository();

        $result = $repo->mutate($this->bandaId, null, fn() => 'op1');
        self::assertSame(1, $result['revision']);
        self::assertSame('op1', $result['result']);
        self::assertSame(1, $repo->get($this->bandaId));

        $result2 = $repo->mutate($this->bandaId, 1, fn() => 'op2');
        self::assertSame(2, $result2['revision']);
        self::assertSame(2, $repo->get($this->bandaId));
    }

    public function testMutateThrowsSyncConflictExceptionOnStaleBaseRevision(): void
    {
        $repo = new SyncRevisionRepository();
        $repo->mutate($this->bandaId, null, fn() => null); // revision → 1

        try {
            $repo->mutate($this->bandaId, 0, fn() => null); // stale base
            self::fail('Expected SyncConflictException was not thrown');
        } catch (SyncConflictException $e) {
            self::assertSame(1, $e->getCurrentRevision());
        }
    }
}
