<?php
/**
 * POST /api/plano/cancelar.php
 *
 * Cancelamento self-service da assinatura da banda atual.
 *
 * O cancelamento é agendado para o fim do período já pago
 * (`cancel_at_period_end=true` no Stripe). O acesso NÃO é cortado na hora e o
 * downgrade para gratuito é feito pelo webhook `customer.subscription.deleted`.
 *
 * Body: vazio. Resposta: { "ok": true, "data": { "mensagem": "..." } }
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('method_not_allowed', 'Método não permitido.', 405);
    exit;
}

require_auth_json();
require_csrf();
// Cancelar assinatura é ato financeiro: só o administrador da banda, nunca
// gestor de conteúdo nem membro básico. A banda alvo vem sempre da sessão
// (current_band_id), então não há como pedir cancelamento de outra banda.
require_band_role('administrador');

$bandaId = current_band_id();
if ($bandaId === '') {
    api_error('no_band', 'Nenhuma banda selecionada.', 400);
    exit;
}

// Freio contra clique repetido / abuso: 5 tentativas a cada 10 minutos por banda.
if (cifro_rate_limit('plano_cancelar', 5, 600, $bandaId)) {
    api_error('rate_limited', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', 429);
    exit;
}

$repo  = new BandaRepository();
$banda = $repo->findById($bandaId);
if ($banda === null) {
    api_error('no_band', 'Banda não encontrada.', 404);
    exit;
}

$avaliacao = SubscriptionCancellationService::avaliar(
    (string) ($banda['plano'] ?? ''),
    $banda['stripe_subscription_id'] ?? null,
    $banda['cancelamento_agendado_em'] ?? null,
);

if (!$avaliacao['ok']) {
    // "já cancelado" e "sem recorrência" não são falhas do ponto de vista de
    // quem clicou: o resultado desejado (não ser cobrado de novo) já vale.
    if ($avaliacao['status'] === 200) {
        if ($avaliacao['code'] === 'sem_recorrencia') {
            $repo->agendarCancelamento($bandaId);
        }
        api_success(['mensagem' => $avaliacao['message'], 'codigo' => $avaliacao['code']]);
        exit;
    }
    api_error($avaliacao['code'], $avaliacao['message'], $avaliacao['status']);
    exit;
}

$secretKey = trim((string) env('STRIPE_SECRET_KEY', ''));
if (!str_starts_with($secretKey, 'sk_')) {
    api_error('stripe_not_configured', 'Cancelamento automático indisponível no momento. Fale com o suporte.', 503);
    exit;
}

$subscriptionId = (string) $banda['stripe_subscription_id'];

$resultado = SubscriptionCancellationService::callStripeCancel(
    $secretKey,
    $subscriptionId,
    SubscriptionCancellationService::buildCancelPayload(),
);

if (!$resultado['ok']) {
    OperationalLogger::log('error', 'plano.cancelamento_falhou', [
        'provider'  => 'stripe',
        'operation' => 'cancel_subscription',
        'result'    => 'failed',
    ]);
    api_error('stripe_error', 'Não foi possível cancelar agora. Tente novamente em alguns minutos.', 502);
    exit;
}

$periodEnd = (int) ($resultado['periodEnd'] ?? 0);
$repo->agendarCancelamento($bandaId, $periodEnd);

OperationalLogger::log('info', 'plano.cancelamento_agendado', [
    'provider'  => 'stripe',
    'operation' => 'cancel_subscription',
    'result'    => 'scheduled',
]);

api_success([
    'mensagem' => SubscriptionCancellationService::mensagemConfirmacao($periodEnd),
    'codigo'   => 'agendado',
]);
