<?php
require_once __DIR__ . '/../../../src/backend/bootstrap.php';

function googleLoginFailed(string $reason): void {
    if (strtolower((string) env('GOOGLE_AUTH_DEBUG', 'false')) === 'true') {
        error_log('[google-auth] ' . date('Y-m-d H:i:s') . ' ' . $reason);
    }
    header('Location: ' . base_url('/login.php?erro=google'));
    exit;
}

$expectedState = $_SESSION['google_oauth_state'] ?? '';
unset($_SESSION['google_oauth_state']);
$receivedState = $_GET['state'] ?? '';

if (!GoogleCallbackValidator::isStateValid($expectedState, $receivedState)) {
    googleLoginFailed('state mismatch');
}

if (GoogleCallbackValidator::userCancelled($_GET)) {
    if (strtolower((string) env('GOOGLE_AUTH_DEBUG', 'false')) === 'true') {
        error_log('[google-auth] user cancelled: ' . ($_GET['error'] ?? ''));
    }
    header('Location: ' . base_url('/login.php?erro=google'));
    exit;
}

$code = GoogleCallbackValidator::extractCode($_GET);
if ($code === null) {
    googleLoginFailed('missing code');
}

$clientId = trim((string) env('GOOGLE_CLIENT_ID', ''));
$clientSecret = trim((string) env('GOOGLE_CLIENT_SECRET', ''));
$redirectUri = trim((string) env('GOOGLE_REDIRECT_URI', ''));

if (!GoogleCallbackValidator::isConfigured($clientId, $clientSecret, $redirectUri)) {
    googleLoginFailed('not configured');
}

$userRepository = new UserRepository();
$bandaRepository = new BandaRepository();
$googleAuth = new GoogleAuthService($userRepository, $bandaRepository);

try {
    $idToken = $googleAuth->exchangeCodeForIdToken($code, $clientId, $clientSecret, $redirectUri);
    $payload = GoogleJwtVerifier::verify($idToken, $clientId);
    $user = $googleAuth->resolveOrCreateUser($payload);
    $legalAcceptance = $_SESSION['google_legal_acceptance'] ?? null;
    unset($_SESSION['google_legal_acceptance']);
    if (is_array($legalAcceptance)) {
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        $userRepository->recordLegalAcceptance(
            $user['id'],
            (string) ($legalAcceptance['terms'] ?? ''),
            (string) ($legalAcceptance['privacy'] ?? ''),
            $ip === '' ? null : hash_hmac('sha256', $ip, (string) env('ENCRYPTION_KEY', 'local-test-key'))
        );
    }
} catch (\Throwable $e) {
    ErrorLogger::fromThrowable($e, 'Falha na autenticação Google OAuth', 'api/auth/google/callback.php');
    googleLoginFailed('authentication failure type=' . get_class($e) . ' msg=' . $e->getMessage());
}

$appDebug = strtolower((string) env('APP_DEBUG', 'false')) === 'true';
$authService = new AuthService($userRepository);
$authController = new AuthController($authService, $userRepository, $appDebug, $bandaRepository);
try {
    $authController->finalizeLogin($user);
} catch (\Throwable $e) {
    ErrorLogger::fromThrowable($e, 'Falha no finalizeLogin após Google OAuth', 'api/auth/google/callback.php');
    googleLoginFailed('finalizeLogin failure type=' . get_class($e) . ' msg=' . $e->getMessage());
}
