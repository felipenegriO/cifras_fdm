<?php

use PHPUnit\Framework\TestCase;

final class PasswordResetValidatorTest extends TestCase
{
    public function testRejeitaSenhaCurta(): void
    {
        self::assertSame(
            'A senha deve ter pelo menos 12 caracteres.',
            PasswordResetValidator::validateNewPassword('123', '123')
        );
    }

    public function testRejeitaSenhasDiferentes(): void
    {
        self::assertSame(
            'As senhas não coincidem.',
            PasswordResetValidator::validateNewPassword('SenhaForte!2026', 'OutraForte!2026')
        );
    }

    public function testAceitaSenhaValidaEConfirmada(): void
    {
        self::assertNull(PasswordResetValidator::validateNewPassword('SenhaForte!2026', 'SenhaForte!2026'));
    }

    public function testLimiteExatoDeDozeCaracteresEhAceito(): void
    {
        self::assertNull(PasswordResetValidator::validateNewPassword('Abcdef!23456', 'Abcdef!23456'));
    }

    public function testRejeitaSenhaComprometida(): void
    {
        self::assertSame(
            'Escolha uma senha que não seja comum ou conhecida em vazamentos.',
            PasswordResetValidator::validateNewPassword('123456789012', '123456789012')
        );
    }

    public function testRejeitaSenhaComprometidaComCheckerCustomizado(): void
    {
        CompromisedPasswordChecker::setChecker(fn(string $p) => $p === 'MinhaSecreta@2026');
        try {
            self::assertSame(
                'Escolha uma senha que não seja comum ou conhecida em vazamentos.',
                PasswordResetValidator::validateNewPassword('MinhaSecreta@2026', 'MinhaSecreta@2026')
            );
            self::assertNull(PasswordResetValidator::validateNewPassword('OutraSenha@2026!', 'OutraSenha@2026!'));
        } finally {
            CompromisedPasswordChecker::setChecker(null);
        }
    }
}
