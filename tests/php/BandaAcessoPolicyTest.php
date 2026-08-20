<?php

use PHPUnit\Framework\TestCase;

/**
 * Regras de quem pode entrar numa banda. Separadas do HTTP e do banco para
 * poderem ser exercitadas aqui, sem browser: é a mesma decisão usada tanto na
 * revalidação a cada requisição quanto na pintura da lista de bandas.
 */
final class BandaAcessoPolicyTest extends TestCase
{
    private function banda(array $sobrescreve = []): array
    {
        return array_merge(['id' => 'b1', 'nome' => 'Banda', 'ativo' => 1, 'plano' => 'gratuito'], $sobrescreve);
    }

    public function testMembroDeBandaAtivaTemAcesso(): void
    {
        self::assertNull(BandaAcessoPolicy::motivoParaBloquear($this->banda(), 'basico'));
    }

    public function testMusicoRemovidoDoVinculoPerdeAcesso(): void
    {
        self::assertSame(
            BandaAcessoPolicy::REMOVIDO,
            BandaAcessoPolicy::motivoParaBloquear($this->banda(), null)
        );
    }

    public function testBandaInexistentePerdeAcesso(): void
    {
        self::assertSame(
            BandaAcessoPolicy::REMOVIDO,
            BandaAcessoPolicy::motivoParaBloquear(null, 'administrador')
        );
    }

    public function testBandaDesativadaBloqueiaAteQuemEhMembro(): void
    {
        self::assertSame(
            BandaAcessoPolicy::DESATIVADA,
            BandaAcessoPolicy::motivoParaBloquear($this->banda(['ativo' => 0]), 'administrador')
        );
    }

    public function testPlanoBloqueadoBloqueiaAcesso(): void
    {
        self::assertSame(
            BandaAcessoPolicy::PLANO_BLOQUEADO,
            BandaAcessoPolicy::motivoParaBloquear($this->banda(['plano' => 'bloqueado']), 'gestor')
        );
    }

    public function testBandaDesativadaTemPrecedenciaSobrePlano(): void
    {
        // A mensagem mostrada ao músico deve ser a causa mais forte.
        self::assertSame(
            BandaAcessoPolicy::DESATIVADA,
            BandaAcessoPolicy::motivoParaBloquear($this->banda(['ativo' => 0, 'plano' => 'bloqueado']), 'gestor')
        );
    }

    public function testPlanoGratuitoNaoBloqueia(): void
    {
        // Gratuito é um plano válido: limita recursos, não o acesso.
        self::assertNull(BandaAcessoPolicy::motivoParaBloquear($this->banda(['plano' => 'gratuito']), 'basico'));
    }

    // ---- abrir a banda mesmo bloqueada ----

    public function testPlanoBloqueadoNaoImpedeAbrirABanda(): void
    {
        // Se impedisse, o administrador não teria caminho até o pagamento.
        self::assertFalse(BandaAcessoPolicy::impedeAbrir(BandaAcessoPolicy::PLANO_BLOQUEADO));
    }

    public function testBandaRemovidaOuDesativadaNaoAbre(): void
    {
        self::assertTrue(BandaAcessoPolicy::impedeAbrir(BandaAcessoPolicy::REMOVIDO));
        self::assertTrue(BandaAcessoPolicy::impedeAbrir(BandaAcessoPolicy::DESATIVADA));
    }

    public function testBandaSemMotivoDeBloqueioAbreNormalmente(): void
    {
        self::assertFalse(BandaAcessoPolicy::impedeAbrir(null));
    }

    // ---- rótulos ----

    public function testCadaMotivoTemRotuloParaOMusico(): void
    {
        foreach ([BandaAcessoPolicy::REMOVIDO, BandaAcessoPolicy::DESATIVADA, BandaAcessoPolicy::PLANO_BLOQUEADO] as $motivo) {
            self::assertNotSame('', BandaAcessoPolicy::rotulo($motivo));
        }
    }

    public function testMotivoDesconhecidoNaoQuebraORotulo(): void
    {
        self::assertNotSame('', BandaAcessoPolicy::rotulo('coisa_que_nao_existe'));
    }
}
