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
            // Assinou de novo depois de ter cancelado: a marca de cancelamento
            // precisa sumir, senão a tela de plano segue dizendo "agendado".
            $bandaRepo->limparCancelamento($bandaId);
            // O Stripe entrega invoice.paid ANTES de checkout.session.completed
            // (medido: 2s e 1s de diferença nos dois pagamentos reais). Naquele
            // momento a banda ainda não tem stripe_subscription_id, então
            // findBandaBySubscription() não acha nada e a expiração vinda do
            // Stripe se perde. Sem gravar aqui, plano_expira_em ficaria NULL até
            // a primeira renovação — um ano inteiro no plano anual — enquanto o
            // e-mail de confirmação já informava a data ao cliente.
            $expiraEm = (new DateTime())->modify(planoValidade($plano));
            $bandaRepo->atualizarExpiracao($subId, $expiraEm->getTimestamp());

            $banda = $bandaRepo->findById($bandaId);
            if ($banda) {
                $validade  = $expiraEm->format('d/m/Y');
                foreach ($bandaRepo->getAdmins($bandaId) as $admin) {
                    try { MailService::sendPaymentConfirmation($admin, $banda, $plano, $validade); } catch (Throwable $e) { ErrorLogger::fromThrowable($e, 'Email confirmação pagamento (checkout)', 'stripe/webhook.php:checkout'); }
                }
            }
        }
        break;

    // Renovação de cobrança recorrente
    case 'invoice.paid':
        $subId = $obj['subscription'] ?? null;
        if ($subId) {
            $banda = findBandaBySubscription($bandaRepo, $subId);
            if ($banda) {
                $priceId   = $obj['lines']['data'][0]['price']['id'] ?? null;
                $plano     = resolverPlanoByPrice($priceId) ?: $banda['plano'];
                $periodEnd = (int)($obj['lines']['data'][0]['period']['end'] ?? $obj['period_end'] ?? 0);
                $bandaRepo->ativarPlano($banda['id'], $plano, $subId);
                $bandaRepo->limparCancelamento($banda['id']);
                if ($periodEnd > 0) {
                    $bandaRepo->atualizarExpiracao($subId, $periodEnd);
                }
                $validade = $periodEnd > 0
                    ? (new DateTime('@' . $periodEnd))->format('d/m/Y')
                    : (new DateTime())->modify(planoValidade($plano))->format('d/m/Y');
                foreach ($bandaRepo->getAdmins($banda['id']) as $admin) {
                    try { MailService::sendPaymentConfirmation($admin, $banda, $plano, $validade); } catch (Throwable $e) { ErrorLogger::fromThrowable($e, 'Email confirmação pagamento (invoice.paid)', 'stripe/webhook.php:invoice.paid'); }
                }
            }
        }
        break;

    // Aviso de renovação iminente (~7 dias antes — configurável no Stripe dashboard)
    case 'invoice.upcoming':
        $subId = $obj['subscription'] ?? null;
        if ($subId) {
            $banda = findBandaBySubscription($bandaRepo, $subId);
            if ($banda) {
                $periodEnd = (int)($obj['period_end'] ?? $obj['lines']['data'][0]['period']['end'] ?? 0);
                $dataRenovacao = $periodEnd > 0
                    ? (new DateTime('@' . $periodEnd))->format('d/m/Y')
                    : '';
                if ($dataRenovacao !== '') {
                    foreach ($bandaRepo->getAdmins($banda['id']) as $admin) {
                        try { MailService::sendPaymentReminder($admin, $banda, $banda['plano'], $dataRenovacao); } catch (Throwable $e) { ErrorLogger::fromThrowable($e, 'Email lembrete renovação (invoice.upcoming)', 'stripe/webhook.php:invoice.upcoming'); }
                    }
                }
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
                foreach ($bandaRepo->getAdmins($banda['id']) as $admin) {
                    try { MailService::sendPlanExpired($admin, $banda); } catch (Throwable $e) { ErrorLogger::fromThrowable($e, 'Email plano expirado (subscription.deleted)', 'stripe/webhook.php:subscription.deleted'); }
                }
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

function planoValidade(string $plano): string {
    return match($plano) {
        'mensal'    => '+1 month',
        'semestral' => '+6 months',
        'anual'     => '+1 year',
        default     => '+1 month',
    };
}

function findBandaBySubscription(BandaRepository $repo, string $subId): ?array {
    $pdo  = Database::getConnection();
    $stmt = $pdo->prepare('SELECT * FROM bandas WHERE stripe_subscription_id = ?');
    $stmt->execute([$subId]);
    $row = $stmt->fetch();
    return $row ?: null;
}
