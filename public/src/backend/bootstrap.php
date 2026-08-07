<?php
// Prevent session file corruption when client disconnects mid-request
ignore_user_abort(true);

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/backup_helpers.php';
require_once __DIR__ . '/../Views/partials/icons.php';
$GLOBALS['__cifro_request_started_at'] = microtime(true);

// Rewrite absolute HTML paths when APP_BASE is set (subfolder deploys)
if (($GLOBALS['__cifro_app_base'] = rtrim((string)getenv('APP_BASE'), '/')) !== '') {
    ob_start(function (string $buffer): string {
        $base = $GLOBALS['__cifro_app_base'];
        // Inject window.APP_BASE so static .js files can use it
        $buffer = preg_replace(
            '/(<head[^>]*>)/i',
            '$1<script>window.APP_BASE=' . json_encode($base) . ';</script>',
            $buffer, 1
        );
        // HTML attributes: href="/ src="/ action="/
        $buffer = preg_replace('/((?:href|src|action)=")\/(?!\/)/', '$1' . $base . '/', $buffer);
        // JS inline: location.href = '/' / window.location.href = "/" / fetch('/
        $buffer = preg_replace("/((?:window\.)?location(?:\.href)?\s*=\s*['\"])\/(?!\/)/", '$1' . $base . '/', $buffer);
        $buffer = preg_replace("/(fetch\(['\"])\/(?!\/)/", '$1' . $base . '/', $buffer);
        return $buffer;
    });
}

// ── Inject JS error reporter into every HTML response ───────────────────────
ob_start(function (string $buffer): string {
    if (stripos($buffer, '</body>') === false) return $buffer;
    $tag = '<script src="' . (rtrim((string)getenv('APP_BASE'), '/')) . '/src/js/cifro-error-reporter.js" defer></script>';
    return str_ireplace('</body>', $tag . '</body>', $buffer);
});

// ── Global error/exception handlers ─────────────────────────────────────────
set_exception_handler(function (Throwable $e): void {
    _cifro_log_error($e->getMessage(), get_class($e) . ' at ' . $e->getFile() . ':' . $e->getLine(), [
        'exception' => get_class($e),
        'file'      => $e->getFile(),
        'line'      => $e->getLine(),
        'trace'     => array_slice(explode("\n", $e->getTraceAsString()), 0, 8),
    ]);
    if (!headers_sent()) http_response_code(500);
});

set_error_handler(function (int $errno, string $errstr, string $errfile, int $errline): bool {
    if (!($errno & error_reporting())) return false;
    if (in_array($errno, [E_NOTICE, E_USER_NOTICE, E_DEPRECATED, E_USER_DEPRECATED], true)) return false;
    _cifro_log_error($errstr, $errfile . ':' . $errline, ['errno' => $errno]);
    return false;
});

register_shutdown_function(function (): void {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        _cifro_log_error($err['message'], $err['file'] . ':' . $err['line'], ['type' => $err['type']]);
    }
});

