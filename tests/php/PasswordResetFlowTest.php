<?php

use PHPUnit\Framework\TestCase;

final class PasswordResetFlowTest extends TestCase
{
    // ---- checkTokenForDisplay ----

    public function testCheckTokenForDisplayInvalidoQuandoTokenVazio(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->expects(self::never())->method('peekToken');
        $flow = new PasswordResetFlow($repo);
        self::assertSame('Link inválido ou expirado.', $flow->checkTokenForDisplay(''));
    }

    public function testCheckTokenForDisplayInvalidoQuandoPeekFalha(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('peekToken')->willReturn(null);
        $flow = new PasswordResetFlow($repo);
        self::assertSame('Link inválido ou expirado.', $flow->checkTokenForDisplay('tok'));
    }

    public function testCheckTokenForDisplayValidoQuandoPeekOk(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('peekToken')->willReturn('user-1');
        $flow = new PasswordResetFlow($repo);
        self::assertNull($flow->checkTokenForDisplay('tok'));
    }

    // ---- handleSubmit ----

    public function testHandleSubmitRejeitaSenhaInvalida(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->expects(self::never())->method('consumeToken');
        $flow = new PasswordResetFlow($repo);
        $result = $flow->handleSubmit('tok', '123', '123');
        self::assertSame('A senha deve ter pelo menos 12 caracteres.', $result['erro']);
        self::assertFalse($result['ok']);
    }

    public function testHandleSubmitRejeitaTokenInvalido(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('consumeToken')->willReturn(null);
        $repo->expects(self::never())->method('updatePassword');
        $flow = new PasswordResetFlow($repo);
        $result = $flow->handleSubmit('tok-invalido', 'SegredoForte!2026', 'SegredoForte!2026');
        self::assertSame('Link inválido ou expirado. Solicite um novo.', $result['erro']);
        self::assertFalse($result['ok']);
    }

    public function testHandleSubmitSucessoAtualizaSenha(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('consumeToken')->willReturn('user-42');
        $repo->expects(self::once())->method('updatePassword')->with('user-42', self::isType('string'));
        $flow = new PasswordResetFlow($repo);
        $result = $flow->handleSubmit('tok', 'SegredoForte!2026', 'SegredoForte!2026');
        self::assertNull($result['erro']);
        self::assertTrue($result['ok']);
        self::assertSame('user-42', $result['userId']);
    }
}
