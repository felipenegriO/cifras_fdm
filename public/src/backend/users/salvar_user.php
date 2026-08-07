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

require_band_role('administrador');

$bandaId = current_band_id();
$repo    = new UserRepository();

// ── GET: list users in this band ──────────────────────────────────────────────
if ($method === 'GET') {
    echo json_encode($repo->getByBanda($bandaId), JSON_UNESCAPED_UNICODE);
    exit;
}

require_csrf();
$input  = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? 'save';

// ── search users not in this band (for import) ────────────────────────────────
if ($action === 'search') {
    if (!is_master()) {
        echo json_encode([]);
        exit;
    }
    $q = trim($input['q'] ?? '');
    if (!UserFormValidator::isSearchQueryValid($q)) {
        echo json_encode([]);
        exit;
    }
    echo json_encode($repo->searchNotInBanda($bandaId, $q), JSON_UNESCAPED_UNICODE);
    exit;
}

// ── resend invite to inactive user ───────────────────────────────────────────
if ($action === 'resend_invite') {
    $userId = trim($input['userId'] ?? '');
    if (!$userId) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'ID inválido.']);
        exit;
    }
    $user = $repo->findByIdInBanda($userId, $bandaId);
    if (!$user || empty($user['email'])) {
        http_response_code(404);
        echo json_encode(['sucesso' => false, 'mensagem' => 'Usuário não encontrado.']);
        exit;
    }
    try {
        $banda = $_SESSION['banda_atual'] ?? [];
        $token = $repo->createToken($userId, 172800);
        MailService::sendInvite(
            ['nome' => $user['nome'], 'email' => $user['email']],
            ['nome' => $banda['nome'] ?? ''],
            $token
        );
        echo json_encode(['sucesso' => true]);
    } catch (Exception $e) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Erro ao enviar e-mail.']);
    }
    exit;
}

// ── import existing user into this band ───────────────────────────────────────
if ($action === 'import') {
    $userId = trim($input['userId'] ?? '');
    $perfil = $input['perfil'] ?? 'basico';
    if (!is_master() || !$userId || !UserFormValidator::isPerfilValido($perfil)) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Dados inválidos.']);
        exit;
    }
    cifro_require_plan_limit('users', $repo->countByBanda($bandaId));
    $repo->importToBanda($userId, $bandaId, $perfil);
    echo json_encode(['sucesso' => true]);
    exit;
}

// ── remove user from this band ────────────────────────────────────────────────
if ($action === 'delete') {
    $userId = trim($input['userId'] ?? '');
    if (!$userId) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'ID inválido.']);
        exit;
    }
    if ($userId === ($_SESSION['usuario']['id'] ?? '')) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Você não pode se remover da banda.']);
        exit;
    }
    if (!$repo->belongsToBanda($userId, $bandaId)) {
        http_response_code(404);
        echo json_encode(['sucesso' => false, 'mensagem' => 'Usuário não encontrado.']);
        exit;
    }
    $repo->removeFromBanda($userId, $bandaId);
    echo json_encode(['sucesso' => true]);
    exit;
}

// ── save (create or update) user ──────────────────────────────────────────────
$nome        = trim($input['nome']      ?? '');
$email       = strtolower(trim($input['email'] ?? ''));
$ativo       = (bool)($input['ativo']   ?? true);
$bandaPerfil = $input['bandaPerfil']    ?? 'basico';
$validade    = trim($input['validade']  ?? '');
$senhaPlain  = trim($input['_senhaPlain'] ?? '');
$isNew       = empty($input['id']);

if (!$isNew && !$repo->belongsToBanda((string) $input['id'], $bandaId)) {
    http_response_code(404);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Usuário não encontrado.']);
    exit;
}

if (!UserFormValidator::isNomeEEmailPresentes($nome, $email)) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Nome e e-mail são obrigatórios.']);
    exit;
}
if (!UserFormValidator::isEmailValido($email)) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'E-mail inválido.']);
    exit;
}
if (!UserFormValidator::isPerfilValido($bandaPerfil)) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Perfil inválido.']);
    exit;
}
if (!UserFormValidator::isValidadeValida($validade)) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Data de validade inválida.']);
    exit;
}

$userData = [
    'id'       => $input['id'] ?? null,
    'nome'     => $nome,
    'email'    => $email ?: null,
    'ativo'    => $ativo,
    'validade' => $validade,
];
if ($senhaPlain !== '') {
    $userData['_senhaPlain'] = $senhaPlain;
}

// Only check limit when creating a new user
if ($isNew) {
    cifro_require_plan_limit('users', $repo->countByBanda($bandaId));
}

try {
    $id = $repo->saveToBanda($userData, $bandaId, $bandaPerfil);
} catch (PDOException $e) {
    echo json_encode(['sucesso' => false, 'mensagem' => UserFormValidator::mapSaveErrorMessage($e)]);
    exit;
}

// Send invite email when creating a new user with an email address
if ($isNew && $email !== '') {
    try {
        $banda = $_SESSION['banda_atual'] ?? [];
        $token = $repo->createToken($id, 172800); // 48h
        MailService::sendInvite(
            ['nome' => $nome, 'email' => $email],
            ['nome' => $banda['nome'] ?? ''],
            $token
        );
        $e2eToken = env('APP_ENV', 'production') === 'test' ? $token : null;
        echo json_encode(['sucesso' => true, 'id' => $id, 'convite_enviado' => true, 'activation_token' => $e2eToken]);
    } catch (Exception $e) {
        // Email failed but user was saved — don't fail the request
        $e2eToken = env('APP_ENV', 'production') === 'test' ? $token : null;
        echo json_encode(['sucesso' => true, 'id' => $id, 'convite_enviado' => false, 'aviso' => 'Usuário salvo, mas não foi possível enviar o e-mail de convite.', 'activation_token' => $e2eToken]);
    }
    exit;
}

echo json_encode(['sucesso' => true, 'id' => $id]);