function _cifro_log_error(string $descricao, string $referencia, array $detalhes = []): void {
    try {
        $pdo = Database::getConnection();
        $pdo->prepare(
            'INSERT INTO app_error_logs (nivel, referencia, descricao, detalhes) VALUES (?, ?, ?, ?)'
        )->execute([
            'error',
            mb_substr($referencia, 0, 255),
            mb_substr($descricao,  0, 500),
            json_encode($detalhes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    } catch (Throwable) {
        error_log('[cifro] error-log failed: ' . $descricao);
    }
}

spl_autoload_register(function ($class) {
    $baseDir = __DIR__ . '/../';
    $paths = [
        $baseDir . 'Services/' . $class . '.php',
        $baseDir . 'Controllers/' . $class . '.php',
        $baseDir . 'Repositories/' . $class . '.php',
    ];

    foreach ($paths as $path) {
        if (file_exists($path)) {
            require_once $path;
            return;
        }
    }
});

function request_id(): string {
    static $id = null;
    if ($id === null) $id = bin2hex(random_bytes(8));
    return $id;
}

function api_success($data = null, array $legacy = []): void {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('X-Request-Id: ' . request_id());
    }
    echo json_encode(array_merge(['ok' => true, 'data' => $data, 'request_id' => request_id()], $legacy), JSON_UNESCAPED_UNICODE);
}

function api_error(string $code, string $message, int $status = 400, array $legacy = []): void {
    http_response_code($status);
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('X-Request-Id: ' . request_id());
    }
    echo json_encode(array_merge([
        'ok' => false,
        'data' => null,
        'error' => ['code' => $code, 'message' => $message],
        'request_id' => request_id(),
    ], $legacy), JSON_UNESCAPED_UNICODE);
}

set_exception_handler(function (Throwable $error): void {
    $path = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
    $accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
    $isApi = str_starts_with($path, '/api/') || str_contains($path, '/src/backend/') || in_array($path, ['/health', '/ready', '/health.php', '/ready.php'], true) || str_contains($accept, 'application/json');
    OperationalLogger::log('error', 'request.exception', ['error_type' => get_class($error), 'http_status' => 500]);
    if ($isApi) {
        api_error('internal_error', 'Não foi possível concluir a solicitação.', 500);
        return;
    }
    http_response_code(500);
    echo 'Não foi possível concluir a solicitação. Código: ' . e(request_id());
});

register_shutdown_function(function (): void {
    if (!class_exists('OperationalLogger')) return;
    $startedAt = (float) ($GLOBALS['__cifro_request_started_at'] ?? microtime(true));
    OperationalLogger::log('info', 'request.completed', [
        'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        'http_status' => http_response_code(),
    ]);
});

validate_production_env();

// ===== Security headers =====
if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://www.youtube.com; img-src 'self' data: https://img.youtube.com https://i.ytimg.com;");
}

// ===== Secure session cookie params =====
if (session_status() === PHP_SESSION_NONE) {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

// ===== Session inactivity timeout (8 hours) =====
define('SESSION_IDLE_SECONDS', 8 * 3600);
if (isset($_SESSION['_last_activity']) && (time() - $_SESSION['_last_activity']) > SESSION_IDLE_SECONDS) {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    session_start();
}
if (session_status() === PHP_SESSION_ACTIVE) {
    $_SESSION['_last_activity'] = time();
}

if (!class_exists('CifroTestTerminate', false)) {
    /** Thrown by cifro_terminate() instead of exit() when running under PHPUnit. */
    class CifroTestTerminate extends \RuntimeException {}
}

/**
 * Isolated seam for script termination. In production this is exit();
 * under PHPUnit ($GLOBALS['__cifro_test_terminate'] === true) it throws a
 * catchable exception instead, so tests can assert on the abort path
 * without killing the test process.
 */
function cifro_terminate(): void {
    if ($GLOBALS['__cifro_test_terminate'] ?? false) {
        throw new CifroTestTerminate();
    }
    exit;
}

function e($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function csrf_token() {
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_meta() {
    echo '<meta name="csrf-token" content="' . htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') . '">';
}

/** True when all three Google OAuth env vars are set, so the flow can run end-to-end. */
function google_oauth_configured(): bool {
    return trim((string) env('GOOGLE_CLIENT_ID', '')) !== ''
        && trim((string) env('GOOGLE_CLIENT_SECRET', '')) !== ''
        && trim((string) env('GOOGLE_REDIRECT_URI', '')) !== '';
}

function require_auth_json() {
    if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true) {
        http_response_code(401);
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Nao autenticado.', 'mensagem' => 'Nao autenticado.']);
        cifro_terminate();
    }
    if (cifro_session_user_expired()) {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
        http_response_code(401);
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Sessao expirada.', 'mensagem' => 'Sessao expirada.']);
        cifro_terminate();
    }
    require_closed_beta_json();
}

function require_closed_beta_json(): void {
    $path = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    if (str_ends_with($path, '/src/backend/bandas/selecionar.php')) return;
    $bandId = current_band_id();
    if (ClosedBetaPolicy::fromEnvironment()->allows($bandId)) return;
    OperationalLogger::log('warning', 'beta.access_denied', ['result' => 'blocked', 'http_status' => 403]);
    http_response_code(403);
    if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'beta_not_invited', 'mensagem' => 'Esta banda não participa do beta fechado.']);
    cifro_terminate();
}

function require_admin_json() {
    require_auth_json();
    if (!current_user_is_admin()) {
        http_response_code(403);
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Acesso restrito ao administrador.', 'mensagem' => 'Acesso restrito ao administrador.']);
        cifro_terminate();
    }
}

