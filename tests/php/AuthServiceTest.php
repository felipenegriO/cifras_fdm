<?php
use PHPUnit\Framework\TestCase;

final class AuthServiceTest extends TestCase
{
    private function makeService(array $users): AuthService
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturnCallback(
            static function (string $email) use ($users): ?array {
                foreach ($users as $user) {
                    if (strcasecmp($user['email'], $email) === 0) {
                        return $user;
                    }
                }
                return null;
            }
        );

        return new AuthService($repo);
    }

    private function userFixture(array $overrides = []): array
    {
        return array_merge([
            'id' => 'u1',
            'email' => 'felipe@e2e.local',
            'nome' => 'Felipe',
            'ativo' => true,
            'senhaHash' => password_hash('s3nha', PASSWORD_DEFAULT),
            'perfil' => 'usuario',
            'validade' => '',
        ], $overrides);
    }

    public function testAuthenticatesValidCredentials(): void
    {
        $result = $this->makeService([$this->userFixture()])
            ->authenticate('felipe@e2e.local', 's3nha');

        self::assertNull($result['error']);
        self::assertSame('felipe@e2e.local', $result['user']['email']);
    }

    public function testRejectsUnknownUser(): void
    {
        $result = $this->makeService([])->authenticate('zezinho@e2e.local', 'qualquer');

        self::assertNull($result['user']);
        self::assertSame('Usuário ou senha inválidos.', $result['error']);
    }

    public function testRejectsWrongPassword(): void
    {
        $result = $this->makeService([$this->userFixture()])
            ->authenticate('felipe@e2e.local', 'errada');

        self::assertNull($result['user']);
        self::assertSame('Usuário ou senha inválidos.', $result['error']);
    }

    public function testRejectsInactiveUser(): void
    {
        $result = $this->makeService([$this->userFixture(['ativo' => false])])
            ->authenticate('felipe@e2e.local', 's3nha');

        self::assertNull($result['user']);
        self::assertSame('Usuário inativo.', $result['error']);
    }

    public function testRejectsExpiredUser(): void
    {
        $ontem = (new DateTimeImmutable('yesterday', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
        $result = $this->makeService([$this->userFixture(['validade' => $ontem])])
            ->authenticate('felipe@e2e.local', 's3nha');

        self::assertNull($result['user']);
        self::assertSame('Usuario temporario expirado.', $result['error']);
    }

    public function testAcceptsUserValidToday(): void
    {
        $hoje = (new DateTimeImmutable('today', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
        $result = $this->makeService([$this->userFixture(['validade' => $hoje])])
            ->authenticate('felipe@e2e.local', 's3nha');

        self::assertNull($result['error']);
    }

    public function testAcceptsInvalidExpirationAsUnspecified(): void
    {
        $result = $this->makeService([$this->userFixture(['validade' => 'data-invalida'])])
            ->authenticate('felipe@e2e.local', 's3nha');

        self::assertNull($result['error']);
    }

    public function testRejectsExternalUserWithoutExpiration(): void
    {
        $result = $this->makeService([$this->userFixture(['perfil' => 'externo'])])
            ->authenticate('felipe@e2e.local', 's3nha');

        self::assertNull($result['user']);
        self::assertSame('Usuario externo sem validade configurada.', $result['error']);
    }

    public function testRejectsUserWithoutPasswordHash(): void
    {
        $result = $this->makeService([$this->userFixture(['senhaHash' => null])])
            ->authenticate('felipe@e2e.local', 's3nha');

        self::assertNull($result['user']);
        self::assertSame('Usuário ou senha inválidos.', $result['error']);
    }
}
