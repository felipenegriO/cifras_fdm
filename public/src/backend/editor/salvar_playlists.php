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

if (isset($data['playlists']) && is_array($data['playlists'])) {
    $playlists = $data['playlists'];
} elseif (is_array($data)) {
    $playlists = [];
    foreach ($data as $nome => $itens) {
        if (is_array($itens)) $playlists[] = ['nome' => $nome, 'itens' => $itens];
    }
} else {
    http_response_code(400);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Estrutura inválida.']);
    exit;
}

$bandaId = current_band_id();

$limits = fdm_plan_limits($_SESSION['banda_atual']['plano'] ?? 'bloqueado');
$maxPlaylists = $limits['playlists'];
if ($maxPlaylists !== -1 && count($playlists) > $maxPlaylists) {
    $planoLabel = match($_SESSION['banda_atual']['plano'] ?? '') {
        'gratuito' => 'Gratuito', 'basico' => 'Básico', default => 'atual',
    };
    http_response_code(403);
    echo json_encode([
        'sucesso'     => false,
        'mensagem'    => "Limite do plano {$planoLabel}: máximo de {$maxPlaylists} playlist(s).",
        'plano_limit' => true,
    ]);
    exit;
}

(new PlaylistRepository())->saveAll($playlists, $bandaId);

echo json_encode(['sucesso' => true, 'mensagem' => 'Playlists salvas com sucesso!']);