function require_csrf() {
    $expected = $_SESSION['csrf_token'] ?? '';
    $received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
    if (!is_string($expected) || $expected === '' || !is_string($received) || !hash_equals($expected, $received)) {
        http_response_code(403);
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Token CSRF inválido.', 'mensagem' => 'Token CSRF inválido.']);
        cifro_terminate();
    }
}

function send_no_cache_headers() {
    if (headers_sent()) return;
    header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
    header("Pragma: no-cache");
    header("Expires: 0");
}

function require_auth() {
    if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true) {
        if (!headers_sent()) header('Location: ' . base_url('/landing.php'));
        cifro_terminate();
    }

    if (cifro_session_user_expired()) {
        $_SESSION = [];
        if (ini_get('session.use_cookies') && !headers_sent()) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
        if (!headers_sent()) header('Location: ' . base_url('/login.php?expirado=1'));
        cifro_terminate();
    }

    $policy = ClosedBetaPolicy::fromEnvironment();
    $page = basename((string) ($_SERVER['PHP_SELF'] ?? ''));
    if (!in_array($page, ['select-banda.php', 'logout.php', 'beta-indisponivel.php'], true) && !$policy->allows(current_band_id())) {
        OperationalLogger::log('warning', 'beta.access_denied', ['result' => 'blocked', 'http_status' => 302]);
        if (!headers_sent()) header('Location: ' . base_url('/beta-indisponivel.php'));
        cifro_terminate();
    }
    cifro_check_plano();
}

function cifro_check_plano(): void {
    $banda = $_SESSION['banda_atual'] ?? [];
    if (empty($banda['id'])) return; // no band selected yet, let select-banda handle it

    $plano = $banda['plano'] ?? 'gratuito';
    if ($plano === 'bloqueado') {
        if (!in_array(basename($_SERVER['PHP_SELF'] ?? ''), ['plano-expirado.php', 'plano.php'], true)) {
            if (!headers_sent()) header('Location: ' . base_url('/plano-expirado.php'));
            cifro_terminate();
        }
        return;
    }
    if ($plano === 'trial') {
        $repo = new BandaRepository();
        $repo->atualizarPlano($banda['id'], 'gratuito');
        $_SESSION['banda_atual']['plano'] = 'gratuito';
        $_SESSION['banda_atual']['trial_expira_em'] = null;
    }
}

// ---------- Role helpers (new multi-band schema) ----------

function band_data_path(string $file): string {
    $bandId = current_band_id();
    return __DIR__ . '/../data/bands/' . $bandId . '/' . ltrim($file, '/');
}

function current_band_id(): string {
    return $_SESSION['banda_atual']['id'] ?? '';
}

function current_band_role(): string {
    return $_SESSION['banda_atual']['perfil'] ?? 'basico';
}

function require_current_band_json(): string {
    require_auth_json();
    $bandId = current_band_id();
    if ($bandId === '') {
        http_response_code(404);
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Banda não encontrada.', 'mensagem' => 'Banda não encontrada.']);
        cifro_terminate();
    }

    $resolver = $GLOBALS['__cifro_band_membership_resolver'] ?? null;
    if (is_callable($resolver) && strtolower((string) env('APP_ENV', 'production')) === 'test') {
        $membership = $resolver($_SESSION['usuario']['id'] ?? '', $bandId, is_master());
    } else {
        $pdo = Database::getConnection();
        if (is_master()) {
            $stmt = $pdo->prepare('SELECT 1 FROM bandas WHERE id=? LIMIT 1');
            $stmt->execute([$bandId]);
        } else {
            $stmt = $pdo->prepare('SELECT perfil FROM usuario_banda WHERE usuario_id=? AND banda_id=? LIMIT 1');
            $stmt->execute([$_SESSION['usuario']['id'] ?? '', $bandId]);
        }
        $membership = $stmt->fetchColumn();
    }
    if ($membership === false) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Banda não encontrada.', 'mensagem' => 'Banda não encontrada.']);
        cifro_terminate();
    }
    if (!is_master()) {
        $_SESSION['banda_atual']['perfil'] = (string) $membership;
    }
    return $bandId;
}

function is_master(): bool {
    return ($_SESSION['usuario']['perfil'] ?? '') === 'master';
}

