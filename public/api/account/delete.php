<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('method_not_allowed', 'Método não permitido.', 405);
    exit;
}
require_auth_json();
require_csrf();

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$confirmation = strtolower(trim((string) ($input['email'] ?? '')));
$sessionEmail = strtolower(trim((string) ($_SESSION['usuario']['email'] ?? '')));
if ($confirmation === '' || !hash_equals($sessionEmail, $confirmation)) {
    api_error('confirmation_invalid', 'Confirme o e-mail da conta para continuar.', 422);
    exit;
}

(new PrivacyService())->deleteAccount((string) $_SESSION['usuario']['id']);
$_SESSION = [];
if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
api_success(['deleted' => true], ['sucesso' => true]);
