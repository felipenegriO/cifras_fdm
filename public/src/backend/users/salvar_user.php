<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_band_role('administrador');

$method  = $_SERVER['REQUEST_METHOD'];
$bandaId = current_band_id();
$repo    = new UserRepository();

// ── GET: list users in this band ──────────────────────────────────────────────
if ($method === 'GET') {
    echo json_encode($repo->getByBanda($bandaId), JSON_UNESCAPED_UNICODE);
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

// ── search users not in this band (for import) ────────────────────────────────
if ($action === 'search') {
    $q = trim($input['q'] ?? '');
    if (strlen($q) < 2) {
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
    $user = $repo->findById($userId);
    if (!$user || empty($user['email'])) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Usuário sem e-mail cadastrado.']);
        exit;
    }
    try {
        $banda = $_SESSION['banda_atual'] ?? [];
        $token = $repo->createToken($userId, 172800);
        MailService::sendInvite(
            ['nome' => $user['nome'], 'email' => $user['email'], 'username' => $user['username']],
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
    if (!$userId || !in_array($perfil, ['administrador', 'gestor', 'basico'], true)) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Dados inválidos.']);
        exit;
    }
    fdm_require_plan_limit('users', $repo->countByBanda($bandaId));
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
    $repo->removeFromBanda($userId, $bandaId);
    echo json_encode(['sucesso' => true]);
    exit;
}

// ── save (create or update) user ──────────────────────────────────────────────
$nome        = trim($input['nome']      ?? '');
$username    = trim($input['username']  ?? '');
$email       = strtolower(trim($input['email'] ?? ''));
$ativo       = (bool)($input['ativo']   ?? true);
$bandaPerfil = $input['bandaPerfil']    ?? 'basico';
$validade    = trim($input['validade']  ?? '');
$senhaPlain  = trim($input['_senhaPlain'] ?? '');
$isNew       = empty($input['id']);

if (!$nome || !$username) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Nome e username são obrigatórios.']);
    exit;
}
if (!preg_match('/^[a-zA-Z0-9._-]+$/', $username)) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Username inválido (letras, números, ponto, hífen, underscore).']);
    exit;
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'E-mail inválido.']);
    exit;
}
if (!in_array($bandaPerfil, ['administrador', 'gestor', 'basico'], true)) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Perfil inválido.']);
    exit;
}
if ($validade !== '') {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $validade)) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Data de validade inválida.']);
        exit;
    }
    [$y, $m, $d] = array_map('intval', explode('-', $validade));
    if (!checkdate($m, $d, $y)) {
        echo json_encode(['sucesso' => false, 'mensagem' => 'Data de validade inválida.']);
        exit;
    }
}

$userData = [
    'id'       => $input['id'] ?? null,
    'nome'     => $nome,
    'username' => $username,
    'email'    => $email ?: null,
    'ativo'    => $ativo,
    'validade' => $validade,
];
if ($senhaPlain !== '') {
    $userData['_senhaPlain'] = $senhaPlain;
}

// Only check limit when creating a new user
if ($isNew) {
    fdm_require_plan_limit('users', $repo->countByBanda($bandaId));
}

try {
    $id = $repo->saveToBanda($userData, $bandaId, $bandaPerfil);
} catch (PDOException $e) {
    $msg = 'Erro ao salvar.';
    if (str_contains($e->getMessage(), 'Duplicate entry')) {
        $msg = str_contains($e->getMessage(), 'uq_email') ? 'E-mail já está em uso.' : 'Username já está em uso.';
    }
    echo json_encode(['sucesso' => false, 'mensagem' => $msg]);
    exit;
}

// Send invite email when creating a new user with an email address
if ($isNew && $email !== '') {
    try {
        $banda = $_SESSION['banda_atual'] ?? [];
        $token = $repo->createToken($id, 172800); // 48h
        MailService::sendInvite(
            ['nome' => $nome, 'email' => $email, 'username' => $username],
            ['nome' => $banda['nome'] ?? ''],
            $token
        );
        echo json_encode(['sucesso' => true, 'id' => $id, 'convite_enviado' => true]);
    } catch (Exception $e) {
        // Email failed but user was saved — don't fail the request
        echo json_encode(['sucesso' => true, 'id' => $id, 'convite_enviado' => false, 'aviso' => 'Usuário salvo, mas não foi possível enviar o e-mail de convite.']);
    }
    exit;
}

echo json_encode(['sucesso' => true, 'id' => $id]);