function can_edit_content(): bool {
    if (is_master()) return true;
    return in_array(current_band_role(), ['gestor', 'administrador'], true);
}

function can_manage_band_users(): bool {
    if (is_master()) return true;
    return current_band_role() === 'administrador';
}

/** Aborts with 403 JSON if caller doesn't have $minRole within current band. */
function require_band_role(string $minRole): void {
    require_current_band_json();
    $order = ['basico' => 0, 'gestor' => 1, 'administrador' => 2];
    $required = $order[$minRole] ?? 0;
    $actual   = is_master() ? 99 : ($order[current_band_role()] ?? 0);
    if ($actual < $required) {
        http_response_code(403);
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Permissão insuficiente.', 'mensagem' => 'Permissão insuficiente.']);
        cifro_terminate();
    }
}

// ---------- Legacy helpers (kept for backwards compat) ----------

function current_user_profile(): string {
    // Returns the banda-scoped role for views that still check it
    if (is_master()) return 'administrador';
    $role = current_band_role();
    $map = ['administrador' => 'administrador', 'gestor' => 'administrador', 'basico' => 'musico'];
    return $map[$role] ?? 'musico';
}

function current_user_is_admin(): bool {
    return can_manage_band_users();
}

function require_admin(): void {
    require_auth();
    if (!current_user_is_admin()) {
        http_response_code(403);
        echo 'Acesso restrito ao administrador.';
        cifro_terminate();
    }
}

function cifro_session_user_expired(): bool {
    $usuario = $_SESSION['usuario'] ?? null;
    if (!is_array($usuario) || empty($usuario['id'])) {
        return false;
    }

    $validade = trim((string)($usuario['validade'] ?? ''));
    if ($validade === '') {
        return false;
    }

    $timezone = new DateTimeZone('America/Sao_Paulo');
    $dataValidade = DateTimeImmutable::createFromFormat('!Y-m-d', $validade, $timezone);
    if (!$dataValidade) {
        return true;
    }

    $hoje = new DateTimeImmutable('today', $timezone);
    return $dataValidade < $hoje;
}

function app_base(): string {
    static $base = null;
    if ($base === null) {
        $base = rtrim((string) env('APP_BASE', ''), '/');
    }
    return $base;
}

function base_url(string $path = ''): string {
    return app_base() . '/' . ltrim($path, '/');
}

function asset_url($path) {
    $path = (string) $path;
    if ($path === '') {
        return $path;
    }

    // Absolute filesystem path (e.g. from tempnam) — version directly
    if (file_exists($path)) {
        return $path . '?v=' . filemtime($path);
    }

    $base     = app_base();
    $absPath  = $base . ($path[0] === '/' ? $path : '/' . $path);
    $filePath = ($_SERVER['DOCUMENT_ROOT'] ?? '') . $absPath;
    if (file_exists($filePath)) {
        return $absPath . '?v=' . filemtime($filePath);
    }

    return $absPath;
}

function render_view($view, $data = []) {
    $view = trim((string) $view, '/');
    $viewPath = __DIR__ . '/../Views/' . $view . '.php';
    if (!file_exists($viewPath)) {
        http_response_code(500);
        echo 'View not found.';
        cifro_terminate();
    }

    if (is_array($data)) {
        extract($data, EXTR_SKIP);
    }

    require $viewPath;
}

function render_partial($partial, $data = []) {
    $partial = trim((string) $partial, '/');
    $partialPath = __DIR__ . '/../Views/partials/' . $partial . '.php';
    if (!file_exists($partialPath)) {
        http_response_code(500);
        echo 'Partial not found.';
        cifro_terminate();
    }

    if (is_array($data)) {
        extract($data, EXTR_SKIP);
    }

    require $partialPath;
}

// ---------- Plan limits ----------

/**
 * Planos disponíveis:
 *   gratuito — free permanente, 10 músicas, todas as funcionalidades
 *   mensal   — R$9,90/mês, ilimitado
 *   semestral — R$49,90/6 meses, ilimitado
 *   anual    — R$89,90/ano, ilimitado
 *   bloqueado — acesso suspenso
 *   ativo    — legado (equivale a mensal)
 *
 * Returns resource limits for a given plan. -1 means unlimited.
 */
