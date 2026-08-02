<?php
require_once __DIR__ . '/../../../src/backend/bootstrap.php';

function googleLoginFailed(string $reason): void {
    error_log('[google-auth] ' . $reason);
    header('Location: /login.php?erro=google');
    exit;
}

$expectedState = $_SESSION['google_oauth_state'] ?? '';
unset($_SESSION['google_oauth_state']);
$receivedState = $_GET['state'] ?? '';

if ($expectedState === '' || !is_string($receivedState) || !hash_equals($expectedState, $receivedState)) {
    googleLoginFailed('state mismatch');
}

if (!empty($_GET['error'])) {
    error_log('[google-auth] user cancelled: ' . $_GET['error']);
    header('Location: /login.php?erro=google');
    exit;
}

$code = $_GET['code'] ?? '';
if (!is_string($code) || $code === '') {
    googleLoginFailed('missing code');
}

$clientId = trim((string) env('GOOGLE_CLIENT_ID', ''));
$clientSecret = trim((string) env('GOOGLE_CLIENT_SECRET', ''));
$redirectUri = trim((string) env('GOOGLE_REDIRECT_URI', ''));

if ($clientId === '' || $clientSecret === '' || $redirectUri === '') {
    googleLoginFailed('not configured');
}

$userRepository = new UserRepository();
$bandaRepository = new BandaRepository();
$googleAuth = new GoogleAuthService($userRepository, $bandaRepository);

try {
    $idToken = $googleAuth->exchangeCodeForIdToken($code, $clientId, $clientSecret, $redirectUri);
    $payload = GoogleJwtVerifier::verify($idToken, $clientId);
    $user = $googleAuth->resolveOrCreateUser($payload);
} catch (\Throwable $e) {
    googleLoginFailed($e->getMessage());
}

$appDebug = strtolower((string) env('APP_DEBUG', 'false')) === 'true';
$authService = new AuthService($userRepository);
$authController = new AuthController($authService, $userRepository, $appDebug, $bandaRepository);
$authController->finalizeLogin($user);
