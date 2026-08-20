<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();
require_auth_json();

$bandaId = current_band_id();
if (!$bandaId) {
    echo json_encode(['content_revision' => 0]);
    exit;
}

$revision = (new SyncRevisionRepository())->get($bandaId);
// A personalização do músico viaja junto porque vive FORA da revisão da banda:
// se ela só viesse quando a revisão anda, uma escolha feita em outro aparelho
// nunca chegaria enquanto ninguém editasse o repertório.
$preferencias = (new UsuarioMusicaRepository())->listarPorUsuario(
    (string) ($_SESSION['usuario']['id'] ?? ''),
    $bandaId
);
session_write_close();
echo json_encode([
    'content_revision' => $revision,
    'banda_id' => $bandaId,
    'preferencias_musica' => $preferencias,
], JSON_UNESCAPED_UNICODE);
