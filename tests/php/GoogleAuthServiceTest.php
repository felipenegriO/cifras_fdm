<?php

use PHPUnit\Framework\TestCase;

final class GoogleAuthServiceTest extends TestCase
{
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'sub' => 'google-sub-1',
            'email' => 'user@example.com',
            'email_verified' => true,
            'name' => 'Google User',
        ], $overrides);
    }

    public function testResolveOrCreateUserEncontraPorGoogleSub(): void
    {
        $existing = ['id' => 'u1', 'nome' => 'Existing', 'email' => 'user@example.com', 'bandas' => []];
        $users = $this->createMock(UserRepository::class);
        $users->method('findByGoogleSub')->with('google-sub-1')->willReturn($existing);
        $users->expects(self::never())->method('findByEmail');
        $users->expects(self::never())->method('save');

        $bandas = $this->createMock(BandaRepository::class);
        $service = new GoogleAuthService($users, $bandas);

        $result = $service->resolveOrCreateUser($this->payload());
        self::assertSame('u1', $result['id']);
    }

    public function testResolveOrCreateUserEncontraPorEmailELinkaGoogleSub(): void
    {
        $existing = ['id' => 'u2', 'nome' => 'Existing Email', 'email' => 'user@example.com', 'bandas' => []];
        $users = $this->createMock(UserRepository::class);
        $users->method('findByGoogleSub')->willReturn(null);
        $users->method('findByEmail')->with('user@example.com')->willReturn($existing);
        $users->expects(self::once())->method('linkGoogleSub')->with('u2', 'google-sub-1');
        $users->expects(self::never())->method('save');

        $bandas = $this->createMock(BandaRepository::class);
        $service = new GoogleAuthService($users, $bandas);

        $result = $service->resolveOrCreateUser($this->payload());
        self::assertSame('u2', $result['id']);
    }

    public function testResolveOrCreateUserCriaContaEBandaQuandoNaoExiste(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('findByGoogleSub')->willReturn(null);
        $users->method('findByEmail')->willReturn(null);
        $users->expects(self::once())->method('save')->with(self::callback(function ($user) {
            return $user['email'] === 'user@example.com'
                && $user['nome'] === 'Google User'
                && $user['ativo'] === 1
                && $user['google_sub'] === 'google-sub-1'
                && count($user['bandas']) === 1
                && $user['bandas'][0]['perfil'] === 'administrador';
        }));

        $bandas = $this->createMock(BandaRepository::class);
        $bandas->expects(self::once())->method('save')->with(self::callback(fn($b) => $b['plano'] === 'gratuito'));

        $service = new GoogleAuthService($users, $bandas);
        $result = $service->resolveOrCreateUser($this->payload());

        self::assertSame('user@example.com', $result['email']);
        self::assertCount(1, $result['bandas']);
    }

    public function testResolveOrCreateUserUsaEmailQuandoNomeGoogleVazio(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('findByGoogleSub')->willReturn(null);
        $users->method('findByEmail')->willReturn(null);
        $users->expects(self::once())->method('save')->with(self::callback(
            fn(array $user): bool => $user['nome'] === 'user@example.com'
        ));

        $bandas = $this->createMock(BandaRepository::class);
        $bandas->expects(self::once())->method('save')->with(self::callback(
            fn(array $banda): bool => $banda['nome'] === 'Minha Banda'
        ));

        $result = (new GoogleAuthService($users, $bandas))->resolveOrCreateUser($this->payload(['name' => '   ']));

        self::assertSame('user@example.com', $result['nome']);
    }

    public function testUsuarioDesativadoEncontradoPorGoogleSubNaoConsegueLogar(): void
    {
        $desativado = ['id' => 'u-desat', 'nome' => 'Banido', 'email' => 'ban@example.com', 'ativo' => 0, 'bandas' => []];
        $users = $this->createMock(UserRepository::class);
        $users->method('findByGoogleSub')->willReturn($desativado);

        $service = new GoogleAuthService($users, $this->createMock(BandaRepository::class));

        $this->expectException(\RuntimeException::class);
        $service->resolveOrCreateUser($this->payload());
    }

    public function testUsuarioDesativadoEncontradoPorEmailNaoConsegueLogar(): void
    {
        $desativado = ['id' => 'u-desat', 'nome' => 'Banido', 'email' => 'user@example.com', 'ativo' => 0, 'bandas' => []];
        $users = $this->createMock(UserRepository::class);
        $users->method('findByGoogleSub')->willReturn(null);
        $users->method('findByEmail')->willReturn($desativado);

        $service = new GoogleAuthService($users, $this->createMock(BandaRepository::class));

        $this->expectException(\RuntimeException::class);
        $service->resolveOrCreateUser($this->payload());
    }

    public function testResolveOrCreateUserRejeitaEmailNaoVerificado(): void
    {
        $users = $this->createMock(UserRepository::class);
        $bandas = $this->createMock(BandaRepository::class);
        $service = new GoogleAuthService($users, $bandas);

        $this->expectException(\RuntimeException::class);
        $service->resolveOrCreateUser($this->payload(['email_verified' => false]));
    }

    public function testExchangeCodeForIdTokenRetornaIdTokenDaResposta(): void
    {
        $service = new GoogleAuthService($this->createMock(UserRepository::class), $this->createMock(BandaRepository::class));
        $token = $service->exchangeCodeForIdToken(
            'auth-code-123',
            'client-id',
            'client-secret',
            'https://cifro.online/api/auth/google/callback',
            fn($url, $fields) => ['id_token' => 'fake-jwt-token', 'access_token' => 'x']
        );
        self::assertSame('fake-jwt-token', $token);
    }

    public function testExchangeCodeForIdTokenLancaExcecaoSemIdToken(): void
    {
        $service = new GoogleAuthService($this->createMock(UserRepository::class), $this->createMock(BandaRepository::class));
        $this->expectException(\RuntimeException::class);
        $service->exchangeCodeForIdToken('code', 'id', 'secret', 'uri', fn($url, $fields) => ['error' => 'invalid_grant']);
    }

    /** Exercises the real default postFormReal() without touching the network. */
    private function callPostFormReal(GoogleAuthService $service, string $url): array
    {
        $ref = new ReflectionMethod(GoogleAuthService::class, 'postFormReal');
        $ref->setAccessible(true);
        return $ref->invoke($service, $url, ['a' => 'b']);
    }

    public function testPostFormRealDecodificaRespostaJsonValida(): void
    {
        $service = new GoogleAuthService($this->createMock(UserRepository::class), $this->createMock(BandaRepository::class));
        $url = 'data://text/plain,' . rawurlencode(json_encode(['id_token' => 'xyz']));
        $result = $this->callPostFormReal($service, $url);
        self::assertSame(['id_token' => 'xyz'], $result);
    }

    public function testPostFormRealRetornaArrayVazioParaRespostaNaoJson(): void
    {
        $service = new GoogleAuthService($this->createMock(UserRepository::class), $this->createMock(BandaRepository::class));
        $url = 'data://text/plain,' . rawurlencode('not json');
        self::assertSame([], $this->callPostFormReal($service, $url));
    }

    public function testPostFormRealRetornaArrayVazioQuandoUrlInvalida(): void
    {
        $service = new GoogleAuthService($this->createMock(UserRepository::class), $this->createMock(BandaRepository::class));
        self::assertSame([], $this->callPostFormReal($service, 'http://url-invalida.invalid.test.local/x'));
    }

    public function testUsuarioNovoVindoDeConviteNaoGanhaBandaPropria(): void
    {
        $usuarios = $this->createMock(UserRepository::class);
        $bandas   = $this->createMock(BandaRepository::class);
        $convites = $this->createMock(BandaConviteRepository::class);

        $usuarios->method('findByGoogleSub')->willReturn(null);
        $usuarios->method('findByEmail')->willReturn(null);

        // A prova: nenhuma banda é criada quando existe convite.
        $bandas->expects(self::never())->method('save');
        $usuarios->expects(self::once())->method('save')->with(self::callback(
            fn(array $u) => $u['bandas'] === [['id' => 'banda-convidada', 'perfil' => 'basico']]
        ));
        $convites->expects(self::once())->method('registrarUso')->with('token-convite');

        $servico = new GoogleAuthService($usuarios, $bandas, $convites);
        $user = $servico->resolveOrCreateUser([
            'sub' => 'sub-1', 'email' => 'novo@exemplo.com', 'email_verified' => true, 'name' => 'Novo',
        ], ['token' => 'token-convite', 'banda_id' => 'banda-convidada']);

        self::assertSame([['id' => 'banda-convidada', 'perfil' => 'basico']], $user['bandas']);
    }

    public function testSemConviteOFluxoDoGoogleContinuaCriandoABandaDoUsuario(): void
    {
        $usuarios = $this->createMock(UserRepository::class);
        $bandas   = $this->createMock(BandaRepository::class);

        $usuarios->method('findByGoogleSub')->willReturn(null);
        $usuarios->method('findByEmail')->willReturn(null);
        $bandas->expects(self::once())->method('save');

        $servico = new GoogleAuthService($usuarios, $bandas);
        $user = $servico->resolveOrCreateUser([
            'sub' => 'sub-2', 'email' => 'sozinho@exemplo.com', 'email_verified' => true, 'name' => 'Sozinho',
        ]);

        self::assertSame('administrador', $user['bandas'][0]['perfil']);
    }
}
