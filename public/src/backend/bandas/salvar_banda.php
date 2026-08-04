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

if (!is_master()) {
    http_response_code(403);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Acesso restrito a master.']);
    exit;
}

$repo   = new BandaRepository();

if ($method === 'GET') {
    echo json_encode($repo->getAll(), JSON_UNESCAPED_UNICODE);
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
$plano = BandaPlanoValidator::normalizar((string)($existing['plano'] ?? 'gratuito'));

$banda = [
    'id'              => $id,
    'nome'            => $nome,
    'logo'            => array_key_exists('logo', $input) ? ($input['logo'] ?: null) : ($existing['logo'] ?? null),
    'ativo'           => (int)($input['ativo'] ?? 1),
    'plano'           => $plano,
    'trial_expira_em' => null,
    'stripe_subscription_id' => $existing['stripe_subscription_id'] ?? null,
];

try {
    $repo->save($banda);

    // Ao criar uma banda nova pelo painel master, vincula o master como
    // administrador dela — sem isso a banda fica sem nenhum usuário.
    if ($isNovaBanda) {
        $userId = $_SESSION['usuario']['id'] ?? null;
        if ($userId) {
            Database::getConnection()
                ->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, "administrador")')
                ->execute([$userId, $id]);
        }
    }

    echo json_encode(['sucesso' => true, 'id' => $id]);
} catch (PDOException $e) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Erro ao salvar banda.']);
}
