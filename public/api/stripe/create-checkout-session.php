<?php
/**
 * POST /api/stripe/create-checkout-session.php
 *
 * Cria uma Stripe Checkout Session para o plano informado e retorna a URL
 * de redirecionamento para o checkout hospedado pelo Stripe.
 *
 * Body JSON: { "plano": "mensal" | "semestral" | "anual" }
 * Resposta:  { "ok": true, "data": { "url": "https://checkout.stripe.com/..." } }
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('method_not_allowed', 'Método não permitido.', 405);
    exit;
}

require_auth_json();
require_csrf();

$secretKey = trim((string)env('STRIPE_SECRET_KEY', ''));
if (!str_starts_with($secretKey, 'sk_')) {
    api_error('stripe_not_configured', 'Pagamento via Stripe não configurado.', 503);
    exit;
}

$priceMap = [
    'mensal'    => trim((string)env('STRIPE_PRICE_MENSAL', '')),
    'semestral' => trim((string)env('STRIPE_PRICE_SEMESTRAL', '')),
    'anual'     => trim((string)env('STRIPE_PRICE_ANUAL', '')),
];

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$plano = trim((string)($input['plano'] ?? ''));

try {
    $priceId = StripeCheckoutHelper::priceIdForPlan($plano, $priceMap);
} catch (InvalidArgumentException) {
    api_error('invalid_plan', 'Plano inválido.', 400);
    exit;
}

if ($priceId === '') {
    api_error('price_not_configured', 'Price ID do Stripe não configurado para este plano.', 503);
    exit;
}

$bandaId    = current_band_id();
if ($bandaId === '') {
    api_error('no_band', 'Nenhuma banda selecionada.', 400);
    exit;
}

// . app_base() é obrigatório: APP_URL é a raiz do domínio e o app pode viver
// numa subpasta (cifro.online/beta/public). O rewrite de HTML não alcança esta
// URL, porque ela é enviada ao Stripe e usada por ELE no retorno — sem o
// prefixo, o músico paga e cai num 404. Mesmo padrão do MailService.
$appUrl     = rtrim((string)env('APP_URL', ''), '/') . app_base();
if ($appUrl === '') {
    api_error('app_url_not_configured', 'URL base do aplicativo não configurada.', 503);
    exit;
}
$userEmail  = (string)($_SESSION['usuario']['email'] ?? '');
// Aponta direto para a aba, sem depender do redirecionamento de plano.php:
// a URL é montada aqui a cada pagamento (não há Payment Link estático cuja URL
// ficaria no painel do Stripe), então o pagamento deixa de depender de uma
// tela que virou apenas compatibilidade.
$successUrl = $appUrl . '/minha-banda.php?aba=plano&checkout=success&session_id={CHECKOUT_SESSION_ID}';
$cancelUrl  = $appUrl . '/minha-banda.php?aba=plano&checkout=cancel';

$payload = StripeCheckoutHelper::buildPayload(
    priceId: $priceId,
    bandaId: $bandaId,
    priceIdMeta: $priceId,
    customerEmail: $userEmail,
    successUrl: $successUrl,
    cancelUrl: $cancelUrl,
);

$result = StripeCheckoutHelper::callStripeApi($secretKey, $payload);

if (!$result['ok']) {
    OperationalLogger::log('error', 'stripe.checkout_session_failed', [
        'provider'  => 'stripe',
        'operation' => 'create_checkout_session',
        'result'    => 'failed',
    ]);
    api_error('stripe_error', 'Não foi possível iniciar o pagamento. Tente novamente.', 502);
    exit;
}

api_success(['url' => $result['url']]);
