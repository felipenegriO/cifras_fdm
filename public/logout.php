<?php
require_once __DIR__ . '/src/backend/bootstrap.php';

// Sair exige POST com CSRF: por GET, um link de terceiro conseguia deslogar o
// músico à distância — e desde que o logout passou a revogar o "lembrar-me",
// isso custaria redigitar a senha, possivelmente no meio de um culto.
// GET continua respondendo, mas só com o formulário de confirmação.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    render_view('logout');
    exit;
}
require_csrf();

// Sair de verdade também derruba o "lembrar-me" deste aparelho — senão a
// próxima visita ressuscitaria a sessão pelo token.
$valorLembrar = AuthTokenCookie::ler();
if ($valorLembrar !== '') {
    $repoTokens = new AuthTokenRepository();
    $partes = (new AuthTokenService($repoTokens))->parseCookie($valorLembrar);
    if ($partes !== null) {
        try { $repoTokens->revogar($partes['seletor']); } catch (Throwable $e) {}
    }
    AuthTokenCookie::apagar();
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}
session_destroy();
header('Location: ' . base_url('/login.php'));
exit;
