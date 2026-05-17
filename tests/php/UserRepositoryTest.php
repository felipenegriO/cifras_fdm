<?php
use PHPUnit\Framework\TestCase;

final class UserRepositoryTest extends TestCase
{
    private string $tmpFile;

    protected function setUp(): void
    {
        $this->tmpFile = tempnam(sys_get_temp_dir(), 'fdm_users_');
    }

    protected function tearDown(): void
    {
        if (file_exists($this->tmpFile)) {
            unlink($this->tmpFile);
        }
    }

    private function writeUsers(array $users): void
    {
        file_put_contents($this->tmpFile, json_encode($users));
    }

    public function testGetAllReturnsEmptyArrayWhenFileMissing(): void
    {
        unlink($this->tmpFile);
        $repo = new UserRepository($this->tmpFile);
        self::assertSame([], $repo->getAll());
    }

    public function testGetAllReturnsEmptyArrayOnInvalidJson(): void
    {
        file_put_contents($this->tmpFile, 'not json at all');
        $repo = new UserRepository($this->tmpFile);
        self::assertSame([], $repo->getAll());
    }

    public function testFindByUsernameMatchesCaseInsensitively(): void
    {
        $this->writeUsers([
            ['username' => 'Felipe', 'nome' => 'Felipe N.'],
            ['username' => 'admin', 'nome' => 'Admin'],
        ]);
        $repo = new UserRepository($this->tmpFile);

        $found = $repo->findByUsername('  FELIPE  ');
        self::assertNotNull($found);
        self::assertSame('Felipe N.', $found['nome']);
    }

    public function testFindByUsernameReturnsNullWhenAbsent(): void
    {
        $this->writeUsers([['username' => 'admin']]);
        $repo = new UserRepository($this->tmpFile);
        self::assertNull($repo->findByUsername('felipe'));
    }
}
