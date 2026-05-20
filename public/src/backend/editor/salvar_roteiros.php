<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
send_no_cache_headers();
require_band_role('gestor');
require_csrf();

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON inválido.']);
    exit;
}

$bandaId = current_band_id();
$repo    = new RoteiroRepository();

// ----- DELETE -----
if (isset($data['deleteId'])) {
    $repo->delete((int)$data['deleteId'], $bandaId);
    echo json_encode(['ok' => true]);
    exit;
}

// ----- SAVE (create or update) -----
if (!isset($data['titulo'], $data['conteudo'])) {
    echo json_encode(['ok' => false, 'error' => 'Dados incompletos.']);
    exit;
}

$conteudo  = preg_replace('/\r?\n/', '<br/>', (string)$data['conteudo']);
$conteudo  = preg_replace('/<br\s*?>/i', '<br/>', $conteudo);
$visivelAte = ($data['visivel_ate'] ?? '') ?: null;

$existing = isset($data['id']) ? $repo->findById((int)$data['id'], $bandaId) : null;

if ($existing) {
    // Update via saveAll replacement approach — simpler: use a dedicated save method
    // RoteiroRepository doesn't have save-single yet; add inline here
    $pdo = Database::getConnection();
    $stmt = $pdo->prepare(
        'UPDATE roteiros SET titulo=?, conteudo=?, visivel_ate=? WHERE id=? AND banda_id=?'
    );
    $stmt->execute([$data['titulo'], $conteudo, $visivelAte, (int)$data['id'], $bandaId]);
    echo json_encode(['ok' => true, 'id' => (int)$data['id']]);
} else {
    $pdo = Database::getConnection();
    $stmt = $pdo->prepare(
        'INSERT INTO roteiros (banda_id, titulo, conteudo, visivel_ate) VALUES (?,?,?,?)'
    );
    $stmt->execute([$bandaId, $data['titulo'], $conteudo, $visivelAte]);
    echo json_encode(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
}
