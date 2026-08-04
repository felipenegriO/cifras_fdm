<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/config/env.php';
require_once __DIR__ . '/../../public/src/Services/ClosedBetaPolicy.php';

final class ClosedBetaPolicyTest extends TestCase
{
    public function testDisabledPolicyAllowsEveryBand(): void
    {
        $policy = new ClosedBetaPolicy(false, []);
        self::assertTrue($policy->allows('qualquer-banda'));
    }

    public function testEnabledPolicyAllowsOnlyInvitedBands(): void
    {
        $policy = new ClosedBetaPolicy(true, [' banda-a ', 'banda-b', 'banda-a']);
        self::assertTrue($policy->enabled());
        self::assertTrue($policy->allows('banda-a'));
        self::assertFalse($policy->allows('banda-c'));
        self::assertTrue($policy->allows(''));
    }

    public function testEnabledPolicyRejectsMoreThanFiveBands(): void
    {
        $this->expectException(RuntimeException::class);
        new ClosedBetaPolicy(true, ['1', '2', '3', '4', '5', '6']);
    }
}
