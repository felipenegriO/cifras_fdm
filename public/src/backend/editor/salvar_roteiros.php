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

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON inválido.']);
    exit;
}

$bandaId = current_band_id();
$repo    = new RoteiroRepository();
$revisionRepo = new SyncRevisionRepository();
$baseRevision = $data['baseRevision'] ?? null;

// ----- DELETE -----
if (isset($data['deleteId'])) {
    try {
        $mutation = $revisionRepo->mutate($bandaId, $baseRevision, fn() => $repo->delete((int)$data['deleteId'], $bandaId));
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
if (!isset($data['titulo'], $data['conteudo'])) {
    echo json_encode(['ok' => false, 'error' => 'Dados incompletos.']);
    exit;
}
$titulo = trim((string)$data['titulo']);
if (!RoteiroFormValidator::isValido($titulo, (string)$data['conteudo'])) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Dados do roteiro inválidos.']);
    exit;
}

$conteudo  = RoteiroFormValidator::normalizarConteudo((string)$data['conteudo']);
$visivelAte = ($data['visivel_ate'] ?? '') ?: null;

$existing = isset($data['id']) ? $repo->findById((int)$data['id'], $bandaId) : null;
if (isset($data['id']) && !$existing) {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Roteiro não encontrado.']);
    exit;
}

$pdo = Database::getConnection();
try {
    $mutation = $revisionRepo->mutate($bandaId, $baseRevision, function () use ($existing, $data, $titulo, $conteudo, $visivelAte, $bandaId, $pdo) {
        if ($existing) {
            $stmt = $pdo->prepare('UPDATE roteiros SET titulo=?, conteudo=?, visivel_ate=? WHERE id=? AND banda_id=?');
            $stmt->execute([$titulo, $conteudo, $visivelAte, (int)$data['id'], $bandaId]);
            return (int)$data['id'];
        }
        $stmt = $pdo->prepare('INSERT INTO roteiros (banda_id, titulo, conteudo, visivel_ate) VALUES (?,?,?,?)');
        $stmt->execute([$bandaId, $titulo, $conteudo, $visivelAte]);
        return (int)$pdo->lastInsertId();
    });
    echo json_encode(['ok' => true, 'id' => $mutation['result'], 'roteiro' => $repo->findById($mutation['result'], $bandaId), 'content_revision' => $mutation['revision']]);
} catch (SyncConflictException $e) {
    http_response_code(409);
    echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'content_revision' => $e->getCurrentRevision()]);
}
