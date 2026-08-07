<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/Services/SubscriptionCancellationService.php';

final class SubscriptionCancellationServiceTest extends TestCase
{
    // ---- avaliar: quem pode cancelar ----

    public function testBandaNoPlanoGratuitoNaoTemAssinaturaParaCancelar(): void
    {
        $resultado = SubscriptionCancellationService::avaliar('gratuito', null, null);
        self::assertFalse($resultado['ok']);
        self::assertSame('sem_assinatura_ativa', $resultado['code']);
        self::assertSame(409, $resultado['status']);
    }

    public function testBandaBloqueadaNaoTemAssinaturaParaCancelar(): void
    {
        $resultado = SubscriptionCancellationService::avaliar('bloqueado', 'sub_123', null);
        self::assertFalse($resultado['ok']);
        self::assertSame('sem_assinatura_ativa', $resultado['code']);
    }

    /** @dataProvider planosPagos */
    public function testPlanoPagoComAssinaturaPodeCancelar(string $plano): void
    {
        $resultado = SubscriptionCancellationService::avaliar($plano, 'sub_ABC123', null);
        self::assertTrue($resultado['ok']);
        self::assertSame('pode_cancelar', $resultado['code']);
    }

    public static function planosPagos(): array
    {
        return [['mensal'], ['semestral'], ['anual'], ['ativo']];
    }

    public function testPedirCancelamentoDuasVezesNaoEhErro(): void
    {
        $resultado = SubscriptionCancellationService::avaliar('mensal', 'sub_ABC123', '2026-08-07 22:10:00');
        self::assertFalse($resultado['ok']);
        self::assertSame('ja_cancelado', $resultado['code']);
        // 200: o usuário já obteve o que queria, não é falha
        self::assertSame(200, $resultado['status']);
    }

    public function testPlanoPagoViaPixNaoTemRecorrenciaParaCancelar(): void
    {
        $resultado = SubscriptionCancellationService::avaliar('anual', '', null);
        self::assertFalse($resultado['ok']);
        self::assertSame('sem_recorrencia', $resultado['code']);
        self::assertSame(200, $resultado['status']);
        self::assertStringContainsString('não será renovado', $resultado['message']);
    }

    public function testAssinaturaNulaEhTratadaComoSemRecorrencia(): void
    {
        $resultado = SubscriptionCancellationService::avaliar('mensal', null, null);
        self::assertSame('sem_recorrencia', $resultado['code']);
    }

    // ---- segurança: identificador de assinatura ----

    public function testAceitaIdentificadorDeAssinaturaDoStripe(): void
    {
        self::assertTrue(SubscriptionCancellationService::subscriptionIdValido('sub_1PabcXYZ09'));
    }

    /** @dataProvider identificadoresPerigosos */
    public function testRecusaIdentificadorQueEscapaDaUrl(string $malicioso): void
    {
        self::assertFalse(SubscriptionCancellationService::subscriptionIdValido($malicioso));
    }

    public static function identificadoresPerigosos(): array
    {
        return [
            'travessia de caminho'   => ['sub_123/../../customers/cus_1'],
            'barra simples'          => ['sub_123/refunds'],
            'query string'           => ['sub_123?expand=customer'],
            'prefixo errado'         => ['cus_123'],
            'vazio'                  => [''],
            'espaço'                 => ['sub_1 23'],
            'nova linha'             => ["sub_123\n"],
            'caractere percentual'   => ['sub_%2e%2e'],
        ];
    }

    public function testChamadaAoStripeRecusaIdentificadorInvalidoAntesDeSairDaMaquina(): void
    {
        $chamou = false;
        $curl = function () use (&$chamou) {
            $chamou = true;
            return ['body' => '{}', 'status' => 200];
        };

        $resultado = SubscriptionCancellationService::callStripeCancel(
            'sk_test_x',
            'sub_123/../customers',
            ['cancel_at_period_end' => 'true'],
            $curl,
        );

        self::assertFalse($resultado['ok']);
        self::assertFalse($chamou, 'Nenhuma requisição pode sair com identificador inválido.');
    }

    // ---- payload ----

    public function testPayloadAgendaCancelamentoParaOFimDoPeriodo(): void
    {
        // Cancelar imediatamente cortaria acesso já pago — nunca é o que queremos.
        self::assertSame(['cancel_at_period_end' => 'true'], SubscriptionCancellationService::buildCancelPayload());
    }

    // ---- resposta do Stripe ----

    public function testCancelamentoConfirmadoRetornaFimDoPeriodo(): void
    {
        $curl = fn () => ['status' => 200, 'body' => json_encode([
            'id' => 'sub_1', 'cancel_at_period_end' => true, 'current_period_end' => 1789000000,
        ])];

        $resultado = SubscriptionCancellationService::callStripeCancel('sk_test_x', 'sub_1', [], $curl);

        self::assertTrue($resultado['ok']);
        self::assertSame(1789000000, $resultado['periodEnd']);
    }

    public function testStripeQueNaoConfirmaOAgendamentoEhTratadoComoFalha(): void
    {
        $curl = fn () => ['status' => 200, 'body' => json_encode([
            'id' => 'sub_1', 'cancel_at_period_end' => false,
        ])];

        $resultado = SubscriptionCancellationService::callStripeCancel('sk_test_x', 'sub_1', [], $curl);

        self::assertFalse($resultado['ok']);
        self::assertStringContainsString('não confirmou', $resultado['error']);
    }

    public function testErroDoStripeVemComAMensagemDaApi(): void
    {
        $curl = fn () => ['status' => 404, 'body' => json_encode([
            'error' => ['message' => 'No such subscription'],
        ])];

        $resultado = SubscriptionCancellationService::callStripeCancel('sk_test_x', 'sub_1', [], $curl);

        self::assertFalse($resultado['ok']);
        self::assertSame('No such subscription', $resultado['error']);
    }

    public function testRespostaQueNaoEhJsonNaoQuebraOFluxo(): void
    {
        $curl = fn () => ['status' => 502, 'body' => '<html>Bad Gateway</html>'];

        $resultado = SubscriptionCancellationService::callStripeCancel('sk_test_x', 'sub_1', [], $curl);

        self::assertFalse($resultado['ok']);
        self::assertStringContainsString('inválida', $resultado['error']);
    }

    public function testRedeIndisponivelRetornaFalhaEmVezDeExcecao(): void
    {
        $curl = fn () => ['status' => 0, 'body' => ''];

        $resultado = SubscriptionCancellationService::callStripeCancel('sk_test_x', 'sub_1', [], $curl);

        self::assertFalse($resultado['ok']);
    }

    // ---- mensagem ao usuário ----

    public function testMensagemInformaADataEmQueOAcessoTermina(): void
    {
        $mensagem = SubscriptionCancellationService::mensagemConfirmacao(1789000000);
        self::assertStringContainsString(date('d/m/Y', 1789000000), $mensagem);
        self::assertStringContainsString('Nenhuma nova cobrança', $mensagem);
    }

    public function testMensagemSemDataAindaGaranteQueNaoHaveraNovaCobranca(): void
    {
        $mensagem = SubscriptionCancellationService::mensagemConfirmacao(0);
        self::assertStringContainsString('fim do período já pago', $mensagem);
        self::assertStringContainsString('Nenhuma nova cobrança', $mensagem);
    }
}
