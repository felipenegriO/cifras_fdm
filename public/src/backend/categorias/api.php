<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método não permitido.']);
    exit;
}
require_band_role('gestor');

$repo = new CategoriaRepository();
$bandaId = current_band_id();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(['ok' => true, 'categorias' => $repo->getAllByBanda($bandaId)], JSON_UNESCAPED_UNICODE);
    exit;
}

require_csrf();
$data = json_decode(file_get_contents('php://input'), true) ?: [];

try {
    $revisionRepo = new SyncRevisionRepository();
    $baseRevision = $data['baseRevision'] ?? null;
    if (($data['action'] ?? '') === 'delete') {
        if (!CategoriaFormValidator::isDeleteIdValido($data['id'] ?? null)) throw new RuntimeException('Categoria inválida.');
        $mutation = $revisionRepo->mutate($bandaId, $baseRevision, fn() => $repo->delete((int)$data['id'], $bandaId), [['type' => 'categoria', 'id' => 0, 'operation' => 'replace']]);
        echo json_encode(['ok' => true, 'content_revision' => $mutation['revision']]);
        exit;
    }

    $nome = trim((string)($data['nome'] ?? ''));
    $nomeErro = CategoriaFormValidator::validateNome($nome);
    if ($nomeErro !== null) throw new RuntimeException($nomeErro);

    $changes = [['type' => 'categoria', 'id' => 0, 'operation' => 'replace']];
    if (!empty($data['id'])) $changes[] = ['type' => 'musica', 'id' => 0, 'operation' => 'replace'];
    $mutation = $revisionRepo->mutate($bandaId, $baseRevision, fn() => $repo->save(['id' => $data['id'] ?? null, 'nome' => $nome], $bandaId), $changes);
    echo json_encode(['ok' => true, 'id' => $mutation['result'], 'categoria' => ['id' => $mutation['result'], 'nome' => $nome], 'content_revision' => $mutation['revision']]);
} catch (SyncConflictException $e) {
    http_response_code(409);
    echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'content_revision' => $e->getCurrentRevision()]);
} catch (CategoriaDuplicadaException $e) {
    http_response_code(409);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'categoria' => $e->getCategoriaExistente(),
    ]);
} catch (PDOException $e) {
    if ((string)$e->getCode() === '23000') {
        http_response_code(409);
        echo json_encode(['ok' => false, 'error' => 'Já existe uma categoria com esse nome.']);
    } else {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Não foi possível salvar a categoria.']);
    }
} catch (RuntimeException $e) {
    http_response_code(str_contains($e->getMessage(), 'não encontrada') ? 404 : 422);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
