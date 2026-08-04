<?php

use PHPUnit\Framework\TestCase;

final class BandaSelectionHelperTest extends TestCase
{
    // ---- isBandaJaNaLista ----

    public function testTrueQuandoBandaJaEstaNaLista(): void
    {
        $bandas = [['id' => 'b1'], ['id' => 'b2']];
        self::assertTrue(BandaSelectionHelper::isBandaJaNaLista($bandas, 'b2'));
    }

    public function testFalseQuandoBandaNaoEstaNaLista(): void
    {
        $bandas = [['id' => 'b1']];
        self::assertFalse(BandaSelectionHelper::isBandaJaNaLista($bandas, 'b2'));
    }

    public function testFalseQuandoListaVazia(): void
    {
        self::assertFalse(BandaSelectionHelper::isBandaJaNaLista([], 'b1'));
    }

    // ---- buildBandaAtualSession ----

    public function testConstroiSessaoComTodosOsCampos(): void
    {
        $banda = ['id' => 'b1', 'nome' => 'Banda X', 'plano' => 'mensal', 'trial_expira_em' => '2026-01-01', 'logo' => '/logo.png'];
        $session = BandaSelectionHelper::buildBandaAtualSession($banda, 'gestor');

        self::assertSame([
            'id' => 'b1', 'nome' => 'Banda X', 'perfil' => 'gestor',
            'plano' => 'mensal', 'trial_expira_em' => '2026-01-01', 'logo' => '/logo.png',
        ], $session);
    }

    public function testUsaValoresPadraoQuandoCamposOpcionaisAusentes(): void
    {
        $banda = ['id' => 'b1', 'nome' => 'Banda X'];
        $session = BandaSelectionHelper::buildBandaAtualSession($banda, 'administrador');

        self::assertSame('ativo', $session['plano']);
        self::assertNull($session['trial_expira_em']);
        self::assertNull($session['logo']);
    }
}
