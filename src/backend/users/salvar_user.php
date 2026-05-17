<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../backup_helpers.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
require_admin_json();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  require_csrf();
}

$arquivo = 'usuarios.json';

// GET: devolve o arquivo (ou array vazio)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  if (!file_exists($arquivo)) {
    echo json_encode([]);
    exit;
  }

  $json = file_get_contents($arquivo);
  $data = json_decode($json, true);
  if (!is_array($data)) $data = [];

  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  exit;
}

// POST: salva
$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);

if (!$payload || !isset($payload['usuarios']) || !is_array($payload['usuarios'])) {
  echo json_encode(['sucesso' => false, 'mensagem' => 'Payload inválido.']);
  exit;
}

$usuarios = $payload['usuarios'];
$usuariosFinal = [];

foreach ($usuarios as $u) {
  $id = $u['id'] ?? null;
  $nome = trim((string)($u['nome'] ?? ''));
  $username = trim((string)($u['username'] ?? ''));
  $ativo = (bool)($u['ativo'] ?? false);
  $validade = trim((string)($u['validade'] ?? ''));
  $perfil = strtolower(trim((string)($u['perfil'] ?? 'administrador')));

  if (!$id) $id = bin2hex(random_bytes(16));

  if ($nome === '' || $username === '') {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Nome e username são obrigatórios.']);
    exit;
  }

  // valida username
  if (preg_match('/\s/', $username) || !preg_match('/^[a-zA-Z0-9._-]+$/', $username)) {
    echo json_encode(['sucesso' => false, 'mensagem' => "Username inválido: {$username}"]);
    exit;
  }

  if (!in_array($perfil, ['administrador', 'musico', 'externo'], true)) {
    echo json_encode(['sucesso' => false, 'mensagem' => "Perfil invalido para {$username}."]);
    exit;
  }

  if ($perfil === 'externo' && $validade === '') {
    echo json_encode(['sucesso' => false, 'mensagem' => "Usuario externo precisa de data de validade: {$username}."]);
    exit;
  }

  if ($validade !== '') {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $validade)) {
      echo json_encode(['sucesso' => false, 'mensagem' => "Data de validade invalida para {$username}."]);
      exit;
    }

    [$year, $month, $day] = array_map('intval', explode('-', $validade));
    if (!checkdate($month, $day, $year)) {
      echo json_encode(['sucesso' => false, 'mensagem' => "Data de validade invalida para {$username}."]);
      exit;
    }
  }

  // mantém hash existente
  $senhaHash = $u['senhaHash'] ?? null;

  // se veio _senhaPlain, gera hash e apaga
  $senhaPlain = $u['_senhaPlain'] ?? null;
  if (is_string($senhaPlain) && trim($senhaPlain) !== '') {
    $senhaHash = password_hash($senhaPlain, PASSWORD_DEFAULT);
  }

  $usuariosFinal[] = [
    'id' => $id,
    'nome' => $nome,
    'username' => $username,
    'ativo' => $ativo,
    'validade' => $validade,
    'perfil' => $perfil,
    'senhaHash' => $senhaHash
  ];
}

// checa duplicidade de username
$usernames = [];
foreach ($usuariosFinal as $u) {
  $key = strtolower($u['username']);
  if (isset($usernames[$key])) {
    echo json_encode(['sucesso' => false, 'mensagem' => "Username duplicado: {$u['username']}"]);
    exit;
  }
  $usernames[$key] = true;
}

// salva no arquivo (com lock)
$json = json_encode($usuariosFinal, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if ($json === false) {
  echo json_encode(['sucesso' => false, 'mensagem' => 'Falha ao gerar JSON.']);
  exit;
}

fdm_backup_file($arquivo);
$ok = file_put_contents($arquivo, $json, LOCK_EX);
if ($ok === false) {
  echo json_encode(['sucesso' => false, 'mensagem' => 'Falha ao salvar arquivo. Verifique permissões.']);
  exit;
}

fdm_bump_cache_version();
echo json_encode(['sucesso' => true, 'mensagem' => 'Usuários salvos com sucesso!']);
