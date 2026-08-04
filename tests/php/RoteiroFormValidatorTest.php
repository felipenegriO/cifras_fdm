<?php

use PHPUnit\Framework\TestCase;

final class RoteiroFormValidatorTest extends TestCase
{
    public function testInvalidoQuandoTituloVazio(): void
    {
        self::assertFalse(RoteiroFormValidator::isValido('', 'conteudo'));
    }

    public function testInvalidoQuandoTituloMuitoLongo(): void
    {
        self::assertFalse(RoteiroFormValidator::isValido(str_repeat('a', 201), 'x'));
    }

    public function testInvalidoQuandoConteudoMuitoLongo(): void
    {
        self::assertFalse(RoteiroFormValidator::isValido('Titulo', str_repeat('a', 2000001)));
    }

    public function testValidoNosLimites(): void
    {
        self::assertTrue(RoteiroFormValidator::isValido(str_repeat('a', 200), str_repeat('b', 2000000)));
    }

    public function testValidoComValoresSimples(): void
    {
        self::assertTrue(RoteiroFormValidator::isValido('Aviso', 'Texto qualquer'));
    }

    public function testNormalizaQuebrasDeLinhaParaBr(): void
    {
        self::assertSame('linha1<br/>linha2<br/>linha3', RoteiroFormValidator::normalizarConteudo("linha1\r\nlinha2\nlinha3"));
    }

    public function testNormalizaTagBrSemAtributosParaFormatoPadrao(): void
    {
        self::assertSame('a<br/>b', RoteiroFormValidator::normalizarConteudo('a<br>b'));
    }
}
