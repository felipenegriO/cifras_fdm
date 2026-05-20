<?php
// Prevent session file corruption when client disconnects mid-request
ignore_user_abort(true);

require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/backup_helpers.php';
require_once __DIR__ . '/../Views/partials/icons.php';

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

// ===== Security headers =====
if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; img-src 'self' data:;");
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

function require_auth_json() {
    if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Nao autenticado.', 'mensagem' => 'Nao autenticado.']);
        exit;
    }
    if (fdm_session_user_expired()) {
        $_SESSION = [];
        session_destroy();
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Sessao expirada.', 'mensagem' => 'Sessao expirada.']);
        exit;
    }
}

function require_admin_json() {
    require_auth_json();
    if (!current_user_is_admin()) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Acesso restrito ao administrador.', 'mensagem' => 'Acesso restrito ao administrador.']);
        exit;
    }
}

function require_csrf() {
    $expected = $_SESSION['csrf_token'] ?? '';
    $received = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? '');
    if (!is_string($expected) || $expected === '' || !is_string($received) || !hash_equals($expected, $received)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Token CSRF inválido.', 'mensagem' => 'Token CSRF inválido.']);
        exit;
    }
}

function send_no_cache_headers() {
    header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
    header("Pragma: no-cache");
    header("Expires: 0");
}

function require_auth() {
    if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true) {
        header('Location: /landing.php');
        exit;
    }

    if (fdm_session_user_expired()) {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        header('Location: /login.php?expirado=1');
        exit;
    }

    fdm_check_plano();
}

function fdm_check_plano(): void {
    $banda = $_SESSION['banda_atual'] ?? [];
    if (empty($banda['id'])) return; // no band selected yet, let select-banda handle it

    $plano = $banda['plano'] ?? 'trial';
    if ($plano === 'bloqueado') {
        if (basename($_SERVER['PHP_SELF'] ?? '') !== 'plano-expirado.php') {
            header('Location: /plano-expirado.php');
            exit;
        }
        return;
    }
    if ($plano === 'trial' || $plano === 'gratuito') {
        $expira = $banda['trial_expira_em'] ?? '';
        if ($expira && strtotime($expira) < strtotime('today')) {
            $repo = new BandaRepository();
            $repo->marcarBloqueada($banda['id']);
            $_SESSION['banda_atual']['plano'] = 'bloqueado';
            header('Location: /plano-expirado.php');
            exit;
        }
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
    require_auth_json();
    $order = ['basico' => 0, 'gestor' => 1, 'administrador' => 2];
    $required = $order[$minRole] ?? 0;
    $actual   = is_master() ? 99 : ($order[current_band_role()] ?? 0);
    if ($actual < $required) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Permissão insuficiente.', 'mensagem' => 'Permissão insuficiente.']);
        exit;
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
    if (can_manage_band_users()) return true;
    // Legacy fallback: sessions created before multi-band migration
    $legacyPerfil = strtolower(trim((string)($_SESSION['usuario']['perfil'] ?? '')));
    return $legacyPerfil === 'administrador';
}

function require_admin(): void {
    require_auth();
    if (!current_user_is_admin()) {
        http_response_code(403);
        echo 'Acesso restrito ao administrador.';
        exit;
    }
}

function fdm_session_user_expired(): bool {
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

function asset_url($path) {
    $path = (string) $path;
    if ($path === '') {
        return $path;
    }

    $filePath = $path[0] === '/' ? ($_SERVER['DOCUMENT_ROOT'] . $path) : $path;
    if (file_exists($filePath)) {
        return $path . '?v=' . filemtime($filePath);
    }

    return $path;
}

function render_view($view, $data = []) {
    $view = trim((string) $view, '/');
    $viewPath = __DIR__ . '/../Views/' . $view . '.php';
    if (!file_exists($viewPath)) {
        http_response_code(500);
        echo 'View not found.';
        exit;
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
        exit;
    }

    if (is_array($data)) {
        extract($data, EXTR_SKIP);
    }

    require $partialPath;
}

// ---------- Plan limits ----------

/**
 * Returns resource limits for a given plan.
 * -1 means unlimited.
 */
function fdm_plan_limits(string $plano): array {
    return match($plano) {
        'gratuito' => ['users' => 1, 'musicas' => 10,  'playlists' => 0],
        'basico'   => ['users' => 1, 'musicas' => 50,  'playlists' => 1],
        'banda'    => ['users' => -1, 'musicas' => -1, 'playlists' => -1],
        'trial'    => ['users' => -1, 'musicas' => -1, 'playlists' => -1],
        'ativo'    => ['users' => -1, 'musicas' => -1, 'playlists' => -1], // legado
        default    => ['users' => 0,  'musicas' => 0,  'playlists' => 0],  // bloqueado
    };
}

/**
 * Checks if a resource limit has been reached for the current band.
 * Aborts with 403 JSON if limit exceeded.
 * $resource: 'musicas' | 'playlists' | 'users'
 * $currentCount: current count (caller queries the DB)
 */
function fdm_require_plan_limit(string $resource, int $currentCount): void {
    $plano  = $_SESSION['banda_atual']['plano'] ?? 'bloqueado';
    $limits = fdm_plan_limits($plano);
    $limit  = $limits[$resource] ?? 0;
    if ($limit === -1) return; // unlimited
    if ($currentCount >= $limit) {
        $labels = ['musicas' => 'músicas', 'playlists' => 'playlists', 'users' => 'usuários'];
        $label  = $labels[$resource] ?? $resource;
        $planoLabel = match($plano) {
            'gratuito' => 'Gratuito', 'basico' => 'Básico', default => $plano,
        };
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'       => false,
            'sucesso'  => false,
            'error'    => "Limite do plano {$planoLabel} atingido: máximo de {$limit} {$label}.",
            'mensagem' => "Limite do plano {$planoLabel} atingido: máximo de {$limit} {$label}.",
            'plano_limit' => true,
        ]);
        exit;
    }
}

/**
 * Simple session-based rate limiter.
 * $key   — unique key per action (e.g. 'register', 'reset_senha')
 * $limit — max attempts per $windowSeconds
 * Returns true if limit exceeded (caller should abort).
 */
function fdm_rate_limit(string $key, int $limit = 5, int $windowSeconds = 300): bool {
    $bucket = &$_SESSION["_rl_$key"];
    if (!isset($bucket) || (time() - ($bucket['t'] ?? 0)) > $windowSeconds) {
        $bucket = ['c' => 0, 't' => time()];
    }
    $bucket['c']++;
    return $bucket['c'] > $limit;
}

send_no_cache_headers();
