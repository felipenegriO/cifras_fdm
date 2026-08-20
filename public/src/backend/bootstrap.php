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
        // Only rewrite paths that start with / but do NOT already start with APP_BASE
        $noBase = preg_quote(ltrim($base, '/'), '/');
        // HTML attributes: href="/ src="/ action="/
        $buffer = preg_replace('/((?:href|src|action)=")\/(?!\/)(?!' . $noBase . ')/', '$1' . $base . '/', $buffer);
        // JS inline: location.href = '/' / window.location.href = "/" / fetch('/
        $buffer = preg_replace("/((?:window\.)?location(?:\.href)?\s*=\s*['\"])\/(?!\/)(?!{$noBase})/", '$1' . $base . '/', $buffer);
        // \w*fetch e case-insensitive de propósito: o app chama tanto fetch('/…')
        // quanto wrappers como cifroFetch('/…'). A regex antiga só pegava o
        // minúsculo exato, então cifroFetch escapava e a URL ia sem o prefixo —
        // 404 em deploy de subpasta, com o app parecendo funcionar no resto.
        $buffer = preg_replace("/(\w*fetch\(['\"])\/(?!\/)(?!{$noBase})/i", '$1' . $base . '/', $buffer);
        return $buffer;
    });
}

// ── Inject JS error reporter into every HTML response ───────────────────────
ob_start(function (string $buffer): string {
    if (stripos($buffer, '</body>') === false) return $buffer;
    $base = rtrim((string)getenv('APP_BASE'), '/');
    $tag = '';
    if (($_SESSION['autenticado'] ?? false) === true && stripos($buffer, 'id="cifroPwaSplash"') === false) {
        $css = htmlspecialchars(asset_url('/src/css/pwa-splash.css'), ENT_QUOTES, 'UTF-8');
        $js = htmlspecialchars(asset_url('/src/js/pwa-splash.js'), ENT_QUOTES, 'UTF-8');
        $logo = htmlspecialchars(asset_url('/src/images/pwa-splash-logo.svg'), ENT_QUOTES, 'UTF-8');
        $head = '<link rel="stylesheet" href="' . $css . '">'
            . '<script>(function(){try{var standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;var reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;var shown=sessionStorage.getItem("cifroPwaSplashShown")==="1";if(standalone&&!reduced&&!shown){document.documentElement.classList.add("cifro-pwa-splash-pending");setTimeout(function(){document.documentElement.classList.remove("cifro-pwa-splash-pending")},4200)}}catch(e){}})()</script>';
        $splash = '<div id="cifroPwaSplash" class="cifro-pwa-splash" data-logo="' . $logo . '" aria-hidden="true" hidden>'
            . '<div class="cifro-pwa-splash__ambient cifro-pwa-splash__ambient--a"></div>'
            . '<div class="cifro-pwa-splash__ambient cifro-pwa-splash__ambient--b"></div>'
            . '<div class="cifro-pwa-splash__grain"></div>'
            . '<div class="cifro-pwa-splash__brand"><div class="cifro-pwa-splash__halo"></div>'
            . '<div class="cifro-pwa-splash__logo"><canvas class="cifro-pwa-splash__logo-canvas" width="640" height="640"></canvas>'
            . '<canvas class="cifro-pwa-splash__particles" width="640" height="640"></canvas></div></div></div>';
        $buffer = str_ireplace('</head>', $head . '</head>', $buffer);
        $buffer = preg_replace('/<body([^>]*)>/i', '<body$1>' . $splash, $buffer, 1) ?? $buffer;
        $tag .= '<script src="' . $js . '"></script>';
    }
    $tag .= '<script src="' . $base . '/src/js/cifro-sw-register.js" defer></script>'
        . '<script src="' . $base . '/src/js/cifro-error-reporter.js" defer></script>';
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
    // HSTS aqui além do .htaccess: atrás do proxy da hospedagem o Apache vê
    // %{HTTPS} como "off" e a diretiva condicionada a env=HTTPS não dispara.
    // O PHP enxerga o X-Forwarded-Proto e acerta nos dois cenários.
    $__https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    if ($__https) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://www.youtube.com https://www.google-analytics.com https://region1.google-analytics.com; img-src 'self' data: https://img.youtube.com https://i.ytimg.com;");
}

// ===== Secure session cookie params =====
if (session_status() === PHP_SESSION_NONE) {
    // O timeout de inatividade da aplicação é de 8h (SESSION_IDLE_SECONDS
    // abaixo) — sem isto, o garbage collector do PHP usa o padrão de 1440s
    // (24min) e pode apagar o arquivo de sessão em disco muito antes disso,
    // derrubando a sessão sem passar pela checagem de inatividade.
    ini_set('session.gc_maxlifetime', '28800');
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
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

// ===== Login persistente via token "lembrar-me" =====
// Roda antes de qualquer require_auth: se a sessão morreu (navegador fechado,
// inatividade, coleta do GC) mas o token continua válido, a sessão é recriada
// de forma transparente. A página então já sai autenticada do servidor, o que
// mantém o cache do service worker sendo alimentado normalmente.
function cifro_tentar_login_por_token(): void {
    if (!empty($_SESSION['autenticado'])) return;

    $valor = AuthTokenCookie::ler();
    if ($valor === '') return;

    try {
        $repo    = new AuthTokenRepository();
        $service = new AuthTokenService($repo);
        $resultado = $service->validar($valor);

        if ($resultado['status'] === 'reuso_detectado') {
            // Cookie clonado: derruba a família inteira e exige senha.
            $repo->revogarTodosDoUsuario($resultado['usuarioId']);
            AuthTokenCookie::apagar();
            OperationalLogger::log('warning', 'auth.remember_token_reuse', ['result' => 'revoked']);
            return;
        }

        if ($resultado['status'] !== 'valido' && $resultado['status'] !== 'valido_concorrente') {
            AuthTokenCookie::apagar();
            return;
        }

        // Montado como em login.php: o construtor exige AuthService, mesmo que
        // a recriação por token não passe por autenticação de senha.
        $userRepository = new UserRepository();
        $controller = new AuthController(new AuthService($userRepository), $userRepository);

        // A conta é checada ANTES de rotacionar: se ela não pode mais entrar
        // (desativada, validade vencida), o token deixa de existir em vez de
        // continuar renovando o acesso de quem já foi desligado.
        if (!$controller->finalizeLoginPorToken($resultado['usuarioId'])) {
            $repo->revogarTodosDoUsuario($resultado['usuarioId']);
            AuthTokenCookie::apagar();
            OperationalLogger::log('warning', 'auth.remember_token_conta_recusada', ['result' => 'revoked']);
            return;
        }

        // 'valido_concorrente' é uma requisição irmã chegando com o validador
        // que acabou de ser substituído: autentica, mas rotacionar de novo aqui
        // invalidaria o cookie que a requisição vencedora já mandou ao navegador.
        if ($resultado['status'] === 'valido') {
            $partes = $service->parseCookie($valor);
            // Rotação condicional: se outra requisição concorrente já trocou o
            // validador, rowCount()===0 e não mexemos no cookie — sem isso as
            // duas rotacionariam e o navegador ficaria com um valor condenado.
            $novoValidador = $repo->rotacionar($partes['seletor'], $partes['validador']);
            if ($novoValidador !== null) {
                AuthTokenCookie::gravar($partes['seletor'], $novoValidador);
            }
        }

        OperationalLogger::log('info', 'auth.remember_token_used', ['result' => 'success']);
    } catch (Throwable $e) {
        // Banco fora do ar: não recria a sessão e NÃO apaga o cookie — o
        // usuário cai no fluxo normal de não autenticado e o token volta a
        // funcionar quando o banco voltar.
        return;
    }
}

cifro_tentar_login_por_token();

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

// ===== Revalidação de acesso a cada requisição =====
// A sessão é uma foto tirada no login: sozinha, ela não percebe que a conta foi
// desativada, que o músico saiu da banda ou que a banda foi desligada. Sem esta
// checagem, tirar o acesso de alguém só teria efeito quando a sessão morresse.
//
// Duas consequências bem diferentes, de propósito:
//   conta inválida  -> desconecta de vez (é a pessoa que perdeu o acesso)
//   banda inválida  -> continua logado, perde só aquela banda
function cifro_revalidar_acesso(bool $json = false): void {
    static $jaRodou = false;
    if ($jaRodou) return;                       // uma query por requisição, não por guarda
    $jaRodou = true;

    $usuarioId = (string) ($_SESSION['usuario']['id'] ?? '');
    if ($usuarioId === '') return;

    $bandaId = current_band_id();
    try {
        $estado = (new UserRepository())->estadoDeAcesso($usuarioId, $bandaId !== '' ? $bandaId : null);
    } catch (Throwable $e) {
        return; // banco fora do ar não pode deslogar todo mundo
    }

    // --- conta ---
    $usuario = $estado['usuario'];
    if ($usuario === null || (new AuthService(new UserRepository()))->motivoParaRecusarConta($usuario) !== null) {
        cifro_encerrar_acesso_da_conta($json);
        return;
    }
    // Mantém a validade da sessão alinhada com o banco, senão
    // cifro_session_user_expired() segue julgando pela foto antiga.
    $_SESSION['usuario']['validade'] = $usuario['validade'] ?? '';

    // A lista de bandas também é foto do login. Sem atualizar, quem cria uma
    // segunda banda não ganha o seletor de bandas na topnav (que decide por
    // count($_SESSION['usuario']['bandas']) > 1) até deslogar e entrar de novo.
    $_SESSION['usuario']['bandas'] = $estado['bandas'] ?? [];

    // --- banda ---
    if (is_master()) return;                     // master administra bandas inativas
    if ($bandaId === '') {
        // Sem banda selecionada — seja porque o acesso caiu numa requisição
        // anterior, seja porque ele nunca teve uma. Páginas de palco não têm o
        // que mostrar; manda escolher (ou criar) uma banda.
        cifro_exigir_banda_selecionada($json);
        return;
    }
    $motivo = BandaAcessoPolicy::motivoParaBloquear($estado['banda'], $estado['vinculo']);

    // Plano bloqueado NÃO é perda de acesso — é cobrança. A banda continua
    // sendo dele e ele precisa chegar à tela onde paga. Quem barra o palco
    // nesse caso é cifro_check_plano(), que já libera minha-banda/plano.
    // Se desselecionássemos a banda aqui, cifro_check_plano() não veria banda
    // nenhuma, a aba de plano ficaria sem o que cobrar e o administrador
    // ficaria trancado do lado de fora do próprio pagamento.
    if ($motivo === BandaAcessoPolicy::PLANO_BLOQUEADO) {
        $motivo = null;
    }

    if ($motivo === null) {
        // A sessão é uma foto do login; sem isto ela continuaria mandando
        // depois que o banco mudou. O caso que dói é o plano: o webhook do
        // Stripe libera a banda no banco e o músico seguia barrado pelo limite
        // do plano antigo até deslogar — "paguei e não liberou".
        $_SESSION['banda_atual']['perfil'] = (string) $estado['vinculo'];
        $_SESSION['banda_atual']['plano']  = (string) ($estado['banda']['plano'] ?? 'gratuito');
        $_SESSION['banda_atual']['nome']   = (string) ($estado['banda']['nome'] ?? '');
        $_SESSION['banda_atual']['trial_expira_em'] = $estado['banda']['trial_expira_em'] ?? null;
        return;
    }
    cifro_encerrar_acesso_a_banda($motivo, $json);
}

/** Conta caiu: sessão destruída, token revogado, login explica o motivo. */
function cifro_encerrar_acesso_da_conta(bool $json): void {
    $usuarioId = (string) ($_SESSION['usuario']['id'] ?? '');
    try {
        if ($usuarioId !== '') (new AuthTokenRepository())->revogarTodosDoUsuario($usuarioId);
    } catch (Throwable $e) {}
    AuthTokenCookie::apagar();

    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
    OperationalLogger::log('warning', 'auth.conta_desativada_em_sessao', ['result' => 'disconnected']);

    if ($json) {
        http_response_code(401);
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'conta_inativa', 'mensagem' => 'Sua conta foi desativada.']);
        cifro_terminate();
    }
    if (!headers_sent()) header('Location: ' . base_url('/login.php?inativo=1'));
    cifro_terminate();
}

