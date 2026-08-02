<?php

use PHPUnit\Framework\TestCase;

/**
 * Integration coverage for GoogleAuthService::resolveOrCreateUser() against the
 * REAL UserRepository/BandaRepository and local MySQL (same transaction-wrapped
 * pattern as UserRepositoryTest). Regression test for a bug found in final
 * cross-cutting review: createUserAndBanda() used to call UserRepository::save()
 * (which inserts usuario_banda rows inline) BEFORE BandaRepository::save()
 * created the band row, so every brand-new Google signup failed on the
 * usuario_banda -> bandas foreign key. Band must be created first.
 */
final class GoogleAuthServiceIntegrationTest extends TestCase
{
    private PDO $pdo;
    private UserRepository $users;
    private BandaRepository $bandas;
    private GoogleAuthService $service;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();
        $this->users = new UserRepository();
        $this->bandas = new BandaRepository();
        $this->service = new GoogleAuthService($this->users, $this->bandas);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
    }

    public function testResolveOrCreateUserCriaContaEBandaParaUsuarioNovo(): void
    {
        $sub = 'google-sub-integration-' . bin2hex(random_bytes(6));
        $email = 'google-integration-' . bin2hex(random_bytes(6)) . '@example.com';

        $payload = [
            'sub' => $sub,
            'email' => $email,
            'email_verified' => true,
            'name' => 'Google Integration User',
        ];

        // Before Fix 1, this threw a foreign-key constraint violation because
        // the user (with an inline usuario_banda row) was saved before the band.
        $user = $this->service->resolveOrCreateUser($payload);

        self::assertNotEmpty($user['id']);
        self::assertSame($email, $user['email']);
        self::assertCount(1, $user['bandas']);

        $bandaId = $user['bandas'][0]['id'];
        $banda = $this->bandas->findById($bandaId);
        self::assertNotNull($banda, 'Band created during Google signup must exist.');
        self::assertSame('gratuito', $banda['plano']);

        $foundByGoogleSub = $this->users->findByGoogleSub($sub);
        self::assertNotNull($foundByGoogleSub, 'New user must be findable by google_sub afterward.');
        self::assertSame($user['id'], $foundByGoogleSub['id']);
    }
}
