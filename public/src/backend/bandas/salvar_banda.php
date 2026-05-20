<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (!is_master()) {
    http_response_code(403);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Acesso restrito a master.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$repo   = new BandaRepository();

if ($method === 'GET') {
    echo json_encode($repo->getAll(), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['sucesso' => false]);
    exit;
}

require_csrf();
$input  = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? 'save';

if ($action === 'delete') {
    $id = trim($input['id'] ?? '');
    if (!$id) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'ID inválido.']);
        exit;
    }
    $repo->delete($id);
    echo json_encode(['sucesso' => true]);
    exit;
}

if ($action === 'toggle_plano') {
    $id    = trim($input['id'] ?? '');
    $plano = trim($input['plano'] ?? '');
    if (!$id || !in_array($plano, ['trial', 'ativo', 'gratuito', 'bloqueado'], true)) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Dados inválidos.']);
        exit;
    }
    $banda = $repo->findById($id);
    if (!$banda) { echo json_encode(['sucesso' => false, 'mensagem' => 'Banda não encontrada.']); exit; }
    $banda['plano'] = $plano;
    $repo->save($banda);
    echo json_encode(['sucesso' => true]);
    exit;
}

// save (create or update)
$nome = trim($input['nome'] ?? '');
if (!$nome) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Nome da banda é obrigatório.']);
    exit;
}

$id = trim($input['id'] ?? '') ?: bin2hex(random_bytes(16));

$banda = [
    'id'              => $id,
    'nome'            => $nome,
    'logo'            => $input['logo'] ?? null,
    'ativo'           => (int)($input['ativo'] ?? 1),
    'plano'           => $input['plano'] ?? 'trial',
    'trial_expira_em' => ($input['trial_expira_em'] ?? '') ?: null,
    'stripe_subscription_id' => $input['stripe_subscription_id'] ?? null,
];

try {
    $repo->save($banda);
    echo json_encode(['sucesso' => true, 'id' => $id]);
} catch (PDOException $e) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Erro ao salvar banda.']);
}
