<?php
/**
 * Stripe webhook endpoint.
 * Handles invoice.paid → activate band plan
 * and customer.subscription.deleted → block band
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json');

$payload = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
$secret    = env('STRIPE_WEBHOOK_SECRET', '');

if (!$secret) {
    http_response_code(500);
    echo json_encode(['error' => 'Webhook secret not configured']);
    exit;
}

// Validate Stripe signature
if (!validateStripeSignature($payload, $sigHeader, $secret)) {
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

$bandaRepo = new BandaRepository();
$type      = $event['type'] ?? '';
$obj       = $event['data']['object'] ?? [];

switch ($type) {
    case 'invoice.paid':
        $subId = $obj['subscription'] ?? null;
        if ($subId) {
            $banda = findBandaBySubscription($bandaRepo, $subId);
            if ($banda) {
                $banda['plano'] = 'banda';
                $bandaRepo->save($banda);
            }
        }
        break;

    case 'customer.subscription.deleted':
        $subId = $obj['id'] ?? null;
        if ($subId) {
            $banda = findBandaBySubscription($bandaRepo, $subId);
            if ($banda) {
                $bandaRepo->marcarBloqueada($banda['id']);
            }
        }
        break;

    case 'customer.subscription.updated':
        $subId = $obj['id'] ?? null;
        $status = $obj['status'] ?? '';
        if ($subId && in_array($status, ['active', 'trialing'], true)) {
            $banda = findBandaBySubscription($bandaRepo, $subId);
            if ($banda) {
                $banda['plano'] = 'banda';
                $bandaRepo->save($banda);
            }
        }
        break;
}

echo json_encode(['received' => true]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function findBandaBySubscription(BandaRepository $repo, string $subId): ?array {
    $pdo  = Database::getConnection();
    $stmt = $pdo->prepare('SELECT * FROM bandas WHERE stripe_subscription_id = ?');
    $stmt->execute([$subId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function validateStripeSignature(string $payload, string $sigHeader, string $secret): bool {
    // Parse Stripe signature header: t=timestamp,v1=hash
    $parts = [];
    foreach (explode(',', $sigHeader) as $part) {
        [$k, $v] = explode('=', $part, 2) + ['', ''];
        $parts[$k] = $v;
    }

    if (empty($parts['t']) || empty($parts['v1'])) return false;

    $timestamp = (int)$parts['t'];
    // Reject events older than 5 minutes to prevent replay attacks
    if (abs(time() - $timestamp) > 300) return false;

    $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
    return hash_equals($expected, $parts['v1']);
}
