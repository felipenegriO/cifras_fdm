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

$userId  = $_SESSION['usuario']['id'] ?? null;
$bandaRepo = new BandaRepository();
$banda   = $bandaRepo->findById($bandaId);

if (!$banda) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Banda não encontrada.']);
    exit;
}

// Verify user is linked to this banda (or is master)
if (!is_master()) {
    $userBandas = $_SESSION['usuario']['bandas'] ?? [];
    $linked = array_filter($userBandas, fn($b) => $b['id'] === $bandaId);
    if (empty($linked)) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Acesso negado a esta banda.']);
        exit;
    }
    $perfil = array_values($linked)[0]['perfil'];
} else {
    $perfil = 'administrador';
}

// Update session
$_SESSION['banda_atual'] = [
    'id'             => $banda['id'],
    'nome'           => $banda['nome'],
    'perfil'         => $perfil,
    'plano'          => $banda['plano'] ?? 'ativo',
    'trial_expira_em'=> $banda['trial_expira_em'] ?? null,
];

// Persist choice in user config
(new UserRepository())->updateConfig($userId, ['banda_atual' => $bandaId]);
$_SESSION['usuario']['config']['banda_atual'] = $bandaId;

echo json_encode(['sucesso' => true]);
