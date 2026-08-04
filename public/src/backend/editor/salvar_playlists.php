<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
send_no_cache_headers();
require_band_role('gestor');
require_csrf();

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['sucesso' => false, 'mensagem' => 'JSON inválido.']);
    exit;
}

$playlists = PlaylistFormValidator::normalizarEntrada($data);
if ($playlists === null) {
    http_response_code(400);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Estrutura inválida.']);
    exit;
}

$musicIds = [];
$playlistNames = [];
foreach ($playlists as $playlist) {
    if (!is_array($playlist)) {
        http_response_code(422);
        echo json_encode(['sucesso' => false, 'mensagem' => 'Playlist inválida.']);
        exit;
    }
    $nome = trim((string)($playlist['nome'] ?? ''));
    $itens = $playlist['itens'] ?? null;
    $visivelAte = trim((string)($playlist['visivel_ate'] ?? ''));
    if (!PlaylistFormValidator::isNomeEItensValidos($nome, $itens)) {
        http_response_code(422);
        echo json_encode(['sucesso' => false, 'mensagem' => 'Nome ou itens da playlist inválidos.']);
        exit;
    }
    $normalizedName = mb_strtolower($nome);
    if (isset($playlistNames[$normalizedName])) {
        http_response_code(422);
        echo json_encode(['sucesso' => false, 'mensagem' => 'Não é permitido repetir o nome da playlist.']);
        exit;
    }
    $playlistNames[$normalizedName] = true;
    if (!PlaylistFormValidator::isVisivelAteValido($visivelAte)) {
        http_response_code(422);
        echo json_encode(['sucesso' => false, 'mensagem' => 'Data de visibilidade inválida.']);
        exit;
    }
    foreach ($itens as $item) {
        $id = PlaylistFormValidator::validarItem($item);
        if ($id === null) {
            http_response_code(422);
            echo json_encode(['sucesso' => false, 'mensagem' => 'Música ou tom inválido na playlist.']);
            exit;
        }
        $musicIds[$id] = true;
    }
}

$bandaId = current_band_id();

if ($musicIds) {
    $ids = array_keys($musicIds);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = Database::getConnection()->prepare("SELECT COUNT(*) FROM musicas WHERE banda_id = ? AND id IN ($placeholders)");
    $stmt->execute(array_merge([$bandaId], $ids));
    if ((int)$stmt->fetchColumn() !== count($ids)) {
        http_response_code(422);
        echo json_encode(['sucesso' => false, 'mensagem' => 'A playlist contém música inexistente nesta banda.']);
        exit;
    }
}

$limits = cifro_plan_limits($_SESSION['banda_atual']['plano'] ?? 'bloqueado');
$maxPlaylists = PlaylistFormValidator::computeMaxPlaylists(is_master(), $limits);
if (PlaylistFormValidator::excedeLimite($maxPlaylists, count($playlists))) {
    $planoLabel = PlaylistFormValidator::planoLabel($_SESSION['banda_atual']['plano'] ?? '');
    http_response_code(403);
    echo json_encode([
        'sucesso'     => false,
        'mensagem'    => "Limite do plano {$planoLabel}: máximo de {$maxPlaylists} playlist(s).",
        'plano_limit' => true,
    ]);
    exit;
}

try {
    $repo = new PlaylistRepository();
    $mutation = (new SyncRevisionRepository())->mutate(
        $bandaId,
        $data['baseRevision'] ?? null,
        fn() => $repo->saveAll($playlists, $bandaId)
    );
    echo json_encode(['sucesso' => true, 'mensagem' => 'Playlists salvas com sucesso!', 'content_revision' => $mutation['revision']]);
} catch (SyncConflictException $e) {
    http_response_code(409);
    echo json_encode(['sucesso' => false, 'mensagem' => $e->getMessage(), 'content_revision' => $e->getCurrentRevision()]);
}
