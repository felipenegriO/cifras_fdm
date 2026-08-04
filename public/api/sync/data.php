<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();
require_auth_json();
OperationalLogger::log('info', 'sync.data_requested', ['operation' => 'read']);

$bandaId = current_band_id();
if (!$bandaId) {
    echo json_encode(['content_revision' => 0, 'musicas' => [], 'playlists' => [], 'roteiros' => [], 'categorias' => []]);
    exit;
}

$musicaRepo   = new MusicaRepository();
$playlistRepo = new PlaylistRepository();
$roteiroRepo  = new RoteiroRepository();
$categoriaRepo = new CategoriaRepository();
$revision = (new SyncRevisionRepository())->get($bandaId);

$musicas   = $musicaRepo->getAllByBanda($bandaId);
$playlists = $playlistRepo->getAllByBanda($bandaId);
$roteiros  = $roteiroRepo->getAllByBanda($bandaId);
$categorias = $categoriaRepo->getAllByBanda($bandaId);

// Normalise for JS: match legacy field names (songs use 'nome', 'cifra', 'bit', etc.)
// Playlists: itens already decoded by repository
// Roteiros: keep as-is

$banda = $_SESSION['banda_atual'] ?? [];
OperationalLogger::log('info', 'sync.snapshot_succeeded', ['operation' => 'read', 'result' => 'success']);

// Release session lock before heavy JSON output
session_write_close();

echo json_encode([
    'content_revision' => $revision,
    'banda_id'        => $bandaId,
    'musicas'         => $musicas,
    'playlists'       => $playlists,
    'roteiros'        => $roteiros,
    'categorias'      => $categorias,
    'plano'           => $banda['plano'] ?? null,
    'trial_expira_em' => $banda['trial_expira_em'] ?? null,
], JSON_UNESCAPED_UNICODE);
