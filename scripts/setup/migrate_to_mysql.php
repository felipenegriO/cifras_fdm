<?php
/**
 * migrate_to_mysql.php — StageBox Phase 1 Migration
 *
 * Reads: src/js/musicas.js, src/js/playlists_salvas.js,
 *        src/js/roteiros_salvos.js, src/backend/users/usuarios.json
 * Writes: MySQL tables bandas, usuarios, usuario_banda, musicas, playlists, roteiros
 *
 * Safe to run multiple times — uses INSERT IGNORE / REPLACE where possible,
 * skips tables that already have data.
 *
 * Usage: php migrate_to_mysql.php [--force]
 *   --force  Truncate and re-insert all data (dangerous if already in production)
 */

define('ROOT', __DIR__);
require_once ROOT . '/config/env.php';
require_once ROOT . '/src/Services/Database.php';

set_time_limit(120);
$force = in_array('--force', $argv ?? [], true);

$pdo = Database::getConnection();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

log_msg("=== StageBox Migration ===");

// ---------- helpers ----------

function log_msg(string $msg): void {
    echo $msg . PHP_EOL;
}

function abort(string $msg): never {
    echo "ERROR: $msg" . PHP_EOL;
    exit(1);
}

function parse_js_var(string $file, string $varName): array {
    if (!file_exists($file)) {
        abort("File not found: $file");
    }
    $js = file_get_contents($file);

    // Strip JS variable declaration and trailing semicolons/whitespace
    $js = preg_replace('/^\s*(var|const|let)\s+' . preg_quote($varName, '/') . '\s*=\s*/s', '', $js);
    $js = rtrim(trim($js), ';');

    // Convert single-quoted JS strings to double-quoted JSON where needed
    // (musicas.js uses double-quotes already, but just in case)

    $data = json_decode($js, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        abort("JSON parse error in $file: " . json_last_error_msg());
    }
    return is_array($data) ? $data : [];
}

function generate_uuid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// ---------- load source data ----------

$musicas    = parse_js_var(ROOT . '/src/js/musicas.js',         'songs');
$playlists  = parse_js_var(ROOT . '/src/js/playlists_salvas.js','playlistsSalvas');
$roteiros   = parse_js_var(ROOT . '/src/js/roteiros_salvos.js', 'roteirosSalvos');

$usuariosFile = ROOT . '/src/backend/users/usuarios.json';
if (!file_exists($usuariosFile)) abort("usuarios.json not found.");
$usuariosJson = json_decode(file_get_contents($usuariosFile), true);
if (!is_array($usuariosJson)) abort("Invalid usuarios.json.");

log_msg("Source data: " . count($musicas) . " músicas, " . count($playlists) . " playlists, " .
        count($roteiros) . " roteiros, " . count($usuariosJson) . " usuários");

// ---------- check existing data ----------

if (!$force) {
    $bandaCount = (int)$pdo->query('SELECT COUNT(*) FROM bandas')->fetchColumn();
    if ($bandaCount > 0) {
        log_msg("Tables already populated ($bandaCount bandas). Use --force to re-run.");
        exit(0);
    }
}

// ---------- truncate if --force ----------

