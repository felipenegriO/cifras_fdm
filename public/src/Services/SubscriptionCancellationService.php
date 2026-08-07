<?php

/**
 * Cancelamento self-service de assinatura.
 *
 * Regra de negócio: cancelar NUNCA corta o acesso na hora. A assinatura é
 * marcada no Stripe com `cancel_at_period_end=true`, o usuário continua com o
 * plano pago até o fim do período que ele já pagou, e o downgrade real para
 * gratuito acontece quando o Stripe dispara `customer.subscription.deleted`
 * (já tratado em api/stripe/webhook.php).
 *
 * Toda a lógica aqui é pura e injetável para permitir teste sem rede.
 */
class SubscriptionCancellationService
{
    /** Planos que representam assinatura paga cancelável. */
    public const PLANOS_PAGOS = ['mensal', 'semestral', 'anual', 'ativo'];

    /**
     * Decide se a banda pode pedir cancelamento agora.
     *
     * @return array{ok: bool, code: string, message: string, status: int}
     */
    public static function avaliar(string $plano, ?string $subscriptionId, ?string $canceladoEm): array
    {
        if (!in_array($plano, self::PLANOS_PAGOS, true)) {
            return [
                'ok'      => false,
                'code'    => 'sem_assinatura_ativa',
                'message' => 'Esta banda não tem assinatura paga para cancelar.',
                'status'  => 409,
            ];
        }

        // Idempotência: pedir de novo não é erro, apenas não faz nada.
        if ($canceladoEm !== null && trim($canceladoEm) !== '') {
            return [
                'ok'      => false,
                'code'    => 'ja_cancelado',
                'message' => 'O cancelamento desta assinatura já estava agendado.',
                'status'  => 200,
            ];
        }

        // Plano pago via Pix não gera assinatura recorrente no Stripe: não há o
        // que cancelar, o acesso simplesmente não renova ao fim do período.
        if ($subscriptionId === null || trim($subscriptionId) === '') {
            return [
                'ok'      => false,
                'code'    => 'sem_recorrencia',
                'message' => 'Este plano não tem cobrança recorrente. O acesso segue até o fim do período contratado e não será renovado.',
                'status'  => 200,
            ];
        }

        return ['ok' => true, 'code' => 'pode_cancelar', 'message' => '', 'status' => 200];
    }

    /**
     * Identificadores de assinatura do Stripe começam com "sub_". Recusar
     * qualquer outra coisa evita que um valor adulterado no banco vire caminho
     * de URL numa chamada à API.
     */
    public static function subscriptionIdValido(string $subscriptionId): bool
    {
        // \z e não $: em PHP, `$` casa também antes de um \n final, o que
        // deixaria passar "sub_123\n" e permitiria injeção de nova linha na URL.
        return (bool) preg_match('/\A sub_[A-Za-z0-9]+ \z/x', $subscriptionId);
    }

    /** Payload que agenda o cancelamento para o fim do período pago. */
    public static function buildCancelPayload(): array
    {
        return ['cancel_at_period_end' => 'true'];
    }

    /**
     * @param callable|null $curlFn fn(string $subId, array $payload, string $secret): array{body: string, status: int}
     * @return array{ok: bool, error?: string, periodEnd?: int}
     */
    public static function callStripeCancel(
        string $secretKey,
        string $subscriptionId,
        array $payload,
        ?callable $curlFn = null,
    ): array {
        if (!self::subscriptionIdValido($subscriptionId)) {
            return ['ok' => false, 'error' => 'Identificador de assinatura inválido.'];
        }

        $curlFn = $curlFn ?? [self::class, 'defaultCurlCall'];
        $result = $curlFn($subscriptionId, $payload, $secretKey);

        $status = (int) ($result['status'] ?? 0);
        $body   = (string) ($result['body'] ?? '');
        $data   = json_decode($body, true);

        if (!is_array($data)) {
            return ['ok' => false, 'error' => 'Resposta inválida da API do Stripe.'];
        }
        if ($status < 200 || $status >= 300) {
            return ['ok' => false, 'error' => $data['error']['message'] ?? 'Erro ao cancelar a assinatura.'];
        }
        if (($data['cancel_at_period_end'] ?? false) !== true) {
            return ['ok' => false, 'error' => 'O Stripe não confirmou o agendamento do cancelamento.'];
        }

        return ['ok' => true, 'periodEnd' => (int) ($data['current_period_end'] ?? 0)];
    }

    /** Mensagem mostrada ao usuário depois do cancelamento agendado. */
    public static function mensagemConfirmacao(int $periodEnd): string
    {
        if ($periodEnd > 0) {
            return 'Cancelamento agendado. Você continua com o plano pago até '
                . date('d/m/Y', $periodEnd)
                . ' e depois a conta volta para o plano gratuito. Nenhuma nova cobrança será feita.';
        }
        return 'Cancelamento agendado. Você continua com o plano pago até o fim do período já pago '
            . 'e depois a conta volta para o plano gratuito. Nenhuma nova cobrança será feita.';
    }

    /** @codeCoverageIgnore — chamada real de rede; coberta via $curlFn injetável */
    private static function defaultCurlCall(string $subscriptionId, array $payload, string $secretKey): array
    {
        $ch = curl_init('https://api.stripe.com/v1/subscriptions/' . rawurlencode($subscriptionId));
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($payload),
            CURLOPT_USERPWD        => $secretKey . ':',
            CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT        => 15,
        ]);
        $body   = (string) curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['body' => $body, 'status' => $status];
    }
}
