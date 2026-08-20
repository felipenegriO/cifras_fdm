<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
send_no_cache_headers();
require_band_role('gestor');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método não permitido.']);
    exit;
}
require_csrf();

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode(['ok' => false, 'error' => 'JSON inválido: ' . json_last_error_msg()]);
    exit;
}

$bandaId = current_band_id();
$repo    = new MusicaRepository();
$revisionRepo = new SyncRevisionRepository();
$baseRevision = $data['baseRevision'] ?? null;

// ----- COPY -----
if (($data['action'] ?? '') === 'copy') {
    if (!isset($data['id']) || !is_numeric($data['id'])) {
        echo json_encode(['ok' => false, 'error' => 'ID inválido']);
        exit;
    }
    cifro_require_plan_limit('musicas', $repo->countByBanda($bandaId));
    try {
        $mutation = $revisionRepo->mutate($bandaId, $baseRevision, fn() => $repo->copy((int)$data['id'], $bandaId), fn($id) => [['type' => 'musica', 'id' => $id, 'operation' => 'upsert']]);
        echo json_encode(['ok' => true, 'id' => $mutation['result'], 'musica' => $repo->findById($mutation['result'], $bandaId), 'content_revision' => $mutation['revision']]);
    } catch (SyncConflictException $e) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'content_revision' => $e->getCurrentRevision()]);
    } catch (RuntimeException $e) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// ----- DELETE -----
if (($data['action'] ?? '') === 'delete') {
    if (!isset($data['id']) || !is_numeric($data['id'])) {
        echo json_encode(['ok' => false, 'error' => 'ID inválido']);
        exit;
    }
    try {
        $mutation = $revisionRepo->mutate($bandaId, $baseRevision, fn() => $repo->delete((int)$data['id'], $bandaId), [['type' => 'musica', 'id' => (int)$data['id'], 'operation' => 'delete']]);
        echo json_encode(['ok' => true, 'content_revision' => $mutation['revision']]);
    } catch (SyncConflictException $e) {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'content_revision' => $e->getCurrentRevision()]);
    } catch (RuntimeException $e) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// ----- SAVE (create or update) -----
if (!isset($data['nome'], $data['cifra'])) {
    echo json_encode(['ok' => false, 'error' => 'Dados incompletos']);
    exit;
}
$nome = trim((string)$data['nome']);
if ($nome === '' || mb_strlen($nome) > 200 || mb_strlen((string)($data['artista'] ?? '')) > 200 || mb_strlen((string)($data['bit'] ?? '')) > 50) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Dados da música inválidos.']);
    exit;
}

// Only check limit when creating (no id = new music)
if (empty($data['id'])) {
    $songCountBeforeCreate = $repo->countByBanda($bandaId);
    cifro_require_plan_limit('musicas', $songCountBeforeCreate);
}

$data['cifra'] = ChordSaveNormalizer::normalizar($data['cifra']);
$classificacao = trim((string)($data['classificacao'] ?? ''));
if ($classificacao !== '' && !(new CategoriaRepository())->existsByName($classificacao, $bandaId)) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Selecione uma categoria cadastrada.']);
    exit;
}

$sourceUrl = filter_var((string)($data['source_url'] ?? ''), FILTER_VALIDATE_URL) ?: null;

if ($sourceUrl && empty($data['confirm_overwrite'])) {
    $currentId = !empty($data['id']) ? (int)$data['id'] : null;
    $duplicate = $repo->findBySourceUrl($sourceUrl, $bandaId, $currentId);
    if ($duplicate) {
        echo json_encode([
            'ok' => false,
            'duplicate' => true,
            'existing' => ['id' => $duplicate['id'], 'nome' => $duplicate['nome']],
            'error' => 'Já existe a música "' . $duplicate['nome'] . '" cadastrada com esse link.',
        ]);
        exit;
    }
}

$transposicao = TransposicaoInstrumento::normalizar($data['transposicao_instrumento'] ?? 0);
if ($transposicao === null) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Deslocamento de instrumento inválido.']);
    exit;
}

$payload = [
    'id' => $data['id'] ?? null, 'nome' => $nome, 'cifra' => $data['cifra'],
    'bit' => $data['bit'] ?? '', 'artista' => $data['artista'] ?? '', 'classificacao' => $classificacao,
    'source_url' => $sourceUrl, 'transposicao_instrumento' => $transposicao,
];
try {
    $mutation = $revisionRepo->mutate($bandaId, $baseRevision, fn() => $repo->save($payload, $bandaId), fn($id) => [['type' => 'musica', 'id' => $id, 'operation' => 'upsert']]);
    $newId = $mutation['result'];
} catch (SyncConflictException $e) {
    http_response_code(409);
    echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'content_revision' => $e->getCurrentRevision()]);
    exit;
} catch (RuntimeException $e) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    exit;
}

if (empty($data['id'])) {
    OperationalLogger::log('info', $songCountBeforeCreate === 0 ? 'activation.first_song_created' : 'song.created', ['operation' => 'create', 'result' => 'success']);
} else {
    OperationalLogger::log('info', 'song.updated', ['operation' => 'update', 'result' => 'success']);
}

echo json_encode([
    'ok'      => true,
    'id'      => $newId,
    'created' => empty($data['id']),
    'musica' => $repo->findById($newId, $bandaId),
    'content_revision' => $mutation['revision'],
]);
