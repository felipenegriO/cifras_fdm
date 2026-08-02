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

    public function testFindByGoogleSubRetornaNullQuandoNaoExiste(): void
    {
        $repo = new UserRepository();
        self::assertNull($repo->findByGoogleSub('sub-inexistente-xyz'));
    }

    public function testLinkGoogleSubEFindByGoogleSubEncontraUsuario(): void
    {
        $repo = new UserRepository();
        $id = bin2hex(random_bytes(16));
        $repo->save(['id' => $id, 'nome' => 'Google User', 'email' => 'googleuser-' . $id . '@example.com', 'ativo' => 1]);

        $repo->linkGoogleSub($id, 'google-sub-123');
        $found = $repo->findByGoogleSub('google-sub-123');

        self::assertNotNull($found);
        self::assertSame($id, $found['id']);

        $repo->delete($id);
    }

    public function testSavePersisteGoogleSubNaCriacao(): void
    {
        $repo = new UserRepository();
        $id = bin2hex(random_bytes(16));
        $repo->save(['id' => $id, 'nome' => 'Google New', 'email' => 'googlenew-' . $id . '@example.com', 'ativo' => 1, 'google_sub' => 'google-sub-456']);

        $found = $repo->findByGoogleSub('google-sub-456');
        self::assertNotNull($found);
        self::assertSame($id, $found['id']);

        $repo->delete($id);
    }
}
