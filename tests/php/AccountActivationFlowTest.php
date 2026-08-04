<?php

use PHPUnit\Framework\TestCase;

final class AccountActivationFlowTest extends TestCase
{
    // ---- checkTokenForDisplay ----

    public function testCheckTokenForDisplayInvalidoQuandoVazio(): void
    {
        $users = $this->createMock(UserRepository::class);
        $flow = new AccountActivationFlow($users, $this->createMock(BandaRepository::class));
        self::assertNotNull($flow->checkTokenForDisplay(''));
    }

    public function testCheckTokenForDisplayInvalidoQuandoPeekFalha(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('peekToken')->willReturn(null);
        $flow = new AccountActivationFlow($users, $this->createMock(BandaRepository::class));
        self::assertNotNull($flow->checkTokenForDisplay('tok'));
    }

    public function testCheckTokenForDisplayValido(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('peekToken')->willReturn('user-1');
        $flow = new AccountActivationFlow($users, $this->createMock(BandaRepository::class));
        self::assertNull($flow->checkTokenForDisplay('tok'));
    }

    // ---- handleSubmit ----

    public function testHandleSubmitRejeitaSenhaInvalida(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->expects(self::never())->method('consumeToken');
        $flow = new AccountActivationFlow($users, $this->createMock(BandaRepository::class));
        $result = $flow->handleSubmit('tok', '123', '123');
        self::assertFalse($result['ok']);
        self::assertNotNull($result['erro']);
    }

    public function testHandleSubmitRejeitaTokenInvalido(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('consumeToken')->willReturn(null);
        $users->expects(self::never())->method('activate');
        $flow = new AccountActivationFlow($users, $this->createMock(BandaRepository::class));
        $result = $flow->handleSubmit('tok', 'SegredoForte!2026', 'SegredoForte!2026');
        self::assertFalse($result['ok']);
        self::assertNotNull($result['erro']);
    }

    public function testHandleSubmitSemUsuarioEncontradoRetornaOkSemSessao(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('consumeToken')->willReturn('user-1');
        $users->method('findById')->willReturn(null);
        $flow = new AccountActivationFlow($users, $this->createMock(BandaRepository::class));
        $result = $flow->handleSubmit('tok', 'SegredoForte!2026', 'SegredoForte!2026');
        self::assertTrue($result['ok']);
        self::assertNull($result['session']);
        self::assertNull($result['redirect']);
    }

    public function testHandleSubmitComUmaBandaRedirecionaParaIndexEIncluiBandaAtual(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('consumeToken')->willReturn('user-1');
        $users->method('findById')->willReturn(['id' => 'user-1', 'nome' => 'Fulano', 'perfil' => 'usuario']);
        $users->method('getBandasDoUsuario')->willReturn([['id' => 'b1', 'usuario_perfil' => 'administrador']]);

        $bandas = $this->createMock(BandaRepository::class);
        $bandas->method('findById')->willReturn(['id' => 'b1', 'nome' => 'Banda X', 'plano' => 'gratuito', 'trial_expira_em' => null]);

        $flow = new AccountActivationFlow($users, $bandas);
        $result = $flow->handleSubmit('tok', 'SegredoForte!2026', 'SegredoForte!2026');

        self::assertTrue($result['ok']);
        self::assertSame('/index.php', $result['redirect']);
        self::assertSame('b1', $result['session']['banda_atual']['id']);
        self::assertTrue($result['session']['autenticado']);
    }

    public function testHandleSubmitComMultiplasBandasRedirecionaParaSelectBanda(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('consumeToken')->willReturn('user-1');
        $users->method('findById')->willReturn(['id' => 'user-1', 'nome' => 'Fulano', 'perfil' => 'usuario']);
        $users->method('getBandasDoUsuario')->willReturn([
            ['id' => 'b1', 'usuario_perfil' => 'administrador'],
            ['id' => 'b2', 'usuario_perfil' => 'basico'],
        ]);

        $bandas = $this->createMock(BandaRepository::class);
        $bandas->expects(self::never())->method('findById');

        $flow = new AccountActivationFlow($users, $bandas);
        $result = $flow->handleSubmit('tok', 'SegredoForte!2026', 'SegredoForte!2026');

        self::assertSame('/select-banda.php', $result['redirect']);
        self::assertArrayNotHasKey('banda_atual', $result['session']);
    }

    public function testHandleSubmitComUmaBandaMasNaoEncontradaNoRepoNaoDefineBandaAtual(): void
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('consumeToken')->willReturn('user-1');
        $users->method('findById')->willReturn(['id' => 'user-1', 'nome' => 'Fulano', 'perfil' => 'usuario']);
        $users->method('getBandasDoUsuario')->willReturn([['id' => 'b1', 'usuario_perfil' => 'administrador']]);

        $bandas = $this->createMock(BandaRepository::class);
        $bandas->method('findById')->willReturn(null);

        $flow = new AccountActivationFlow($users, $bandas);
        $result = $flow->handleSubmit('tok', 'SegredoForte!2026', 'SegredoForte!2026');

        self::assertSame('/index.php', $result['redirect']);
        self::assertArrayNotHasKey('banda_atual', $result['session']);
    }
}
