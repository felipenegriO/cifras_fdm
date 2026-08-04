<?php

use PHPUnit\Framework\TestCase;

final class BandaPlanoValidatorTest extends TestCase
{
    public function testNormalizarConverteTrialParaGratuito(): void
    {
        self::assertSame('gratuito', BandaPlanoValidator::normalizar('trial'));
    }

    public function testNormalizarMantemOutrosPlanos(): void
    {
        self::assertSame('mensal', BandaPlanoValidator::normalizar('mensal'));
        self::assertSame('bloqueado', BandaPlanoValidator::normalizar('bloqueado'));
    }

    public function testIsValidoParaPlanosConhecidos(): void
    {
        foreach (['gratuito', 'mensal', 'semestral', 'anual', 'bloqueado', 'ativo'] as $plano) {
            self::assertTrue(BandaPlanoValidator::isValido($plano));
        }
    }

    public function testIsValidoFalseParaPlanoDesconhecido(): void
    {
        self::assertFalse(BandaPlanoValidator::isValido('trial'));
        self::assertFalse(BandaPlanoValidator::isValido('vip'));
        self::assertFalse(BandaPlanoValidator::isValido(''));
    }
}
