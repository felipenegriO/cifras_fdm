<?php

use PHPUnit\Framework\TestCase;

final class BandaChecklistConfiguracaoTest extends TestCase
{
    /** Administrador: enxerga as três abas do checklist (membros, categorias, repertórios). */
    private function abasDoAdministrador(): array
    {
        return BandaAdminTabs::visiveis(true, true, true);
    }

    /** Gestor: edita conteúdo, mas não gerencia membros — não enxerga a aba Membros. */
    private function abasDoGestor(): array
    {
        return BandaAdminTabs::visiveis(false, false, true);
    }

    public function testBandaRecemCriadaTemOsTresPassosPendentesParaOAdministrador(): void
    {
        $passos = BandaChecklistConfiguracao::passos(1, 0, 0, $this->abasDoAdministrador());

        self::assertCount(3, $passos);
        foreach ($passos as $passo) self::assertFalse($passo['concluido']);
        self::assertSame(['membros', 'categorias', 'repertorios'], array_column($passos, 'id'));
        self::assertFalse(BandaChecklistConfiguracao::concluido(1, 0, 0, $this->abasDoAdministrador()));
    }

    public function testCriarCategoriaConcluiApenasOPassoDeCategorias(): void
    {
        $passos = array_column(
            BandaChecklistConfiguracao::passos(1, 2, 0, $this->abasDoAdministrador()),
            'concluido',
            'id'
        );

        self::assertTrue($passos['categorias']);
        self::assertFalse($passos['membros']);
        self::assertFalse($passos['repertorios']);
    }

    public function testBandaComMembroCategoriaERepertorioEstaConcluidaParaOAdministrador(): void
    {
        self::assertTrue(BandaChecklistConfiguracao::concluido(2, 1, 1, $this->abasDoAdministrador()));
    }

    public function testCadaPassoApontaParaSuaAba(): void
    {
        $abas = array_column(
            BandaChecklistConfiguracao::passos(1, 0, 0, $this->abasDoAdministrador()),
            'aba',
            'id'
        );

        self::assertSame(BandaAdminTabs::MEMBROS, $abas['membros']);
        self::assertSame(BandaAdminTabs::CATEGORIAS, $abas['categorias']);
        self::assertSame(BandaAdminTabs::REPERTORIOS, $abas['repertorios']);
    }

    public function testGestorNaoVeOPassoDeConvidarMusicosPorNaoEnxergarAAbaMembros(): void
    {
        $passos = BandaChecklistConfiguracao::passos(1, 0, 0, $this->abasDoGestor());

        self::assertSame(['categorias', 'repertorios'], array_column($passos, 'id'));
    }

    public function testAdministradorVeOsTresPassosPorEnxergarAsTresAbas(): void
    {
        $passos = BandaChecklistConfiguracao::passos(1, 0, 0, $this->abasDoAdministrador());

        self::assertCount(3, $passos);
        self::assertSame(['membros', 'categorias', 'repertorios'], array_column($passos, 'id'));
    }

    public function testGestorComCategoriaERepertorioProntosNaoTemChecklistMesmoComUmUnicoMembro(): void
    {
        // Convidar músicos não é passo do gestor (não enxerga a aba Membros), então
        // um único membro na banda não deve deixar o checklist pendente para ele.
        // concluido() === true é o que o controller usa para decidir renderizar []
        // em vez de chamar passos() — é essa decisão que o teste protege aqui.
        self::assertTrue(BandaChecklistConfiguracao::concluido(1, 1, 1, $this->abasDoGestor()));

        // Os passos que ele enxerga estão, de fato, todos concluídos.
        foreach (BandaChecklistConfiguracao::passos(1, 1, 1, $this->abasDoGestor()) as $passo) {
            self::assertTrue($passo['concluido']);
        }
    }
}
