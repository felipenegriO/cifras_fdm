<?php
use PHPUnit\Framework\TestCase;

final class AuthServiceTest extends TestCase
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

    private function makeService(array $users): AuthService
    {
        file_put_contents($this->tmpFile, json_encode($users));
        return new AuthService(new UserRepository($this->tmpFile));
    }

    private function userFixture(array $overrides = []): array
    {
        return array_merge([
            'id' => 'u1',
            'username' => 'felipe',
            'nome' => 'Felipe',
            'ativo' => true,
            'senhaHash' => password_hash('s3nha', PASSWORD_DEFAULT),
            'perfil' => 'administrador',
            'validade' => ''
        ], $overrides);
    }

    public function testAuthenticatesValidCredentials(): void
    {
        $svc = $this->makeService([$this->userFixture()]);
        $result = $svc->authenticate('felipe', 's3nha');

        self::assertNull($result['error']);
        self::assertSame('felipe', $result['user']['username']);
    }

    public function testRejectsUnknownUser(): void
    {
        $svc = $this->makeService([$this->userFixture()]);
        $result = $svc->authenticate('zezinho', 'qualquer');

        self::assertNull($result['user']);
        self::assertSame('Usuário ou senha inválidos.', $result['error']);
    }

    public function testRejectsWrongPassword(): void
    {
        $svc = $this->makeService([$this->userFixture()]);
        $result = $svc->authenticate('felipe', 'errada');

        self::assertNull($result['user']);
        self::assertSame('Usuário ou senha inválidos.', $result['error']);
    }

    public function testRejectsInactiveUser(): void
    {
        $svc = $this->makeService([$this->userFixture(['ativo' => false])]);
        $result = $svc->authenticate('felipe', 's3nha');

        self::assertNull($result['user']);
        self::assertSame('Usuário inativo.', $result['error']);
    }

    public function testRejectsExpiredExternalUser(): void
    {
        $ontem = (new DateTimeImmutable('yesterday', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
        $svc = $this->makeService([$this->userFixture(['perfil' => 'externo', 'validade' => $ontem])]);
        $result = $svc->authenticate('felipe', 's3nha');

        self::assertNull($result['user']);
        self::assertSame('Usuario temporario expirado.', $result['error']);
    }

    public function testAcceptsExternalUserValidToday(): void
    {
        $hoje = (new DateTimeImmutable('today', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d');
        $svc = $this->makeService([$this->userFixture(['perfil' => 'externo', 'validade' => $hoje])]);
        $result = $svc->authenticate('felipe', 's3nha');

        self::assertNull($result['error']);
        self::assertSame('felipe', $result['user']['username']);
    }

    public function testRejectsExternalUserWithoutExpiration(): void
    {
        $svc = $this->makeService([$this->userFixture(['perfil' => 'externo', 'validade' => ''])]);
        $result = $svc->authenticate('felipe', 's3nha');

        self::assertNull($result['user']);
        self::assertSame('Usuario externo sem validade configurada.', $result['error']);
    }

    public function testRejectsUserWithoutPasswordHash(): void
    {
        $svc = $this->makeService([$this->userFixture(['senhaHash' => null])]);
        $result = $svc->authenticate('felipe', 's3nha');

        self::assertNull($result['user']);
        self::assertSame('Usuário ou senha inválidos.', $result['error']);
    }
}
