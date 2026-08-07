<?php
/**
 * IntegrationStripeTest — valida que StripeCheckoutHelper consegue criar sessões
 * de checkout reais via a API do Stripe (usando sk_test_...).
 *
 * Execução: phpunit --group integration
 * Não faz parte da suíte padrão.
 *
 * @group integration
 */
class IntegrationStripeTest extends \PHPUnit\Framework\TestCase
{
    private string $secretKey;
    private array  $priceMap;

    protected function setUp(): void
    {
        $key = env('STRIPE_SECRET_KEY', '');
        if (!str_starts_with($key, 'sk_test_')) {
            self::markTestSkipped('STRIPE_SECRET_KEY deve ser uma chave de teste (sk_test_...).');
        }
        $mensal    = env('STRIPE_PRICE_MENSAL', '');
        $semestral = env('STRIPE_PRICE_SEMESTRAL', '');
        $anual     = env('STRIPE_PRICE_ANUAL', '');
        if (!$mensal || !$semestral || !$anual) {
            self::markTestSkipped('STRIPE_PRICE_MENSAL / SEMESTRAL / ANUAL não configurados.');
        }
        $this->secretKey = $key;
        $this->priceMap  = ['mensal' => $mensal, 'semestral' => $semestral, 'anual' => $anual];
    }

    /** @dataProvider planos */
    public function testCriaCheckoutSessionParaPlano(string $plano): void
    {
        $priceId = StripeCheckoutHelper::priceIdForPlan($plano, $this->priceMap);
        $payload = StripeCheckoutHelper::buildPayload(
            priceId:       $priceId,
            bandaId:       'integracao-banda-teste',
            priceIdMeta:   $priceId,
            customerEmail: 'integracao@cifro.online',
            successUrl:    'http://localhost:8090/plano.php?checkout=success&session_id={CHECKOUT_SESSION_ID}',
            cancelUrl:     'http://localhost:8090/plano.php?checkout=cancel',
        );

        $result = StripeCheckoutHelper::callStripeApi($this->secretKey, $payload);

        self::assertTrue($result['ok'], 'Stripe retornou erro: ' . ($result['error'] ?? 'desconhecido'));
        self::assertStringStartsWith(
            'https://checkout.stripe.com/',
            $result['url'],
            'URL de checkout não veio do Stripe.'
        );
    }

    /** @return array<string, array{string}> */
    public static function planos(): array
    {
        return [
            'mensal'    => ['mensal'],
            'semestral' => ['semestral'],
            'anual'     => ['anual'],
        ];
    }

    public function testPlanoInvalidoLancaExcecao(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        StripeCheckoutHelper::priceIdForPlan('invalido', $this->priceMap);
    }
}
