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

$config = [];
foreach ($payload['config'] as $key => $value) {
    if (!UserConfigValidator::isKeySuportada($key)) {
        continue;
    }

    $validated = UserConfigValidator::validate($key, $value);
    if ($validated === null) {
        http_response_code(422);
        echo json_encode(['sucesso' => false, 'mensagem' => 'Valor de configuração inválido.']);
        exit;
    }

    $config[$key] = $validated;
}

$repo = new UserRepository();
if (!$repo->findById($userId)) {
    echo json_encode(['sucesso' => false, 'mensagem' => 'Usuário não encontrado.']);
    exit;
}

try {
    $repo->updateConfig($userId, $config);
} catch (Throwable $e) {
    error_log('salvar_config: ' . $e->getMessage());
    echo json_encode(['sucesso' => false, 'mensagem' => 'Falha ao salvar.']);
    exit;
}

// atualiza a sessão para refletir imediatamente
$_SESSION['usuario']['config'] = array_merge($_SESSION['usuario']['config'] ?? [], $config);

echo json_encode(['sucesso' => true]);
