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

if (!GoogleCallbackValidator::isStateValid($expectedState, $receivedState)) {
    googleLoginFailed('state mismatch');
}

if (GoogleCallbackValidator::userCancelled($_GET)) {
    error_log('[google-auth] user cancelled: ' . $_GET['error']);
    header('Location: /login.php?erro=google');
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
    googleLoginFailed('authentication failure type=' . get_class($e));
}

$appDebug = strtolower((string) env('APP_DEBUG', 'false')) === 'true';
$authService = new AuthService($userRepository);
$authController = new AuthController($authService, $userRepository, $appDebug, $bandaRepository);
$authController->finalizeLogin($user);
