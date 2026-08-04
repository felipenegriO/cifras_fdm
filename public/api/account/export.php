<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('method_not_allowed', 'Método não permitido.', 405);
    exit;
}
require_auth_json();

$data = (new PrivacyService())->exportAccount((string) $_SESSION['usuario']['id']);
header('Content-Disposition: attachment; filename="cifro-meus-dados.json"');
api_success($data);