function cifro_plan_limits(string $plano): array {
    return match($plano) {
        'gratuito'  => ['users' => 1,  'musicas' => 10,  'playlists' => 1,  'bandas' => 1],
        'trial'     => ['users' => 1,  'musicas' => 10,  'playlists' => 1,  'bandas' => 1],
        'mensal'    => ['users' => -1, 'musicas' => -1,  'playlists' => -1, 'bandas' => -1],
        'semestral' => ['users' => -1, 'musicas' => -1,  'playlists' => -1, 'bandas' => -1],
        'anual'     => ['users' => -1, 'musicas' => -1,  'playlists' => -1, 'bandas' => -1],
        'ativo'     => ['users' => -1, 'musicas' => -1,  'playlists' => -1, 'bandas' => -1], // legado
        default     => ['users' => 0,  'musicas' => 0,   'playlists' => 0,  'bandas' => 0],  // bloqueado
    };
}

/**
 * Label amigável para exibição ao usuário.
 */
function cifro_plan_label(string $plano): string {
    return match($plano) {
        'gratuito'  => 'Gratuito',
        'trial'     => 'Gratuito',
        'mensal'    => 'Mensal',
        'semestral' => 'Semestral',
        'anual'     => 'Anual',
        'ativo'     => 'Mensal',
        'bloqueado' => 'Bloqueado',
        default     => $plano,
    };
}

/**
 * Checks if a resource limit has been reached for the current band.
 * Aborts with 403 JSON if limit exceeded.
 * $resource: 'musicas' | 'playlists' | 'users'
 * $currentCount: current count (caller queries the DB)
 */
function cifro_require_plan_limit(string $resource, int $currentCount): void {
    if (is_master()) return;
    $plano  = $_SESSION['banda_atual']['plano'] ?? 'bloqueado';
    $limits = cifro_plan_limits($plano);
    $limit  = $limits[$resource] ?? 0;
    if ($limit === -1) return; // unlimited
    if ($currentCount >= $limit) {
        $labels = ['musicas' => 'músicas', 'playlists' => 'playlists', 'users' => 'usuários'];
        $label  = $labels[$resource] ?? $resource;
        http_response_code(403);
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'          => false,
            'sucesso'     => false,
            'error'       => "Limite do plano " . cifro_plan_label($plano) . " atingido: máximo de {$limit} {$label}.",
            'mensagem'    => "Limite do plano " . cifro_plan_label($plano) . " atingido: máximo de {$limit} {$label}.",
            'plano_limit' => true,
        ]);
        cifro_terminate();
    }
}

/**
 * Simple session-based rate limiter.
 * $key   — unique key per action (e.g. 'register', 'reset_senha')
 * $limit — max attempts per $windowSeconds
 * Returns true if limit exceeded (caller should abort).
 */
function cifro_rate_limit_path(string $action, string $identity = ''): string {
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $fingerprint = hash('sha256', strtolower(trim($action)) . '|' . strtolower(trim($identity)) . '|' . $ip);
    $directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cifro-rate-limit';
    if (!is_dir($directory)) mkdir($directory, 0700, true);
    return $directory . DIRECTORY_SEPARATOR . $fingerprint . '.json';
}

function cifro_rate_limit_reset(string $action, string $identity = ''): void {
    $path = cifro_rate_limit_path($action, $identity);
    if (is_file($path)) unlink($path);
}

function cifro_rate_limit(string $action, int $limit = 5, int $windowSeconds = 300, string $identity = ''): bool {
    $path = cifro_rate_limit_path($action, $identity);
    $fingerprint = basename($path, '.json');
    $handle = fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) return true;
    $raw = stream_get_contents($handle);
    $bucket = $raw ? json_decode($raw, true) : null;
    $now = time();
    if (!is_array($bucket) || ($now - (int) ($bucket['started_at'] ?? 0)) >= $windowSeconds) {
        $bucket = ['count' => 0, 'started_at' => $now];
    }
    $bucket['count']++;
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($bucket));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    $blocked = $bucket['count'] > $limit;
    if ($blocked) {
        error_log('[security] rate_limit action=' . preg_replace('/[^a-z0-9_.-]/i', '', $action) . ' fingerprint=' . substr($fingerprint, 0, 12));
        usleep((int) min(500000, 50000 * ($bucket['count'] - $limit)));
    }
    return $blocked;
}

send_no_cache_headers();
