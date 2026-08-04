<?php
/**
 * StripeWebhookHelper — pure helpers for public/api/stripe/webhook.php.
 */
class StripeWebhookHelper
{
    public static function resourceId(string $eventId, array $object): string
    {
        $subscription = $object['subscription'] ?? null;
        if (is_array($subscription)) $subscription = $subscription['id'] ?? null;
        $candidate = $subscription ?: ($object['id'] ?? null) ?: ($object['customer'] ?? null);
        return trim((string)($candidate ?: 'event:' . $eventId));
    }

    /** Maps a Stripe price_id (from env config) to the internal plan name. */
    public static function resolverPlanoByPrice(?string $priceId, array $priceMap): string
    {
        if (!$priceId) {
            return 'mensal';
        }
        return $priceMap[$priceId] ?? 'mensal';
    }

    public static function validateStripeSignature(string $payload, string $sigHeader, string $secret, ?int $now = null): bool
    {
        $now = $now ?? time();
        $parts = [];
        foreach (explode(',', $sigHeader) as $part) {
            [$k, $v] = explode('=', $part, 2) + ['', ''];
            $parts[$k] = $v;
        }
        if (empty($parts['t']) || empty($parts['v1'])) {
            return false;
        }
        $timestamp = (int)$parts['t'];
        if (abs($now - $timestamp) > 300) {
            return false;
        }
        $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
        return hash_equals($expected, $parts['v1']);
    }
}
