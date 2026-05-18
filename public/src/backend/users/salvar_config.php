<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_auth_json();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Método inválido.']);
    exit;
}
require_csrf();

$raw     = file_get_contents('php://input');
$payload = json_decode($raw, true);

if (!$payload || !isset($payload['config']) || !is_array($payload['config'])) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Payload inválido.']);
    exit;
}

$userId = $_SESSION['usuario']['id'] ?? null;
if (!$userId) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Sessão inválida.']);
    exit;
}

// chaves permitidas (whitelist)
$allowed = ['tema', 'cifraSize', 'scrollSpeed', 'keepAwake'];
$config  = [];
foreach ($allowed as $key) {
    if (array_key_exists($key, $payload['config'])) {
        $config[$key] = $payload['config'][$key];
    }
}

$arquivo = __DIR__ . '/usuarios.json';
if (!file_exists($arquivo)) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Arquivo de usuários não encontrado.']);
    exit;
}

$json     = file_get_contents($arquivo);
$usuarios = json_decode($json, true);
if (!is_array($usuarios)) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Erro ao ler usuários.']);
    exit;
}

$found = false;
foreach ($usuarios as &$u) {
    if (($u['id'] ?? '') === $userId) {
        $u['config'] = array_merge($u['config'] ?? [], $config);
        $found = true;
        break;
    }
}
unset($u);

if (!$found) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Usuário não encontrado.']);
    exit;
}

$newJson = json_encode($usuarios, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
if (file_put_contents($arquivo, $newJson, LOCK_EX) === false) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Falha ao salvar.']);
    exit;
}

// atualiza a sessão para refletir imediatamente
$_SESSION['usuario']['config'] = array_merge($_SESSION['usuario']['config'] ?? [], $config);

echo json_encode(['sucesso' => true]);
