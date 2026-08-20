<?php
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();
require_auth_json();

$bandaId = current_band_id();
$since = filter_input(INPUT_GET, 'since', FILTER_VALIDATE_INT);
if (!$bandaId || $since === false || $since === null || $since < 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Revisão inválida.']);
    exit;
}

$revisionRepo = new SyncRevisionRepository();
$current = $revisionRepo->get($bandaId);
// Vai em todas as respostas: a personalizacao do musico nao participa da
// revisao da banda, entao o caminho incremental precisa recebe-la sempre.
$preferencias = (new UsuarioMusicaRepository())->listarPorUsuario(
    (string) ($_SESSION['usuario']['id'] ?? ''),
    $bandaId
);
if ($since >= $current) {
    session_write_close();
    echo json_encode(['banda_id' => $bandaId, 'from_revision' => $since, 'content_revision' => $current, 'full_sync_required' => false, 'changes' => [], 'preferencias_musica' => $preferencias]);
    exit;
}

$rows = $revisionRepo->changesSince($bandaId, $since);
if (!$rows || (int)$rows[0]['revision'] !== $since + 1 || (int)$rows[count($rows) - 1]['revision'] !== $current) {
    session_write_close();
    echo json_encode(['banda_id' => $bandaId, 'from_revision' => $since, 'content_revision' => $current, 'full_sync_required' => true, 'preferencias_musica' => $preferencias]);
    exit;
}

$latest = [];
foreach ($rows as $row) $latest[$row['entity_type'] . ':' . $row['entity_id']] = $row;
$musicaRepo = new MusicaRepository();
$roteiroRepo = new RoteiroRepository();
$changes = [
    'musicas' => ['upsert' => [], 'deleted' => []],
    'roteiros' => ['upsert' => [], 'deleted' => []],
];
$replaceMusicas = false;
$replacePlaylists = false;
$replaceCategorias = false;
foreach ($latest as $row) {
    $id = (int)$row['entity_id'];
    if ($row['entity_type'] === 'musica') {
        if ($row['operation'] === 'replace') $replaceMusicas = true;
        elseif ($row['operation'] === 'delete') $changes['musicas']['deleted'][] = $id;
        else {
            $item = $musicaRepo->findById($id, $bandaId);
            if ($item) $changes['musicas']['upsert'][] = $item;
        }
    } elseif ($row['entity_type'] === 'roteiro') {
        if ($row['operation'] === 'delete') $changes['roteiros']['deleted'][] = $id;
        else {
            $item = $roteiroRepo->findById($id, $bandaId);
            if ($item) $changes['roteiros']['upsert'][] = $item;
        }
    } elseif ($row['entity_type'] === 'playlist') $replacePlaylists = true;
    elseif ($row['entity_type'] === 'categoria') $replaceCategorias = true;
}
if ($replaceMusicas) $changes['musicas'] = ['replace' => $musicaRepo->getAllByBanda($bandaId)];
if ($replacePlaylists) $changes['playlists'] = ['replace' => (new PlaylistRepository())->getAllByBanda($bandaId)];
if ($replaceCategorias) $changes['categorias'] = ['replace' => (new CategoriaRepository())->getAllByBanda($bandaId)];

session_write_close();
echo json_encode(['banda_id' => $bandaId, 'from_revision' => $since, 'content_revision' => $current, 'full_sync_required' => false, 'changes' => $changes, 'preferencias_musica' => $preferencias], JSON_UNESCAPED_UNICODE);
