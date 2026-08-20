<?php

use PHPUnit\Framework\TestCase;

final class BandaConvitePolicyTest extends TestCase
{
    private function convite(array $sobrescreve = []): array
    {
        return array_merge([
            'token' => str_repeat('a', 64),
            'banda_id' => 'banda-1',
            'expira_em' => date('Y-m-d H:i:s', time() + 3600),
            'revogado_em' => null,
            'usos' => 0,
        ], $sobrescreve);
    }

    public function testConviteDentroDoPrazoEhValido(): void
    {
        self::assertTrue(BandaConvitePolicy::estaValido($this->convite()));
    }

    public function testConviteRevogadoNaoVale(): void
    {
        self::assertFalse(BandaConvitePolicy::estaValido($this->convite(['revogado_em' => date('Y-m-d H:i:s')])));
    }

    public function testConviteExpiradoNaoVale(): void
    {
        self::assertFalse(BandaConvitePolicy::estaValido($this->convite(['expira_em' => date('Y-m-d H:i:s', time() - 1)])));
    }

    public function testConviteInexistenteNaoVale(): void
    {
        self::assertFalse(BandaConvitePolicy::estaValido(null));
    }

    public function testDataDeExpiracaoIlegivelNaoVale(): void
    {
        self::assertFalse(BandaConvitePolicy::estaValido($this->convite(['expira_em' => ''])));
        self::assertFalse(BandaConvitePolicy::estaValido($this->convite(['expira_em' => 'ontem à noite'])));
    }

    public function testFronteiraDasVinteEQuatroHoras(): void
    {
        $agora = 1700000000;
        $expira = BandaConvitePolicy::expiraEm($agora);

        self::assertSame(date('Y-m-d H:i:s', $agora + 86400), $expira);
        self::assertTrue(BandaConvitePolicy::estaValido(['expira_em' => $expira, 'revogado_em' => null], $agora + 86399));
        self::assertFalse(BandaConvitePolicy::estaValido(['expira_em' => $expira, 'revogado_em' => null], $agora + 86400));
    }

    public function testRotuloDeValidadeEhLegivelParaOAdministrador(): void
    {
        self::assertSame('17/08 às 19h32', BandaConvitePolicy::rotuloValidade('2026-08-17 19:32:00'));
        self::assertSame('', BandaConvitePolicy::rotuloValidade('data inválida'));
    }

    public function testQuemEntraPeloLinkRecebeSempreOPerfilBasico(): void
    {
        self::assertSame('basico', BandaConvitePolicy::PERFIL);
    }
}
