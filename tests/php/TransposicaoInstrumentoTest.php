<?php
use PHPUnit\Framework\TestCase;

final class TransposicaoInstrumentoTest extends TestCase
{
    public function testAceitaDeslocamentoDentroDaFaixaDeUmaOitava(): void
    {
        $this->assertSame(0, TransposicaoInstrumento::normalizar(0));
        $this->assertSame(2, TransposicaoInstrumento::normalizar(2));
        $this->assertSame(-6, TransposicaoInstrumento::normalizar(-6));
        $this->assertSame(12, TransposicaoInstrumento::normalizar(12));
        $this->assertSame(-12, TransposicaoInstrumento::normalizar(-12));
    }

    public function testAceitaDeslocamentoEnviadoComoTexto(): void
    {
        $this->assertSame(3, TransposicaoInstrumento::normalizar('3'));
        $this->assertSame(-3, TransposicaoInstrumento::normalizar('-3'));
    }

    public function testRecusaDeslocamentoForaDaFaixa(): void
    {
        $this->assertNull(TransposicaoInstrumento::normalizar(13));
        $this->assertNull(TransposicaoInstrumento::normalizar(-13));
    }

    public function testRecusaValorQueNaoEhNumeroInteiro(): void
    {
        $this->assertNull(TransposicaoInstrumento::normalizar('dois'));
        $this->assertNull(TransposicaoInstrumento::normalizar(1.5));
        $this->assertNull(TransposicaoInstrumento::normalizar(true));
        $this->assertNull(TransposicaoInstrumento::normalizar([]));
    }

    public function testCampoVazioValeComoSemDeslocamento(): void
    {
        $this->assertSame(0, TransposicaoInstrumento::normalizar(''));
        $this->assertSame(0, TransposicaoInstrumento::normalizar(null));
    }

    public function testReconheceOsInstrumentosSuportados(): void
    {
        $this->assertTrue(TransposicaoInstrumento::instrumentoValido('violao'));
        $this->assertTrue(TransposicaoInstrumento::instrumentoValido('teclado'));
        $this->assertTrue(TransposicaoInstrumento::instrumentoValido('outro'));
        $this->assertFalse(TransposicaoInstrumento::instrumentoValido('gaita'));
    }

    public function testEntendeACasaDoCapotrasteEscritaDeVariasFormas(): void
    {
        $this->assertSame(2, TransposicaoInstrumento::casaDeCapo('2'));
        $this->assertSame(2, TransposicaoInstrumento::casaDeCapo('2ª casa'));
        $this->assertSame(2, TransposicaoInstrumento::casaDeCapo('2a casa'));
        $this->assertSame(2, TransposicaoInstrumento::casaDeCapo('Capotraste na 2ª casa'));
        $this->assertSame(2, TransposicaoInstrumento::casaDeCapo('capo 2'));
        $this->assertSame(10, TransposicaoInstrumento::casaDeCapo('Capotraste na 10ª casa'));
    }

    public function testNaoEnxergaCapotrasteQuandoNaoHa(): void
    {
        $this->assertNull(TransposicaoInstrumento::casaDeCapo(''));
        $this->assertNull(TransposicaoInstrumento::casaDeCapo('sem capotraste'));
        $this->assertNull(TransposicaoInstrumento::casaDeCapo('Tom: C'));
        $this->assertNull(TransposicaoInstrumento::casaDeCapo('0'));
    }

    public function testRecusaCasaAlemDoBracoDoInstrumento(): void
    {
        $this->assertNull(TransposicaoInstrumento::casaDeCapo('13ª casa'));
        $this->assertNull(TransposicaoInstrumento::casaDeCapo('-2'));
    }

    public function testCadaInstrumentoTemSeuRotulo(): void
    {
        $this->assertSame('Capotraste', TransposicaoInstrumento::rotulo('violao'));
        $this->assertSame('Transpose', TransposicaoInstrumento::rotulo('teclado'));
        $this->assertSame('Transposição', TransposicaoInstrumento::rotulo('outro'));
        $this->assertSame('Transposição', TransposicaoInstrumento::rotulo('gaita'));
    }
}
