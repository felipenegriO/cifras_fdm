<?php

use PHPUnit\Framework\TestCase;

final class UserFormValidatorTest extends TestCase
{
    // ---- isPerfilValido ----

    public function testPerfilValidoParaValoresPermitidos(): void
    {
        self::assertTrue(UserFormValidator::isPerfilValido('administrador'));
        self::assertTrue(UserFormValidator::isPerfilValido('gestor'));
        self::assertTrue(UserFormValidator::isPerfilValido('basico'));
        self::assertTrue(UserFormValidator::isPerfilValido('externo'));
    }

    public function testPerfilInvalidoParaValorDesconhecido(): void
    {
        self::assertFalse(UserFormValidator::isPerfilValido('super-admin'));
        self::assertFalse(UserFormValidator::isPerfilValido(''));
    }

    // ---- isEmailValido ----

    public function testEmailVazioEhValido(): void
    {
        self::assertTrue(UserFormValidator::isEmailValido(''));
    }

    public function testEmailBemFormadoEhValido(): void
    {
        self::assertTrue(UserFormValidator::isEmailValido('user@example.com'));
    }

    public function testEmailMalFormadoEhInvalido(): void
    {
        self::assertFalse(UserFormValidator::isEmailValido('not-an-email'));
    }

    // ---- isValidadeValida ----

    public function testValidadeVaziaEhValida(): void
    {
        self::assertTrue(UserFormValidator::isValidadeValida(''));
    }

    public function testValidadeComFormatoErradoEhInvalida(): void
    {
        self::assertFalse(UserFormValidator::isValidadeValida('31/12/2030'));
        self::assertFalse(UserFormValidator::isValidadeValida('2030-1-1'));
    }

    public function testValidadeComDataInexistenteEhInvalida(): void
    {
        self::assertFalse(UserFormValidator::isValidadeValida('2030-02-30'));
        self::assertFalse(UserFormValidator::isValidadeValida('2030-13-01'));
    }

    public function testValidadeComFormatoCorretoEhValida(): void
    {
        self::assertTrue(UserFormValidator::isValidadeValida('2030-12-31'));
    }

    // ---- isNomeEEmailPresentes ----

    public function testNomeEEmailPresentesQuandoAmbosPreenchidos(): void
    {
        self::assertTrue(UserFormValidator::isNomeEEmailPresentes('Fulano', 'f@x.com'));
    }

    public function testNomeEEmailAusenteQuandoNomeVazio(): void
    {
        self::assertFalse(UserFormValidator::isNomeEEmailPresentes('', 'f@x.com'));
    }

    public function testNomeEEmailAusenteQuandoEmailVazio(): void
    {
        self::assertFalse(UserFormValidator::isNomeEEmailPresentes('Fulano', ''));
    }

    // ---- mapSaveErrorMessage ----

    public function testMapeiaErroDeEmailDuplicado(): void
    {
        $e = new \PDOException('SQLSTATE[23000]: Duplicate entry \'x@y.com\' for key \'email\'');
        self::assertSame('E-mail já está em uso.', UserFormValidator::mapSaveErrorMessage($e));
    }

    public function testMapeiaErroGenerico(): void
    {
        $e = new \PDOException('SQLSTATE[HY000]: connection refused');
        self::assertSame('Erro ao salvar.', UserFormValidator::mapSaveErrorMessage($e));
    }

    // ---- isSearchQueryValid ----

    public function testQueryDeBuscaCurtaEhInvalida(): void
    {
        self::assertFalse(UserFormValidator::isSearchQueryValid(''));
        self::assertFalse(UserFormValidator::isSearchQueryValid('a'));
    }

    public function testQueryDeBuscaComDoisOuMaisCaracteresEhValida(): void
    {
        self::assertTrue(UserFormValidator::isSearchQueryValid('ab'));
        self::assertTrue(UserFormValidator::isSearchQueryValid('felipe'));
    }
}
