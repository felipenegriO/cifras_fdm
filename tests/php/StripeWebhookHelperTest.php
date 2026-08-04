<?php

use PHPUnit\Framework\TestCase;

final class StripeWebhookHelperTest extends TestCase
{
    private array $map = [
        'price_mensal_id' => 'mensal',
        'price_semestral_id' => 'semestral',
        'price_anual_id' => 'anual',
    ];

    // ---- resolverPlanoByPrice ----

    public function testRetornaMensalQuandoPriceIdNulo(): void
    {
        self::assertSame('mensal', StripeWebhookHelper::resolverPlanoByPrice(null, $this->map));
    }

    public function testMapeiaPriceIdConhecido(): void
    {
        self::assertSame('semestral', StripeWebhookHelper::resolverPlanoByPrice('price_semestral_id', $this->map));
    }

    public function testRetornaMensalQuandoPriceIdDesconhecido(): void
    {
        self::assertSame('mensal', StripeWebhookHelper::resolverPlanoByPrice('price_outro', $this->map));
    }

    // ---- validateStripeSignature ----

    private function sign(string $payload, string $secret, int $timestamp): string
    {
        return hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
    }

    public function testAssinaturaValida(): void
    {
        $secret = 'whsec_test';
        $payload = '{"type":"checkout.session.completed"}';
        $now = 1_800_000_000;
        $sig = $this->sign($payload, $secret, $now);
        $header = "t={$now},v1={$sig}";

        self::assertTrue(StripeWebhookHelper::validateStripeSignature($payload, $header, $secret, $now));
    }

    public function testAssinaturaInvalidaComSecretErrado(): void
    {
        $payload = '{"type":"x"}';
        $now = 1_800_000_000;
        $sig = $this->sign($payload, 'secret_certo', $now);
        $header = "t={$now},v1={$sig}";

        self::assertFalse(StripeWebhookHelper::validateStripeSignature($payload, $header, 'secret_errado', $now));
    }

    public function testRejeitaTimestampMuitoAntigo(): void
    {
        $secret = 'whsec_test';
        $payload = '{}';
        $timestamp = 1_800_000_000;
        $now = $timestamp + 301;
        $sig = $this->sign($payload, $secret, $timestamp);
        $header = "t={$timestamp},v1={$sig}";

        self::assertFalse(StripeWebhookHelper::validateStripeSignature($payload, $header, $secret, $now));
    }

    public function testAceitaTimestampNoLimiteDe300Segundos(): void
    {
        $secret = 'whsec_test';
        $payload = '{}';
        $timestamp = 1_800_000_000;
        $now = $timestamp + 300;
        $sig = $this->sign($payload, $secret, $timestamp);
        $header = "t={$timestamp},v1={$sig}";

        self::assertTrue(StripeWebhookHelper::validateStripeSignature($payload, $header, $secret, $now));
    }

    public function testRejeitaHeaderSemCamposObrigatorios(): void
    {
        self::assertFalse(StripeWebhookHelper::validateStripeSignature('{}', 't=123', 'secret'));
        self::assertFalse(StripeWebhookHelper::validateStripeSignature('{}', 'v1=abc', 'secret'));
        self::assertFalse(StripeWebhookHelper::validateStripeSignature('{}', '', 'secret'));
    }

    public function testResourceIdPriorizaAssinatura(): void
    {
        self::assertSame('sub_123', StripeWebhookHelper::resourceId('evt_1', ['id' => 'in_1', 'subscription' => 'sub_123', 'customer' => 'cus_1']));
        self::assertSame('sub_456', StripeWebhookHelper::resourceId('evt_2', ['subscription' => ['id' => 'sub_456']]));
    }

    public function testResourceIdUsaObjetoClienteOuEventoComoFallback(): void
    {
        self::assertSame('sub_obj', StripeWebhookHelper::resourceId('evt_3', ['id' => 'sub_obj']));
        self::assertSame('cus_1', StripeWebhookHelper::resourceId('evt_4', ['customer' => 'cus_1']));
        self::assertSame('event:evt_5', StripeWebhookHelper::resourceId('evt_5', []));
    }
}
