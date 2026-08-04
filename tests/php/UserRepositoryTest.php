<?php
use PHPUnit\Framework\TestCase;

final class UserRepositoryTest extends TestCase
{
    private PDO $pdo;
    private UserRepository $repo;
    private string $userId;
    private string $email;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();
        $this->repo = new UserRepository();
        $this->userId = bin2hex(random_bytes(16));
        $this->email = 'phpunit.' . $this->userId . '@e2e.local';

        $this->repo->save([
            'id' => $this->userId,
            'nome' => 'PHPUnit User',
            'email' => $this->email,
            'senhaHash' => password_hash('segredo', PASSWORD_DEFAULT),
            'perfil' => 'usuario',
            'ativo' => 1,
            'validade' => '',
            'config' => ['tema' => 'dark'],
        ]);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
    }

    public function testGetAllContainsPersistedUser(): void
    {
        $users = $this->repo->getAll();
        $ids = array_column($users, 'id');

        self::assertContains($this->userId, $ids);
    }

    public function testFindByEmailMatchesCaseInsensitively(): void
    {
        $found = $this->repo->findByEmail(strtoupper($this->email));

        self::assertNotNull($found);
        self::assertSame('PHPUnit User', $found['nome']);
        self::assertSame('dark', $found['config']['tema']);
    }

    public function testFindByEmailReturnsNullWhenAbsent(): void
    {
        self::assertNull($this->repo->findByEmail('ausente.' . $this->userId . '@e2e.local'));
    }

    public function testSaveUpdatesExistingUser(): void
    {
        $this->repo->save([
            'id' => $this->userId,
            'nome' => 'PHPUnit Atualizado',
            'email' => $this->email,
            'senhaHash' => password_hash('nova-senha', PASSWORD_DEFAULT),
            'perfil' => 'usuario',
            'ativo' => 1,
            'validade' => '',
            'config' => ['tema' => 'light'],
        ]);

        $found = $this->repo->findByEmail($this->email);
        self::assertSame('PHPUnit Atualizado', $found['nome']);
        self::assertSame('light', $found['config']['tema']);
    }

    public function testConfigVazioEMesclagemSaoNormalizados(): void
    {
        $id = bin2hex(random_bytes(16));
        $email = "$id@e2e.local";
        $this->repo->save(['id' => $id, 'nome' => 'Sem Config', 'email' => $email, 'senha_hash' => 'hash']);

        $found = $this->repo->findById($id);
        self::assertSame([], $found['config']);
        self::assertSame('hash', $found['senhaHash']);

        $this->repo->updateConfig($id, ['tema' => 'light']);
        $this->repo->updateConfig($id, ['fonte' => '18']);
        self::assertSame(['tema' => 'light', 'fonte' => '18'], $this->repo->findById($id)['config']);
        self::assertNull($this->repo->findById('ausente'));
    }

    public function testGerenciaUsuarioDentroDaBanda(): void
    {
        $bandId = 'phpunit-band-' . bin2hex(random_bytes(8));
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$bandId, 'Banda UserRepo', 'gratuito']);

        $createdId = $this->repo->saveToBanda([
            'nome' => 'Novo Integrante',
            'email' => 'integrante.' . bin2hex(random_bytes(6)) . '@e2e.local',
            '_senhaPlain' => 'senha-forte',
            'validade' => '',
        ], $bandId, 'basico');
        self::assertNotEmpty($createdId);
        self::assertSame(1, $this->repo->countByBanda($bandId));
        self::assertTrue(password_verify('senha-forte', $this->repo->findById($createdId)['senhaHash']));

        $this->repo->saveToBanda(['id' => $createdId, 'nome' => 'Atualizado', 'email' => 'novo@e2e.local'], $bandId, 'gestor');
        self::assertSame('gestor', $this->repo->getByBanda($bandId)[0]['banda_perfil']);
        self::assertCount(1, $this->repo->getBandasDoUsuario($createdId));

        $this->repo->saveToBanda(['id' => $createdId, 'nome' => 'Com Senha', 'email' => 'novo@e2e.local', '_senhaPlain' => 'outra-senha'], $bandId, 'administrador');
        self::assertTrue(password_verify('outra-senha', $this->repo->findById($createdId)['senhaHash']));

        self::assertNotEmpty($this->repo->searchNotInBanda($bandId, 'PHPUnit User'));
        $this->repo->importToBanda($this->userId, $bandId, 'basico');
        $this->repo->importToBanda($this->userId, $bandId, 'gestor');
        self::assertSame(2, $this->repo->countByBanda($bandId));
        $this->repo->removeFromBanda($this->userId, $bandId);
        self::assertSame(1, $this->repo->countByBanda($bandId));
    }

    public function testSaveToBandaRejeitaEmailVazioPeloSchema(): void
    {
        $bandId = 'phpunit-band-' . bin2hex(random_bytes(8));
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$bandId, 'Banda Sem Email', 'gratuito']);

        $this->expectException(PDOException::class);
        $this->repo->saveToBanda(['nome' => 'Sem Email', 'email' => ''], $bandId, 'basico');
    }

    public function testAtivacaoSenhaETokensReais(): void
    {
        $newHash = password_hash('ativada', PASSWORD_DEFAULT);
        $this->repo->activate($this->userId, $newHash);
        self::assertTrue(password_verify('ativada', $this->repo->findById($this->userId)['senhaHash']));

        $secondHash = password_hash('alterada', PASSWORD_DEFAULT);
        $this->repo->updatePassword($this->userId, $secondHash);
        self::assertTrue(password_verify('alterada', $this->repo->findById($this->userId)['senhaHash']));

        self::assertNull($this->repo->peekToken('ausente'));
        self::assertNull($this->repo->consumeToken('ausente'));

        $valid = $this->repo->createToken($this->userId, 3600);
        self::assertSame($this->userId, $this->repo->peekToken($valid));
        self::assertSame($this->userId, $this->repo->consumeToken($valid));
        self::assertNull($this->repo->peekToken($valid));
        self::assertNull($this->repo->consumeToken($valid));

        $expired = $this->repo->createToken($this->userId, -10);
        self::assertNull($this->repo->peekToken($expired));
        self::assertNull($this->repo->consumeToken($expired));
    }

    public function testDeleteRemoveUsuario(): void
    {
        $this->repo->delete($this->userId);
        self::assertNull($this->repo->findById($this->userId));
    }

    public function testSaveSubstituiListaDeBandasInclusivePorVazia(): void
    {
        $bandId = 'phpunit-band-' . bin2hex(random_bytes(8));
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$bandId, 'Banda Save', 'gratuito']);
        $base = [
            'id' => $this->userId,
            'nome' => 'PHPUnit User',
            'email' => $this->email,
            'perfil' => 'usuario',
            'ativo' => 1,
            'config' => 'valor-invalido',
        ];

        $this->repo->save($base + ['bandas' => [['id' => $bandId, 'perfil' => 'gestor']]]);
        self::assertCount(1, $this->repo->getBandasDoUsuario($this->userId));

        $this->repo->save($base + ['bandas' => []]);
        self::assertSame([], $this->repo->getBandasDoUsuario($this->userId));
        self::assertSame([], $this->repo->findById($this->userId)['config']);
    }

    public function testFindByGoogleSubRetornaNullQuandoNaoExiste(): void
    {
        self::assertNull($this->repo->findByGoogleSub('sub-inexistente-xyz'));
    }

    public function testLinkGoogleSubEFindByGoogleSubEncontraUsuario(): void
    {
        $this->repo->linkGoogleSub($this->userId, 'google-sub-123');
        $found = $this->repo->findByGoogleSub('google-sub-123');

        self::assertNotNull($found);
        self::assertSame($this->userId, $found['id']);
    }

    public function testSavePersisteGoogleSubNaCriacao(): void
    {
        $id = bin2hex(random_bytes(16));
        $this->repo->save([
            'id' => $id,
            'nome' => 'Google New',
            'email' => 'googlenew-' . $id . '@example.com',
            'ativo' => 1,
            'google_sub' => 'google-sub-456',
        ]);

        $found = $this->repo->findByGoogleSub('google-sub-456');
        self::assertNotNull($found);
        self::assertSame($id, $found['id']);
    }
}
