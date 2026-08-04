<?php
/**
 * Stripe webhook endpoint.
 *
 * Eventos tratados:
 *   checkout.session.completed   → ativa plano após pagamento via Payment Link
 *   invoice.paid                 → renova assinatura recorrente
 *   customer.subscription.deleted → cancela → plano gratuito
 *   customer.subscription.updated → atualiza status
 *
 * Configure no .env:
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *   STRIPE_PRICE_MENSAL=price_...
 *   STRIPE_PRICE_SEMESTRAL=price_...
 *   STRIPE_PRICE_ANUAL=price_...
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json');

$payload   = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
$secret    = env('STRIPE_WEBHOOK_SECRET', '');

if (!$secret) {
    http_response_code(500);
    echo json_encode(['error' => 'Webhook secret not configured']);
    exit;
}

if (!StripeWebhookHelper::validateStripeSignature($payload, $sigHeader, $secret)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

$event = json_decode($payload, true);
if (!$event) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}

$eventId   = trim((string)($event['id'] ?? ''));
$type      = trim((string)($event['type'] ?? ''));
$created   = (int)($event['created'] ?? 0);
$obj       = $event['data']['object'] ?? [];
if ($eventId === '' || $type === '' || $created <= 0 || !is_array($obj)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid event envelope']);
    exit;
}

$resourceId = StripeWebhookHelper::resourceId($eventId, $obj);
$pdo = Database::getConnection();
$bandaRepo = new BandaRepository();
OperationalLogger::log('info', 'stripe.webhook_received', ['provider' => 'stripe', 'operation' => $type, 'result' => 'accepted']);

try {
    $pdo->beginTransaction();
    $insertEvent = $pdo->prepare("INSERT IGNORE INTO stripe_webhook_events (event_id, event_type, resource_id, event_created, status) VALUES (?, ?, ?, ?, 'processing')");
    $insertEvent->execute([$eventId, $type, $resourceId, $created]);
    if ($insertEvent->rowCount() === 0) {
        $pdo->commit();
        echo json_encode(['received' => true, 'duplicate' => true]);
        exit;
    }

    $resourceStmt = $pdo->prepare('SELECT last_event_created, last_event_id FROM stripe_webhook_resources WHERE resource_id = ? FOR UPDATE');
    $resourceStmt->execute([$resourceId]);
    $lastEvent = $resourceStmt->fetch();
    if ($lastEvent && $created < (int)$lastEvent['last_event_created']) {
        $pdo->prepare("UPDATE stripe_webhook_events SET status = 'ignored', processed_at = UTC_TIMESTAMP() WHERE event_id = ?")->execute([$eventId]);
        $pdo->commit();
        echo json_encode(['received' => true, 'ignored' => true]);
        exit;
    }

    switch ($type) {

    // Disparado quando o cliente conclui o checkout (Payment Link)
    case 'checkout.session.completed':
        $subId    = $obj['subscription'] ?? null;
        $bandaId  = $obj['metadata']['banda_id'] ?? null;
        $priceId  = $obj['metadata']['price_id'] ?? null;

        if ($bandaId && $subId) {
            $plano = resolverPlanoByPrice($priceId);
            $bandaRepo->ativarPlano($bandaId, $plano, $subId);
        }
        break;

    // Renovação de cobrança recorrente
    case 'invoice.paid':
        $subId = $obj['subscription'] ?? null;
        if ($subId) {
            $banda = findBandaBySubscription($bandaRepo, $subId);
            if ($banda) {
                // Descobre qual plano pelo preço da linha da invoice
                $priceId = $obj['lines']['data'][0]['price']['id'] ?? null;
                $plano   = resolverPlanoByPrice($priceId) ?: $banda['plano'];
                $bandaRepo->ativarPlano($banda['id'], $plano, $subId);
            }
        }
        break;

    // Cancelamento → cai para gratuito (não bloqueia)
    case 'customer.subscription.deleted':
        $subId = $obj['id'] ?? null;
        if ($subId) {
            $banda = findBandaBySubscription($bandaRepo, $subId);
            if ($banda) {
                $bandaRepo->atualizarPlano($banda['id'], 'gratuito');
            }
        }
        break;

    // Mudança de status (ex: pagamento atrasado → past_due)
    case 'customer.subscription.updated':
        $subId  = $obj['id'] ?? null;
        $status = $obj['status'] ?? '';
        if ($subId) {
            $banda = findBandaBySubscription($bandaRepo, $subId);
            if ($banda) {
                if (in_array($status, ['active', 'trialing'], true)) {
                    $priceId = $obj['items']['data'][0]['price']['id'] ?? null;
                    $plano   = resolverPlanoByPrice($priceId) ?: $banda['plano'];
                    $bandaRepo->ativarPlano($banda['id'], $plano, $subId);
                } elseif ($status === 'canceled') {
                    $bandaRepo->atualizarPlano($banda['id'], 'gratuito');
                }
            }
        }
        break;
    }

    $pdo->prepare('INSERT INTO stripe_webhook_resources (resource_id, last_event_created, last_event_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_event_created = VALUES(last_event_created), last_event_id = VALUES(last_event_id)')
        ->execute([$resourceId, $created, $eventId]);
    $pdo->prepare("UPDATE stripe_webhook_events SET status = 'processed', processed_at = UTC_TIMESTAMP() WHERE event_id = ?")->execute([$eventId]);
    $pdo->commit();
    echo json_encode(['received' => true]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    OperationalLogger::log('error', 'stripe.webhook_failed', ['provider' => 'stripe', 'operation' => $type, 'result' => 'failed', 'error_type' => get_class($error)]);
    http_response_code(500);
    echo json_encode(['error' => 'Webhook processing failed']);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Mapeia price_id do Stripe para o nome do plano interno.
 * Configure os Price IDs no .env:
 *   STRIPE_PRICE_MENSAL, STRIPE_PRICE_SEMESTRAL, STRIPE_PRICE_ANUAL
 */
function resolverPlanoByPrice(?string $priceId): string {
    $map = [
        env('STRIPE_PRICE_MENSAL',    '') => 'mensal',
        env('STRIPE_PRICE_SEMESTRAL', '') => 'semestral',
        env('STRIPE_PRICE_ANUAL',     '') => 'anual',
    ];
    return StripeWebhookHelper::resolverPlanoByPrice($priceId, $map);
}

function findBandaBySubscription(BandaRepository $repo, string $subId): ?array {
    $pdo  = Database::getConnection();
    $stmt = $pdo->prepare('SELECT * FROM bandas WHERE stripe_subscription_id = ?');
    $stmt->execute([$subId]);
    $row = $stmt->fetch();
    return $row ?: null;
}
