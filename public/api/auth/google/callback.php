<?php
require_once __DIR__ . '/../../../src/backend/bootstrap.php';

function googleLoginFailed(string $reason, ?Throwable $error = null, string $level = 'error', array $context = []): void {
    $failures = [
        'state_mismatch' => ['GoogleOAuthStateMismatch', 'State OAuth ausente, inválido ou expirado.'],
        'user_cancelled' => ['GoogleOAuthUserCancelled', 'O consentimento do Google foi cancelado pelo usuário.'],
        'missing_code' => ['GoogleOAuthMissingCode', 'O Google não retornou o código de autorização.'],
        'not_configured' => ['GoogleOAuthNotConfigured', 'A configuração do Google OAuth está incompleta.'],
        'authentication_failure' => ['GoogleOAuthAuthenticationFailure', 'Falha ao validar a autenticação retornada pelo Google.'],
        'finalize_login_failure' => ['GoogleOAuthFinalizeLoginFailure', 'Falha ao criar a sessão após a autenticação Google.'],
    ];
    $failure = $failures[$reason] ?? ['GoogleOAuthCallbackFailure', 'Falha no callback do Google OAuth.'];
    $requestId = request_id();
    ErrorLogger::log(
        $failure[1],
        'api/auth/google/callback.php',
        $level,
        array_merge($context, [
            'exception' => $error ? get_class($error) : $failure[0],
            'message' => $error ? $error->getMessage() : $failure[1],
            'reason' => $reason,
            'request_id' => $requestId,
            'has_state' => isset($_GET['state']) && is_string($_GET['state']) && $_GET['state'] !== '',
            'has_code' => isset($_GET['code']) && is_string($_GET['code']) && $_GET['code'] !== '',
        ])
    );
    unset($_SESSION['google_legal_acceptance']);
    if (strtolower((string) env('GOOGLE_AUTH_DEBUG', 'false')) === 'true') {
        error_log('[google-auth] request_id=' . $requestId . ' reason=' . $reason . ($error ? ' type=' . get_class($error) : ''));
    }
    header('Location: ' . base_url('/login.php?erro=google'));
    exit;
}

$expectedState = $_SESSION['google_oauth_state'] ?? '';
unset($_SESSION['google_oauth_state']);
$receivedState = $_GET['state'] ?? '';

if (!GoogleCallbackValidator::isStateValid($expectedState, $receivedState)) {
    googleLoginFailed('state_mismatch', null, 'warning', ['session_state_present' => $expectedState !== '']);
}

if (GoogleCallbackValidator::userCancelled($_GET)) {
    $providerError = is_string($_GET['error'] ?? null) ? mb_substr($_GET['error'], 0, 100) : 'access_denied';
    $providerMessage = is_string($_GET['error_description'] ?? null) ? mb_substr($_GET['error_description'], 0, 500) : '';
    googleLoginFailed('user_cancelled', null, 'warning', [
        'provider_error' => $providerError,
        'provider_message' => $providerMessage,
    ]);
}

$code = GoogleCallbackValidator::extractCode($_GET);
if ($code === null) {
    googleLoginFailed('missing_code', null, 'warning');
}

$clientId = trim((string) env('GOOGLE_CLIENT_ID', ''));
$clientSecret = trim((string) env('GOOGLE_CLIENT_SECRET', ''));
$redirectUri = trim((string) env('GOOGLE_REDIRECT_URI', ''));

if (!GoogleCallbackValidator::isConfigured($clientId, $clientSecret, $redirectUri)) {
    googleLoginFailed('not_configured');
}

$userRepository = new UserRepository();
$bandaRepository = new BandaRepository();
$googleAuth = new GoogleAuthService($userRepository, $bandaRepository);

try {
    $idToken = $googleAuth->exchangeCodeForIdToken($code, $clientId, $clientSecret, $redirectUri);
    $payload = GoogleJwtVerifier::verify($idToken, $clientId);

    $convitePendente = BandaConviteFlow::pendente();
    $convite = null;
    if ($convitePendente !== null) {
        $conviteFlow = new BandaConviteFlow();
        // Validado ANTES de criar o usuário: convite revogado/expirado, banda
        // inativa ou no teto do plano não pode virar vínculo em usuario_banda.
        // Se não vale mais, descarta e segue o cadastro Google normal (banda
        // própria) — por isso o log: sem ele o usuário vira administrador de
        // uma banda nova que não pediu, e ninguém consegue explicar o porquê.
        if ($conviteFlow->bandaAbertaParaConvite($convitePendente['token']) !== null) {
            $convite = ['token' => $convitePendente['token'], 'banda_id' => $convitePendente['banda_id']];
        } else {
            OperationalLogger::log('warning', 'convite.recusado_no_login', ['operation' => 'convite_google', 'result' => 'denied']);
            BandaConviteFlow::limparSessao();
        }
    }

    $user = $googleAuth->resolveOrCreateUser($payload, $convite);
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
    googleLoginFailed('authentication_failure', $e);
}

$appDebug = strtolower((string) env('APP_DEBUG', 'false')) === 'true';
$authService = new AuthService($userRepository);
$authController = new AuthController($authService, $userRepository, $appDebug, $bandaRepository);
try {
    $authController->finalizeLogin($user);
} catch (\Throwable $e) {
    googleLoginFailed('finalize_login_failure', $e);
}
