<?php

use PHPUnit\Framework\TestCase;

final class GoogleCallbackValidatorTest extends TestCase
{
    // ---- isStateValid ----

    public function testStateValidoQuandoIguais(): void
    {
        self::assertTrue(GoogleCallbackValidator::isStateValid('abc123', 'abc123'));
    }

    public function testStateInvalidoQuandoDiferentes(): void
    {
        self::assertFalse(GoogleCallbackValidator::isStateValid('abc123', 'xyz789'));
    }

    public function testStateInvalidoQuandoEsperadoVazio(): void
    {
        self::assertFalse(GoogleCallbackValidator::isStateValid('', 'abc123'));
    }

    public function testStateInvalidoQuandoRecebidoNaoEhString(): void
    {
        self::assertFalse(GoogleCallbackValidator::isStateValid('abc123', null));
        self::assertFalse(GoogleCallbackValidator::isStateValid('abc123', ['x']));
    }

    // ---- userCancelled ----

    public function testCancelamentoDetectadoQuandoErrorPresente(): void
    {
        self::assertTrue(GoogleCallbackValidator::userCancelled(['error' => 'access_denied']));
    }

    public function testSemCancelamentoQuandoErrorAusenteOuVazio(): void
    {
        self::assertFalse(GoogleCallbackValidator::userCancelled([]));
        self::assertFalse(GoogleCallbackValidator::userCancelled(['error' => '']));
    }

    // ---- extractCode ----

    public function testExtractCodeRetornaCodeValido(): void
    {
        self::assertSame('abc123', GoogleCallbackValidator::extractCode(['code' => 'abc123']));
    }

    public function testExtractCodeRetornaNullQuandoAusenteOuVazio(): void
    {
        self::assertNull(GoogleCallbackValidator::extractCode([]));
        self::assertNull(GoogleCallbackValidator::extractCode(['code' => '']));
    }

    public function testExtractCodeRetornaNullQuandoNaoString(): void
    {
        self::assertNull(GoogleCallbackValidator::extractCode(['code' => ['x']]));
    }

    // ---- isConfigured ----

    public function testIsConfiguredTrueQuandoTresPreenchidos(): void
    {
        self::assertTrue(GoogleCallbackValidator::isConfigured('id', 'secret', 'uri'));
    }

    public function testIsConfiguredFalseQuandoQualquerUmVazio(): void
    {
        self::assertFalse(GoogleCallbackValidator::isConfigured('', 'secret', 'uri'));
        self::assertFalse(GoogleCallbackValidator::isConfigured('id', '', 'uri'));
        self::assertFalse(GoogleCallbackValidator::isConfigured('id', 'secret', ''));
    }
}