/**
 * Sem banda selecionada: as páginas de palco mandam escolher uma.
 * Mantido separado de cifro_encerrar_acesso_a_banda porque aqui não houve
 * revogação agora — pode ser um músico que ainda não tem banda nenhuma.
 */
function cifro_exigir_banda_selecionada(bool $json): void {
    if ($json) return; // APIs já respondem 404 via require_current_band_json
    $pagina = basename((string) ($_SERVER['PHP_SELF'] ?? ''));
    if (in_array($pagina, ['select-banda.php', 'logout.php', 'login.php', 'landing.php', 'config.php', 'minha-banda.php', 'plano.php', 'plano-expirado.php', 'beta-indisponivel.php'], true)) {
        return;
    }
    if (!headers_sent()) header('Location: ' . base_url('/select-banda.php'));
    cifro_terminate();
}

/** Banda caiu: segue logado, mas sem banda selecionada. */
function cifro_encerrar_acesso_a_banda(string $motivo, bool $json): void {
    unset($_SESSION['banda_atual']);
    OperationalLogger::log('warning', 'auth.acesso_banda_revogado', ['result' => 'blocked', 'motivo' => $motivo]);

    if ($json) {
        http_response_code(403);
        if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => false, 'sucesso' => false, 'error' => 'banda_sem_acesso',
            'motivo' => $motivo,
            'mensagem' => 'Você não tem mais acesso a esta banda: ' . BandaAcessoPolicy::rotulo($motivo) . '.',
        ]);
        cifro_terminate();
    }

    // Páginas que precisam funcionar SEM banda não podem redirecionar para si
    // mesmas — senão o músico entra num laço.
    $pagina = basename((string) ($_SERVER['PHP_SELF'] ?? ''));
    if (in_array($pagina, ['select-banda.php', 'logout.php', 'login.php', 'landing.php', 'config.php', 'minha-banda.php', 'plano.php', 'plano-expirado.php', 'beta-indisponivel.php'], true)) {
        return;
    }
    if (!headers_sent()) header('Location: ' . base_url('/select-banda.php?semacesso=' . urlencode($motivo)));
    cifro_terminate();
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
    cifro_revalidar_acesso(true);
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

    cifro_revalidar_acesso(false);

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
        // Além das telas de pagamento, precisam continuar de pé as duas saídas:
        // trocar de banda (quem tem outra não pode ficar preso na que deve) e
        // sair da conta.
        $liberadas = ['plano-expirado.php', 'plano.php', 'minha-banda.php', 'select-banda.php', 'logout.php'];
        if (!in_array(basename($_SERVER['PHP_SELF'] ?? ''), $liberadas, true)) {
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

function has_active_band_plan(): bool {
    $band = $_SESSION['banda_atual'] ?? [];
    return (int)($band['ativo'] ?? 1) === 1
        && in_array((string)($band['plano'] ?? ''), ['mensal', 'semestral', 'anual', 'ativo'], true);
}

function can_manage_bands(): bool {
    return is_master() || (current_band_role() === 'administrador' && has_active_band_plan());
}

function help_center_enabled(): bool {
    return filter_var(env('HELP_CENTER_ENABLED', 'true'), FILTER_VALIDATE_BOOLEAN);
}

function help_center_disabled_for_user(?array $user = null): bool {
    $user ??= $_SESSION['usuario'] ?? [];
    $value = $user['config']['ajudaDesativada'] ?? 'false';
    return $value === true || $value === 'true' || $value === 1 || $value === '1';
}

function help_center_visible_for_user(?array $user = null): bool {
    return help_center_enabled() && !help_center_disabled_for_user($user);
}

/**
 * Preferências de capotraste/transpose do usuário, para injetar no JS.
 * Chave ausente vale null: é o que dispara o modal de primeiro acesso. Vai
 * embutido na página em vez de por fetch porque a tela de música precisa do
 * valor já no primeiro render, inclusive offline.
 */
function cifro_transposicao_config(?array $user = null): array {
    $user ??= $_SESSION['usuario'] ?? [];
    $config = $user['config'] ?? [];
    $instrumento = $config['instrumento'] ?? null;
    $preferencia = $config['transposicaoPreferencia'] ?? null;
    return [
        'instrumento' => is_string($instrumento) && TransposicaoInstrumento::instrumentoValido($instrumento)
            ? $instrumento : null,
        'transposicaoPreferencia' => is_string($preferencia) && in_array($preferencia, TransposicaoInstrumento::PREFERENCIAS, true)
            ? $preferencia : null,
    ];
}

function can_host_live(): bool {
    return current_band_id() !== '' && (is_master() || in_array(current_band_role(), ['basico', 'gestor', 'administrador'], true));
}

function require_live_host(): void {
    require_current_band_json();
    if (!can_host_live()) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'Permissão insuficiente.', 'mensagem' => 'Permissão insuficiente.']);
        cifro_terminate();
    }
}

/** Aborts with 403 JSON if caller doesn't have $minRole within current band. */
function require_band_role(string $minRole): void {
    require_current_band_json();
    $order = ['externo' => 0, 'basico' => 0, 'gestor' => 1, 'administrador' => 2];
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
    $map = ['administrador' => 'administrador', 'gestor' => 'administrador', 'basico' => 'musico', 'externo' => 'externo'];
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

function band_logo_url(?string $logo): string {
    $logo = trim((string)$logo);
    if ($logo === '') return asset_url('/src/images/cifro-mark.svg');
    if (str_starts_with($logo, 'data:') || preg_match('#^https?://#i', $logo)) return $logo;
    if (str_starts_with($logo, '/')) return base_url($logo);
    return $logo;
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
