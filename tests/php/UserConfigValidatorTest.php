<?php

use PHPUnit\Framework\TestCase;

final class UserConfigValidatorTest extends TestCase
{
    // ---- isKeySuportada ----

    public function testChavesSuportadas(): void
    {
        self::assertTrue(UserConfigValidator::isKeySuportada('tema'));
        self::assertTrue(UserConfigValidator::isKeySuportada('cifraSize'));
        self::assertTrue(UserConfigValidator::isKeySuportada('scrollSpeed'));
        self::assertTrue(UserConfigValidator::isKeySuportada('keepAwake'));
        self::assertTrue(UserConfigValidator::isKeySuportada('ajudaDesativada'));
    }

    public function testChaveDesconhecidaNaoEhSuportada(): void
    {
        self::assertFalse(UserConfigValidator::isKeySuportada('outraCoisa'));
    }

    // ---- tema ----

    public function testTemaValido(): void
    {
        self::assertSame('dark', UserConfigValidator::validate('tema', 'dark'));
        self::assertSame('light', UserConfigValidator::validate('tema', 'light'));
        self::assertSame('auto', UserConfigValidator::validate('tema', 'auto'));
    }

    public function testTemaInvalido(): void
    {
        self::assertNull(UserConfigValidator::validate('tema', 'roxo'));
        self::assertNull(UserConfigValidator::validate('tema', 123));
    }

    // ---- cifraSize ----

    public function testCifraSizeValido(): void
    {
        self::assertSame('18', UserConfigValidator::validate('cifraSize', 18));
        self::assertSame('14', UserConfigValidator::validate('cifraSize', '14'));
    }

    public function testCifraSizeInvalido(): void
    {
        self::assertNull(UserConfigValidator::validate('cifraSize', 15));
        self::assertNull(UserConfigValidator::validate('cifraSize', 'abc'));
    }

    // ---- scrollSpeed ----

    public function testScrollSpeedValido(): void
    {
        self::assertSame('slow', UserConfigValidator::validate('scrollSpeed', 'slow'));
        self::assertSame('fast', UserConfigValidator::validate('scrollSpeed', 'fast'));
    }

    public function testScrollSpeedInvalido(): void
    {
        self::assertNull(UserConfigValidator::validate('scrollSpeed', 'turbo'));
    }

    // ---- keepAwake ----

    public function testKeepAwakeAceitaBooleanTrueOuStringTrue(): void
    {
        self::assertSame('true', UserConfigValidator::validate('keepAwake', true));
        self::assertSame('true', UserConfigValidator::validate('keepAwake', 'true'));
    }

    public function testKeepAwakeAceitaBooleanFalseOuStringFalse(): void
    {
        self::assertSame('false', UserConfigValidator::validate('keepAwake', false));
        self::assertSame('false', UserConfigValidator::validate('keepAwake', 'false'));
    }

    public function testKeepAwakeInvalido(): void
    {
        self::assertNull(UserConfigValidator::validate('keepAwake', 'maybe'));
        self::assertNull(UserConfigValidator::validate('keepAwake', 1));
    }

    public function testAjudaDesativadaAceitaSomenteBooleanoOuStringBoolean(): void
    {
        self::assertSame('true', UserConfigValidator::validate('ajudaDesativada', true));
        self::assertSame('true', UserConfigValidator::validate('ajudaDesativada', 'true'));
        self::assertSame('false', UserConfigValidator::validate('ajudaDesativada', false));
        self::assertSame('false', UserConfigValidator::validate('ajudaDesativada', 'false'));
        self::assertNull(UserConfigValidator::validate('ajudaDesativada', 1));
        self::assertNull(UserConfigValidator::validate('ajudaDesativada', 'sim'));
    }

    // ---- instrumento e capotraste ----

    public function testAceitaOsInstrumentosSuportados(): void
    {
        self::assertSame('violao', UserConfigValidator::validate('instrumento', 'violao'));
        self::assertSame('teclado', UserConfigValidator::validate('instrumento', 'teclado'));
        self::assertSame('outro', UserConfigValidator::validate('instrumento', 'outro'));
    }

    public function testRecusaInstrumentoDesconhecido(): void
    {
        self::assertNull(UserConfigValidator::validate('instrumento', 'gaita'));
        self::assertNull(UserConfigValidator::validate('instrumento', 123));
    }

    public function testAceitaAsQuatroPreferenciasDeCapotraste(): void
    {
        foreach (['simplificar', 'basico', 'cadastrado', 'nunca'] as $preferencia) {
            self::assertSame($preferencia, UserConfigValidator::validate('transposicaoPreferencia', $preferencia));
        }
    }

    public function testRecusaPreferenciaDeCapotrasteDesconhecida(): void
    {
        self::assertNull(UserConfigValidator::validate('transposicaoPreferencia', 'sempre'));
        self::assertNull(UserConfigValidator::validate('transposicaoPreferencia', true));
    }

    public function testInstrumentoEPreferenciaSaoSalvaveis(): void
    {
        self::assertTrue(UserConfigValidator::isKeySuportada('instrumento'));
        self::assertTrue(UserConfigValidator::isKeySuportada('transposicaoPreferencia'));
    }

    // ---- chave desconhecida ----

    public function testChaveDesconhecidaRetornaNull(): void
    {
        self::assertNull(UserConfigValidator::validate('outraCoisa', 'valor'));
    }
}
