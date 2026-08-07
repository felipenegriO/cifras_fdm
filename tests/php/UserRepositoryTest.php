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

    public function testSaveToBandaComEmailVazioSalvaComNulo(): void
    {
        $bandId = 'phpunit-band-' . bin2hex(random_bytes(8));
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$bandId, 'Banda Sem Email', 'gratuito']);

        $id = $this->repo->saveToBanda(['nome' => 'Sem Email', 'email' => ''], $bandId, 'basico');
        $user = $this->repo->findById($id);
        self::assertNotNull($user);
        self::assertNull($user['email']);
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

    public function testFindByEmailRetornaUsuarioComBandas(): void
    {
        $bandId = 'phpunit-band-' . bin2hex(random_bytes(8));
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$bandId, 'Banda Email Test', 'gratuito']);
        $this->pdo->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, ?)')
            ->execute([$this->userId, $bandId, 'administrador']);

        $found = $this->repo->findByEmail($this->email);

        self::assertNotNull($found);
        self::assertNotEmpty($found['bandas']);
    }

    public function testRecordLegalAcceptance(): void
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS user_legal_acceptances (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id CHAR(36) NOT NULL,
                terms_version VARCHAR(40) NOT NULL,
                privacy_version VARCHAR(40) NOT NULL,
                accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ip_hash CHAR(64) DEFAULT NULL,
                PRIMARY KEY (id),
                INDEX idx_legal_acceptance_user (usuario_id),
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );

        $this->repo->recordLegalAcceptance($this->userId, '1.0', '1.0', null);

        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM user_legal_acceptances WHERE usuario_id = ?');
        $stmt->execute([$this->userId]);
        self::assertSame(1, (int)$stmt->fetchColumn());
    }

    public function testFindByIdInBandaAndBelongsToBanda(): void
    {
        $bandId = 'phpunit-band-' . bin2hex(random_bytes(8));
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$bandId, 'Banda FindById Test', 'gratuito']);
        $this->pdo->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, ?)')
            ->execute([$this->userId, $bandId, 'administrador']);

        $found = $this->repo->findByIdInBanda($this->userId, $bandId);
        self::assertNotNull($found);
        self::assertSame($this->userId, $found['id']);

        self::assertTrue($this->repo->belongsToBanda($this->userId, $bandId));

        $outsider = 'phpunit-outsider-' . bin2hex(random_bytes(8));
        self::assertFalse($this->repo->belongsToBanda($outsider, $bandId));
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