if ($force) {
    log_msg("--force: truncating tables...");
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    foreach (['live_state','roteiros','playlists','musicas','usuario_banda','usuarios','bandas'] as $t) {
        $pdo->exec("TRUNCATE TABLE `$t`");
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
}

// ---------- create banda padrão ----------

$bandaId   = generate_uuid();
$bandaNome = 'Filhos de Maria';

$pdo->prepare(
    'INSERT INTO bandas (id, nome, ativo, plano, trial_expira_em) VALUES (?,?,1,?,?)'
)->execute([$bandaId, $bandaNome, 'ativo', null]);

log_msg("Banda criada: $bandaNome ($bandaId)");

// ---------- migrate users ----------

$perfilMap = [
    'administrador' => ['perfil' => 'master',  'banda_perfil' => 'administrador'],
    'musico'        => ['perfil' => 'usuario',  'banda_perfil' => 'basico'],
    'externo'       => ['perfil' => 'usuario',  'banda_perfil' => 'basico'],
    'master'        => ['perfil' => 'master',   'banda_perfil' => 'administrador'],
    'gestor'        => ['perfil' => 'usuario',  'banda_perfil' => 'gestor'],
    'basico'        => ['perfil' => 'usuario',  'banda_perfil' => 'basico'],
];

$insUser = $pdo->prepare(
    'INSERT INTO usuarios (id, nome, username, senha_hash, perfil, ativo, validade, config)
     VALUES (?,?,?,?,?,?,?,?)'
);
$insUB = $pdo->prepare(
    'INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)'
);

foreach ($usuariosJson as $u) {
    $id       = $u['id'] ?? generate_uuid();
    $nome     = $u['nome'] ?? '';
    $username = $u['username'] ?? '';
    $hash     = $u['senhaHash'] ?? $u['senha_hash'] ?? null;
    $ativo    = (int)(bool)($u['ativo'] ?? true);
    $validade = ($u['validade'] ?? '') ?: null;
    $config   = isset($u['config']) && is_array($u['config'])
                ? json_encode($u['config'], JSON_UNESCAPED_UNICODE)
                : null;

    $perfilOriginal = strtolower(trim($u['perfil'] ?? 'administrador'));
    $map = $perfilMap[$perfilOriginal] ?? $perfilMap['administrador'];

    $insUser->execute([$id, $nome, $username, $hash, $map['perfil'], $ativo, $validade, $config]);
    $insUB->execute([$id, $bandaId, $map['banda_perfil']]);

    log_msg("  Usuário: $username ({$map['perfil']} / banda:{$map['banda_perfil']})");
}

// ---------- migrate músicas ----------

$insMusica = $pdo->prepare(
    'INSERT INTO musicas (id, banda_id, nome, artista, classificacao, cifra, bit)
     VALUES (?,?,?,?,?,?,?)'
);

foreach ($musicas as $m) {
    $insMusica->execute([
        (int)($m['id'] ?? 0),
        $bandaId,
        $m['nome'] ?? '',
        $m['artista'] ?? '',
        $m['classificacao'] ?? '',
        $m['cifra'] ?? '',
        $m['bit'] ?? '',
    ]);
}

// Reset AUTO_INCREMENT to continue after existing IDs
$maxId = (int)$pdo->query('SELECT MAX(id) FROM musicas')->fetchColumn();
$pdo->exec("ALTER TABLE musicas AUTO_INCREMENT=" . ($maxId + 1));

log_msg("Músicas migradas: " . count($musicas) . " (próximo id: " . ($maxId + 1) . ")");

// ---------- migrate playlists ----------

$insPlaylist = $pdo->prepare(
    'INSERT INTO playlists (banda_id, nome, visivel_ate, itens) VALUES (?,?,?,?)'
);

foreach ($playlists as $p) {
    $insPlaylist->execute([
        $bandaId,
        $p['nome'] ?? '',
        ($p['visivel_ate'] ?? '') ?: null,
        json_encode($p['itens'] ?? [], JSON_UNESCAPED_UNICODE),
    ]);
}
log_msg("Playlists migradas: " . count($playlists));

// ---------- migrate roteiros ----------

$insRoteiro = $pdo->prepare(
    'INSERT INTO roteiros (banda_id, titulo, conteudo, visivel_ate) VALUES (?,?,?,?)'
);

foreach ($roteiros as $r) {
    $insRoteiro->execute([
        $bandaId,
        $r['titulo'] ?? '',
        $r['conteudo'] ?? '',
        ($r['visivel_ate'] ?? '') ?: null,
    ]);
}
log_msg("Roteiros migrados: " . count($roteiros));

// ---------- initialize live_state ----------

$pdo->prepare(
    'INSERT IGNORE INTO live_state (banda_id, version) VALUES (?,0)'
)->execute([$bandaId]);
log_msg("Live state inicializado.");

// ---------- save banda_id to a file for reference ----------

file_put_contents(ROOT . '/src/backend/data/banda_padrao_id.txt', $bandaId);
log_msg("banda_padrao_id.txt criado: $bandaId");

log_msg("=== Migração concluída com sucesso! ===");
