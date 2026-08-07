<?php

class StripeCheckoutHelper
{
    private const VALID_PLANS = ['mensal', 'semestral', 'anual'];

    public static function priceIdForPlan(string $plan, array $priceMap): string
    {
        if (!in_array($plan, self::VALID_PLANS, true)) {
            throw new InvalidArgumentException("Plano inválido: {$plan}");
        }
        return $priceMap[$plan] ?? '';
    }

    public static function buildPayload(
        string $priceId,
        string $bandaId,
        string $priceIdMeta,
        string $customerEmail,
        string $successUrl,
        string $cancelUrl,
    ): array {
        return [
            'mode'                     => 'subscription',
            'line_items[0][price]'     => $priceId,
            'line_items[0][quantity]'  => '1',
            'success_url'              => $successUrl,
            'cancel_url'               => $cancelUrl,
            'customer_email'           => $customerEmail,
            'metadata[banda_id]'       => $bandaId,
            'metadata[price_id]'       => $priceIdMeta,
        ];
    }

    /**
     * @param callable|null $curlFn fn(array $payload, string $secret): array{body: string, status: int}
     */
    public static function callStripeApi(string $secretKey, array $payload, ?callable $curlFn = null): array
    {
        $curlFn = $curlFn ?? [self::class, 'defaultCurlCall'];

        $result = $curlFn($payload, $secretKey);
        $status = (int)($result['status'] ?? 0);
        $body   = (string)($result['body'] ?? '');

        $data = json_decode($body, true);
        if (!is_array($data)) {
            return ['ok' => false, 'error' => 'Resposta inválida da API do Stripe.'];
        }
        if ($status < 200 || $status >= 300) {
            return ['ok' => false, 'error' => $data['error']['message'] ?? 'Erro ao criar sessão de pagamento.'];
        }
        if (empty($data['url'])) {
            return ['ok' => false, 'error' => 'URL de checkout ausente na resposta do Stripe.'];
        }
        return ['ok' => true, 'url' => $data['url']];
    }

    /** @codeCoverageIgnore — real cURL call; tested via injectable $curlFn parameter in callStripeApi */
    private static function defaultCurlCall(array $payload, string $secretKey): array
    {
        $ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($payload),
            CURLOPT_USERPWD        => $secretKey . ':',
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT        => 15,
        ]);
        $body   = (string)curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['body' => $body, 'status' => $status];
    }
}
