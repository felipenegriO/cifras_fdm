<?php

use PHPUnit\Framework\TestCase;

final class CategoriaFormValidatorTest extends TestCase
{
    // ---- isDeleteIdValido ----

    public function testIdValidoQuandoNumerico(): void
    {
        self::assertTrue(CategoriaFormValidator::isDeleteIdValido(5));
        self::assertTrue(CategoriaFormValidator::isDeleteIdValido('5'));
    }

    public function testIdInvalidoQuandoVazioOuNaoNumerico(): void
    {
        self::assertFalse(CategoriaFormValidator::isDeleteIdValido(null));
        self::assertFalse(CategoriaFormValidator::isDeleteIdValido(''));
        self::assertFalse(CategoriaFormValidator::isDeleteIdValido(0));
        self::assertFalse(CategoriaFormValidator::isDeleteIdValido('abc'));
    }

    // ---- validateNome ----

    public function testNomeVazioEhInvalido(): void
    {
        self::assertSame('Informe o nome da categoria.', CategoriaFormValidator::validateNome(''));
    }

    public function testNomeMuitoLongoEhInvalido(): void
    {
        $nome = str_repeat('a', 101);
        self::assertSame('O nome deve ter no máximo 100 caracteres.', CategoriaFormValidator::validateNome($nome));
    }

    public function testNomeNoLimiteDeCemCaracteresEhValido(): void
    {
        $nome = str_repeat('a', 100);
        self::assertNull(CategoriaFormValidator::validateNome($nome));
    }

    public function testNomeValidoRetornaNull(): void
    {
        self::assertNull(CategoriaFormValidator::validateNome('Louvor'));
    }
}
