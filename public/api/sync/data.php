<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();
require_auth_json();

$bandaId = $_GET['banda_id'] ?? current_band_id();
if (!$bandaId) {
    echo json_encode(['version' => 0, 'musicas' => [], 'playlists' => [], 'roteiros' => []]);
    exit;
}

$musicaRepo   = new MusicaRepository();
$playlistRepo = new PlaylistRepository();
$roteiroRepo  = new RoteiroRepository();

$musicas   = $musicaRepo->getAllByBanda($bandaId);
$playlists = $playlistRepo->getAllByBanda($bandaId);
$roteiros  = $roteiroRepo->getAllByBanda($bandaId);

// Normalise for JS: match legacy field names (songs use 'nome', 'cifra', 'bit', etc.)
// Playlists: itens already decoded by repository
// Roteiros: keep as-is

$banda = $_SESSION['banda_atual'] ?? [];

// Release session lock before heavy JSON output
session_write_close();

echo json_encode([
    'version'         => $musicaRepo->getVersion($bandaId),
    'musicas'         => $musicas,
    'playlists'       => $playlists,
    'roteiros'        => $roteiros,
    'plano'           => $banda['plano'] ?? null,
    'trial_expira_em' => $banda['trial_expira_em'] ?? null,
], JSON_UNESCAPED_UNICODE);
