<?php

use PHPUnit\Framework\TestCase;

final class PlaylistFormValidatorTest extends TestCase
{
    // ---- normalizarEntrada ----

    public function testUsaChavePlaylistsQuandoPresente(): void
    {
        $data = ['playlists' => [['nome' => 'A', 'itens' => []]]];
        self::assertSame($data['playlists'], PlaylistFormValidator::normalizarEntrada($data));
    }

    public function testConverteMapaLegadoParaListaDePlaylists(): void
    {
        $data = ['Louvor' => [1, 2], 'Ceia' => [3]];
        self::assertSame([
            ['nome' => 'Louvor', 'itens' => [1, 2]],
            ['nome' => 'Ceia', 'itens' => [3]],
        ], PlaylistFormValidator::normalizarEntrada($data));
    }

    public function testIgnoraChavesLegadasComValorNaoArray(): void
    {
        $data = ['baseRevision' => 5, 'Louvor' => [1]];
        self::assertSame([['nome' => 'Louvor', 'itens' => [1]]], PlaylistFormValidator::normalizarEntrada($data));
    }

    public function testRetornaNullQuandoEntradaNaoEhArray(): void
    {
        self::assertNull(PlaylistFormValidator::normalizarEntrada('string'));
        self::assertNull(PlaylistFormValidator::normalizarEntrada(null));
    }

    // ---- isNomeEItensValidos ----

    public function testInvalidoQuandoNomeVazio(): void
    {
        self::assertFalse(PlaylistFormValidator::isNomeEItensValidos('', []));
    }

    public function testInvalidoQuandoNomeMuitoLongo(): void
    {
        self::assertFalse(PlaylistFormValidator::isNomeEItensValidos(str_repeat('a', 201), []));
    }

    public function testInvalidoQuandoItensNaoEhArray(): void
    {
        self::assertFalse(PlaylistFormValidator::isNomeEItensValidos('Louvor', null));
    }

    public function testValidoComNomeEItensCorretos(): void
    {
        self::assertTrue(PlaylistFormValidator::isNomeEItensValidos('Louvor', [1, 2]));
    }

    // ---- isVisivelAteValido ----

    public function testVisivelAteVazioEhValido(): void
    {
        self::assertTrue(PlaylistFormValidator::isVisivelAteValido(''));
    }

    public function testVisivelAteComFormatoCorretoEhValido(): void
    {
        self::assertTrue(PlaylistFormValidator::isVisivelAteValido('2030-12-31'));
    }

    public function testVisivelAteComDataInexistenteEhInvalido(): void
    {
        self::assertFalse(PlaylistFormValidator::isVisivelAteValido('2030-02-30'));
    }

    public function testVisivelAteComFormatoErradoEhInvalido(): void
    {
        self::assertFalse(PlaylistFormValidator::isVisivelAteValido('31/12/2030'));
    }

    // ---- validarItem ----

    public function testValidarItemAceitaIdSimples(): void
    {
        self::assertSame(5, PlaylistFormValidator::validarItem('5'));
        self::assertSame(5, PlaylistFormValidator::validarItem(5));
    }

    public function testValidarItemAceitaObjetoComTomValido(): void
    {
        self::assertSame(5, PlaylistFormValidator::validarItem(['id' => 5, 'tom' => 'C#m']));
    }

    public function testValidarItemRejeitaIdNaoNumericoOuNaoPositivo(): void
    {
        self::assertNull(PlaylistFormValidator::validarItem('abc'));
        self::assertNull(PlaylistFormValidator::validarItem(0));
        self::assertNull(PlaylistFormValidator::validarItem(-1));
    }

    public function testValidarItemRejeitaTomInvalido(): void
    {
        self::assertNull(PlaylistFormValidator::validarItem(['id' => 5, 'tom' => 'H']));
    }

    // ---- computeMaxPlaylists ----

    public function testMasterSempreIlimitado(): void
    {
        self::assertSame(-1, PlaylistFormValidator::computeMaxPlaylists(true, ['playlists' => 1]));
    }

    public function testNaoMasterUsaLimiteDoPlano(): void
    {
        self::assertSame(3, PlaylistFormValidator::computeMaxPlaylists(false, ['playlists' => 3]));
    }

    // ---- excedeLimite ----

    public function testNaoExcedeQuandoIlimitado(): void
    {
        self::assertFalse(PlaylistFormValidator::excedeLimite(-1, 999));
    }

    public function testExcedeQuandoAcimaDoLimite(): void
    {
        self::assertTrue(PlaylistFormValidator::excedeLimite(2, 3));
    }

    public function testNaoExcedeNoLimiteExato(): void
    {
        self::assertFalse(PlaylistFormValidator::excedeLimite(2, 2));
    }

    // ---- planoLabel ----

    public function testPlanoLabelMapeaConhecidos(): void
    {
        self::assertSame('Gratuito', PlaylistFormValidator::planoLabel('gratuito'));
        self::assertSame('Básico', PlaylistFormValidator::planoLabel('basico'));
        self::assertSame('atual', PlaylistFormValidator::planoLabel('mensal'));
    }
}
