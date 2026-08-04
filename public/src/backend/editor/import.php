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
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON inválido: ' . json_last_error_msg()]);
    exit;
}

$url = trim((string)($data['url'] ?? ''));
if ($url === '') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'Informe um link de origem.']);
    exit;
}

try {
    $provider = ChordImportProviderResolver::forUrl($url);
    $result = $provider->import($url);
    echo json_encode([
        'ok' => true,
        'title' => $result['title'],
        'artist' => $result['artist'],
        'content' => $result['content'],
        'metadata' => $result['metadata'],
        'source' => $url,
    ]);
} catch (InvalidArgumentException|RuntimeException $e) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Não foi possível concluir a importação.']);
}
