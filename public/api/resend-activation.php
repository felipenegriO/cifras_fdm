<?php
require_once __DIR__ . '/../src/backend/bootstrap.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['erro' => 'Método não permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = strtolower(trim((string) ($input['email'] ?? '')));

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['erro' => 'E-mail inválido']);
    exit;
}

if (cifro_rate_limit('resend_activation', 3, 300, $email)) {
    http_response_code(429);
    echo json_encode(['erro' => 'Aguarde alguns minutos antes de solicitar novamente.']);
    exit;
}

$userRepo = new UserRepository();
$user     = $userRepo->findByEmail($email);

// Responde sucesso mesmo se e-mail não existe (evita enumeração)
if (!$user || (int)($user['ativo'] ?? 0) === 1) {
    echo json_encode(['ok' => true]);
    exit;
}

try {
    $token = $userRepo->createToken($user['id'], 172800);
    MailService::sendWelcome(
        ['nome' => $user['nome'], 'email' => $user['email']],
        ['nome' => $_SESSION['banda_atual']['nome'] ?? ''],
        $token
    );
    OperationalLogger::log('info', 'activation.resend', ['operation' => 'resend_activation', 'result' => 'success']);
} catch (Throwable $e) {
    ErrorLogger::fromThrowable($e, 'Falha ao reenviar e-mail de ativação', 'api/resend-activation.php');
    http_response_code(500);
    echo json_encode(['erro' => 'Não foi possível enviar o e-mail. Tente novamente em instantes.']);
    exit;
}

echo json_encode(['ok' => true]);
