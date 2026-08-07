<?php

use PHPUnit\Framework\TestCase;

final class StripeCheckoutHelperTest extends TestCase
{
    // ── priceIdForPlan ──────────────────────────────────────────────────────

    public function testPriceIdParaPlanosValidos(): void
    {
        $map = [
            'mensal'    => 'price_m',
            'semestral' => 'price_s',
            'anual'     => 'price_a',
        ];
        self::assertSame('price_m', StripeCheckoutHelper::priceIdForPlan('mensal', $map));
        self::assertSame('price_s', StripeCheckoutHelper::priceIdForPlan('semestral', $map));
        self::assertSame('price_a', StripeCheckoutHelper::priceIdForPlan('anual', $map));
    }

    public function testPriceIdLancaExcecaoParaPlanoInvalido(): void
    {
        $this->expectException(InvalidArgumentException::class);
        StripeCheckoutHelper::priceIdForPlan('gratis', ['mensal' => 'price_m']);
    }

    // ── buildPayload ────────────────────────────────────────────────────────

    public function testBuildPayloadContemCamposObrigatorios(): void
    {
        $payload = StripeCheckoutHelper::buildPayload(
            priceId: 'price_m',
            bandaId: 'banda-uuid-123',
            priceIdMeta: 'price_m',
            customerEmail: 'user@example.com',
            successUrl: 'https://example.com/plano.php?checkout=success&session_id={CHECKOUT_SESSION_ID}',
            cancelUrl: 'https://example.com/plano.php?checkout=cancel',
        );

        self::assertSame('subscription', $payload['mode']);
        self::assertSame('price_m', $payload['line_items[0][price]']);
        self::assertSame('1', $payload['line_items[0][quantity]']);
        self::assertSame('banda-uuid-123', $payload['metadata[banda_id]']);
        self::assertSame('price_m', $payload['metadata[price_id]']);
        self::assertSame('user@example.com', $payload['customer_email']);
        self::assertStringContainsString('{CHECKOUT_SESSION_ID}', $payload['success_url']);
        self::assertStringContainsString('checkout=cancel', $payload['cancel_url']);
    }

    // ── callStripeApi ───────────────────────────────────────────────────────

    public function testCallStripeApiRetornaUrlEmSucesso(): void
    {
        $fakeResponse = json_encode(['url' => 'https://checkout.stripe.com/pay/cs_test_abc']);
        $curlFn = fn($payload, $secret) => ['body' => $fakeResponse, 'status' => 200];

        $result = StripeCheckoutHelper::callStripeApi('sk_test_key', ['mode' => 'subscription'], $curlFn);

        self::assertTrue($result['ok']);
        self::assertSame('https://checkout.stripe.com/pay/cs_test_abc', $result['url']);
    }

    public function testCallStripeApiRetornaErroQuandoStripeRetorna4xx(): void
    {
        $fakeResponse = json_encode(['error' => ['message' => 'No such price']]);
        $curlFn = fn($payload, $secret) => ['body' => $fakeResponse, 'status' => 400];

        $result = StripeCheckoutHelper::callStripeApi('sk_test_key', ['mode' => 'subscription'], $curlFn);

        self::assertFalse($result['ok']);
        self::assertArrayHasKey('error', $result);
    }

    public function testCallStripeApiRetornaErroQuandoRespostaInvalida(): void
    {
        $curlFn = fn($payload, $secret) => ['body' => 'not-json', 'status' => 200];

        $result = StripeCheckoutHelper::callStripeApi('sk_test_key', [], $curlFn);

        self::assertFalse($result['ok']);
    }

    public function testCallStripeApiRetornaErroQuandoUrlAusenteNaResposta(): void
    {
        $fakeResponse = json_encode(['id' => 'cs_test_abc123']);
        $curlFn = fn($payload, $secret) => ['body' => $fakeResponse, 'status' => 200];

        $result = StripeCheckoutHelper::callStripeApi('sk_test_key', [], $curlFn);

        self::assertFalse($result['ok']);
        self::assertStringContainsString('URL de checkout ausente', $result['error']);
    }
}
