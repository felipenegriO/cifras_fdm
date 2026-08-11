<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['sucesso' => false]);
    exit;
}
require_auth_json();

if (!can_manage_bands()) {
    http_response_code(403);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Esta área exige perfil administrador em uma banda com plano ativo.']);
    exit;
}

$repo   = new BandaRepository();
$userId = (string)($_SESSION['usuario']['id'] ?? '');

if ($method === 'GET') {
    echo json_encode(is_master() ? $repo->getAll() : $repo->getManagedByUsuario($userId), JSON_UNESCAPED_UNICODE);
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
    if (!is_master() && !$repo->isManagedByUsuario($id, $userId)) {
        http_response_code(403);
        echo json_encode(['sucesso' => false, 'mensagem' => 'Acesso negado a esta banda.']);
        exit;
    }
    $repo->delete($id);
    echo json_encode(['sucesso' => true]);
    exit;
}

if ($action === 'toggle_plano') {
    http_response_code(409);
    echo json_encode(['sucesso' => false, 'mensagem' => 'O plano só pode ser alterado após a confirmação do pagamento.']);
    exit;
}

// save (create or update)
$nome = trim($input['nome'] ?? '');
if (!$nome) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Nome da banda é obrigatório.']);
    exit;
}

$id = trim($input['id'] ?? '') ?: bin2hex(random_bytes(16));
$existing = $repo->findById($id);
$isNovaBanda = $existing === null;
if (!$isNovaBanda && !is_master() && !$repo->isManagedByUsuario($id, $userId)) {
    http_response_code(403);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Acesso negado a esta banda.']);
    exit;
}
$plano = BandaPlanoValidator::normalizar((string)($existing['plano'] ?? 'gratuito'));
$logo = array_key_exists('logo', $input) ? ($input['logo'] ?: null) : ($existing['logo'] ?? null);
if ($logo !== null && (strlen($logo) > 100000 || !preg_match('#^data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$#', $logo))) {
    http_response_code(422);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Logo inválido ou muito grande.']);
    exit;
}

$banda = [
    'id'              => $id,
    'nome'            => $nome,
    'logo'            => $logo,
    'ativo'           => (int)($input['ativo'] ?? 1),
    'plano'           => $plano,
    'trial_expira_em' => null,
    'stripe_subscription_id' => $existing['stripe_subscription_id'] ?? null,
    'criador_id'      => $existing['criador_id'] ?? $userId,
];

try {
    $repo->save($banda);

    if ($id === current_band_id()) {
        $_SESSION['banda_atual']['nome'] = $nome;
        $_SESSION['banda_atual']['logo'] = $logo;
    }

    if ($isNovaBanda) {
        if ($userId) {
            Database::getConnection()
                ->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, "administrador")')
                ->execute([$userId, $id]);
        }
    }

    echo json_encode(['sucesso' => true, 'id' => $id]);
} catch (PDOException $e) {
    ErrorLogger::fromThrowable($e, 'Falha ao salvar banda', 'bandas/salvar_banda.php');
    echo json_encode(['sucesso' => false, 'mensagem' => 'Erro ao salvar banda.']);
}
