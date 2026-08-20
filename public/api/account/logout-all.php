<?php
/**
 * POST /api/account/logout-all.php
 * Revoga todos os tokens "lembrar-me" do usuário — o caminho para cortar o
 * acesso de um aparelho perdido sem precisar trocar a senha.
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('method_not_allowed', 'Método não permitido.', 405);
    exit;
}
require_auth_json();
require_csrf();

$usuarioId = (string) ($_SESSION['usuario']['id'] ?? '');
if ($usuarioId === '') {
    api_error('nao_autenticado', 'Não autenticado.', 401);
    exit;
}

(new AuthTokenRepository())->revogarTodosDoUsuario($usuarioId);
AuthTokenCookie::apagar();
OperationalLogger::log('info', 'auth.logout_all', ['result' => 'success']);

// A sessão deste aparelho também cai — quem pediu para sair de todos espera
// que "todos" inclua o aparelho em que está.
$_SESSION = [];
if (session_status() === PHP_SESSION_ACTIVE) session_destroy();

api_success(['revogado' => true], ['sucesso' => true]);
