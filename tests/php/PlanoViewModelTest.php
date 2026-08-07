<?php

use PHPUnit\Framework\TestCase;

final class PlanoViewModelTest extends TestCase
{
    // ---- normalizePhone ----

    public function testNormalizePhoneHandles550Prefix(): void
    {
        self::assertSame('5511987654321', PlanoViewModel::normalizePhone('550 11 98765-4321'));
    }

    public function testNormalizePhoneHandlesLeadingZeroWith12Digits(): void
    {
        self::assertSame('5511987654321', PlanoViewModel::normalizePhone('011987654321'));
    }

    public function testNormalizePhoneAddsCountryCodeFor10Or11Digits(): void
    {
        self::assertSame('5511987654321', PlanoViewModel::normalizePhone('11987654321'));
        self::assertSame('551133334444', PlanoViewModel::normalizePhone('1133334444'));
    }

    public function testNormalizePhoneLeavesAlreadyPrefixedNumberUnchanged(): void
    {
        self::assertSame('5511987654321', PlanoViewModel::normalizePhone('+55 11 98765-4321'));
    }

    public function testNormalizePhoneLeavesUnrecognizedLengthUnchanged(): void
    {
        self::assertSame('123', PlanoViewModel::normalizePhone('123'));
        self::assertSame('', PlanoViewModel::normalizePhone(''));
    }

    // ---- isStripeEnabled ----

    public function testStripeDisabledWhenSecretMissing(): void
    {
        self::assertFalse(PlanoViewModel::isStripeEnabled(''));
    }

    public function testStripeDisabledWhenSecretDoesNotStartWithSkPrefix(): void
    {
        self::assertFalse(PlanoViewModel::isStripeEnabled('pk_live_abc'));
    }

    public function testStripeDisabledWhenSecretIsPlaceholder(): void
    {
        self::assertFalse(PlanoViewModel::isStripeEnabled('sk_live_...'));
    }

    public function testStripeEnabledWhenSecretIsValid(): void
    {
        self::assertTrue(PlanoViewModel::isStripeEnabled('sk_live_abc'));
    }

    public function testStripeEnabledIgnoresWhitespace(): void
    {
        self::assertTrue(PlanoViewModel::isStripeEnabled('  sk_live_abc  '));
    }

    // ---- usageBar ----

    public function testUsageBarUnlimited(): void
    {
        self::assertSame(['pct' => 0, 'class' => 'unlimited'], PlanoViewModel::usageBar(5, -1));
    }

    public function testUsageBarZeroLimit(): void
    {
        self::assertSame(['pct' => 0, 'class' => 'ok'], PlanoViewModel::usageBar(0, 0));
    }

    public function testUsageBarOk(): void
    {
        self::assertSame(['pct' => 50, 'class' => 'ok'], PlanoViewModel::usageBar(5, 10));
    }

    public function testUsageBarWarn(): void
    {
        self::assertSame(['pct' => 80, 'class' => 'warn'], PlanoViewModel::usageBar(8, 10));
    }

    public function testUsageBarFullAtExactLimit(): void
    {
        self::assertSame(['pct' => 100, 'class' => 'full'], PlanoViewModel::usageBar(10, 10));
    }

    public function testUsageBarCapsAt100WhenOverLimit(): void
    {
        self::assertSame(['pct' => 100, 'class' => 'full'], PlanoViewModel::usageBar(50, 10));
    }

    // ---- simpleUsageBar ----

    public function testSimpleUsageBarUnlimited(): void
    {
        self::assertSame(['pct' => 0, 'class' => 'unlimited'], PlanoViewModel::simpleUsageBar(5, -1));
    }

    public function testSimpleUsageBarOkBelowLimit(): void
    {
        self::assertSame(['pct' => 50, 'class' => 'ok'], PlanoViewModel::simpleUsageBar(1, 2));
    }

    public function testSimpleUsageBarFullAtLimit(): void
    {
        self::assertSame(['pct' => 100, 'class' => 'full'], PlanoViewModel::simpleUsageBar(2, 2));
    }

    public function testSimpleUsageBarFullOverLimit(): void
    {
        self::assertSame(['pct' => 100, 'class' => 'full'], PlanoViewModel::simpleUsageBar(5, 2));
    }

    public function testSimpleUsageBarWithZeroLimitUsesMaxOne(): void
    {
        self::assertSame(['pct' => 100, 'class' => 'full'], PlanoViewModel::simpleUsageBar(1, 0));
    }

    // ---- badgeClass ----

    public function testBadgeClassPago(): void
    {
        self::assertSame('pago', PlanoViewModel::badgeClass(true, false));
    }

    public function testBadgeClassBloqueado(): void
    {
        self::assertSame('bloqueado', PlanoViewModel::badgeClass(false, true));
    }

    public function testBadgeClassGratuito(): void
    {
        self::assertSame('gratuito', PlanoViewModel::badgeClass(false, false));
    }

    // ---- paymentAction ----

    public function testPaymentActionAssinarWhenNotPago(): void
    {
        self::assertSame('assinar', PlanoViewModel::paymentAction(false, 'mensal', 'gratuito'));
    }

    public function testPaymentActionRenovarWhenSamePlan(): void
    {
        self::assertSame('renovar', PlanoViewModel::paymentAction(true, 'mensal', 'mensal'));
    }

    public function testPaymentActionTrocarParaWhenDifferentPlan(): void
    {
        self::assertSame('trocar para', PlanoViewModel::paymentAction(true, 'anual', 'mensal'));
    }

    // ---- URL builders ----

    public function testBuildWhatsappUrl(): void
    {
        $url = PlanoViewModel::buildWhatsappUrl('5511999999999', 'Olá & bem-vindo');
        self::assertSame('https://wa.me/5511999999999?text=' . rawurlencode('Olá & bem-vindo'), $url);
    }

    public function testBuildMailtoUrl(): void
    {
        $url = PlanoViewModel::buildMailtoUrl('Assunto', 'Corpo & teste');
        self::assertSame(
            'mailto:contato@cifro.online?subject=' . rawurlencode('Assunto') . '&body=' . rawurlencode('Corpo & teste'),
            $url
        );
    }

    // ---- isPixEnabled ----

    public function testPixEnabledWhenBothPhonesValid(): void
    {
        self::assertTrue(PlanoViewModel::isPixEnabled('5511999999999', '5511988888888'));
    }

    public function testPixDisabledWhenPixPhoneTooShort(): void
    {
        self::assertFalse(PlanoViewModel::isPixEnabled('123', '5511988888888'));
    }

    public function testPixDisabledWhenWhatsappPhoneTooShort(): void
    {
        self::assertFalse(PlanoViewModel::isPixEnabled('5511999999999', '123'));
    }

    // ---- cancelUrl ----

    public function testCancelUrlUsesWhatsappWhenPixEnabled(): void
    {
        $url = PlanoViewModel::cancelUrl(true, '5511999999999', 'msg');
        self::assertStringStartsWith('https://wa.me/5511999999999', $url);
    }

    public function testCancelUrlUsesMailtoWhenPixDisabled(): void
    {
        $url = PlanoViewModel::cancelUrl(false, '5511999999999', 'msg');
        self::assertStringStartsWith('mailto:contato@cifro.online', $url);
    }

    // ---- paymentReference ----

    public function testPaymentReferenceFromBandaId(): void
    {
        self::assertSame('ABCDEF12', PlanoViewModel::paymentReference('abcdef123456'));
    }

    public function testPaymentReferenceEmptyWhenNoBandaId(): void
    {
        self::assertSame('', PlanoViewModel::paymentReference(''));
    }
}
