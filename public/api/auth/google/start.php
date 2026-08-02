<?php
require_once __DIR__ . '/../../../src/backend/bootstrap.php';

$clientId = trim((string) env('GOOGLE_CLIENT_ID', ''));
$redirectUri = trim((string) env('GOOGLE_REDIRECT_URI', ''));

if (!google_oauth_configured()) {
    http_response_code(500);
    echo 'Login com Google não está configurado.';
    exit;
}

$state = bin2hex(random_bytes(32));
$_SESSION['google_oauth_state'] = $state;

$params = http_build_query([
    'client_id' => $clientId,
    'redirect_uri' => $redirectUri,
    'response_type' => 'code',
    'scope' => 'openid email profile',
    'state' => $state,
    'prompt' => 'select_account',
]);

header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params);
exit;
