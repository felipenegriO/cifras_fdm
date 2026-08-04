<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();
require_auth_json();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Método inválido.']);
    exit;
}
require_csrf();

$raw     = file_get_contents('php://input');
$payload = json_decode($raw, true);
$bandaId = trim((string)($payload['bandaId'] ?? ''));

if ($bandaId === '') {
    echo json_encode(['sucesso' => false, 'mensagem' => 'bandaId ausente.']);
    exit;
}

if (!ClosedBetaPolicy::fromEnvironment()->allows($bandaId)) {
    OperationalLogger::log('warning', 'beta.band_selection_denied', ['result' => 'blocked', 'http_status' => 403]);
    http_response_code(403);
    echo json_encode(['sucesso' => false, 'error' => 'beta_not_invited', 'mensagem' => 'Esta banda não participa do beta fechado.']);
    exit;
}

$userId  = $_SESSION['usuario']['id'] ?? null;
$bandaRepo = new BandaRepository();
$banda   = $bandaRepo->findById($bandaId);

if (!$banda) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Banda não encontrada.']);
    exit;
}

// Verify user is linked to this banda (or is master)
// Always query DB — session may be stale (e.g. band just created)
if (!is_master()) {
    $pdo  = Database::getConnection();
    $stmt = $pdo->prepare(
        'SELECT perfil FROM usuario_banda WHERE usuario_id = ? AND banda_id = ?'
    );
    $stmt->execute([$userId, $bandaId]);
    $row = $stmt->fetch();
    if (!$row) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Acesso negado a esta banda.']);
        exit;
    }
    $perfil = $row['perfil'];

    // Keep session bandas array in sync
    $userBandas = $_SESSION['usuario']['bandas'] ?? [];
    if (!BandaSelectionHelper::isBandaJaNaLista($userBandas, $bandaId)) {
        $_SESSION['usuario']['bandas'][] = ['id' => $bandaId, 'perfil' => $perfil];
    }
} else {
    $perfil = 'administrador';
}

// Update session
if (session_status() === PHP_SESSION_ACTIVE && !headers_sent()) {
}
$_SESSION['banda_atual'] = BandaSelectionHelper::buildBandaAtualSession($banda, $perfil);

// Persist choice in user config
(new UserRepository())->updateConfig($userId, ['banda_atual' => $bandaId]);
$_SESSION['usuario']['config']['banda_atual'] = $bandaId;

echo json_encode(['sucesso' => true]);
