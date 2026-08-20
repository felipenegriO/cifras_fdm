<?php
/**
 * Convite da banda por link (ROLE-003).
 *
 *   GET                      → estado dos convites vivos da banda
 *   POST {action:'gerar'}    → link novo, válido por 24h
 *   POST {action:'revogar'}  → derruba todos os convites vivos da banda
 *
 * O teto de usuários do plano é barrado aqui, na geração: é melhor o
 * administrador descobrir o limite antes de compartilhar do que o músico
 * descobrir depois de clicar no link no grupo.
 *
 * Devolve o CAMINHO, não a URL inteira: quem monta o endereço absoluto é o
 * JavaScript, com window.location.origin, do mesmo jeito que playlist-share.js
 * faz. Assim o link compartilhado aponta para o host que o usuário está
 * realmente usando, e não para o APP_URL configurado no servidor.
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($metodo, ['GET', 'POST'], true)) {
    http_response_code(405);
    echo json_encode(['ok' => false, 'sucesso' => false, 'mensagem' => 'Método não permitido.']);
    exit;
}

require_band_role('administrador');

$bandaId  = current_band_id();
$convites = new BandaConviteRepository();

/** Estado agregado para a linha que o administrador vê na aba Membros. */
function convite_estado(BandaConviteRepository $convites, string $bandaId): array {
    $resumo = $convites->resumoDaBanda($bandaId);
    if (!$resumo) return ['ativo' => false];
    return [
        'ativo'    => true,
        'validade' => BandaConvitePolicy::rotuloValidade($resumo['expira_em']),
        'usos'     => $resumo['usos'],
    ];
}

if ($metodo === 'GET') {
    echo json_encode([
        'ok'      => true,
        'sucesso' => true,
        'estado'  => convite_estado($convites, $bandaId),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

require_csrf();

$input  = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $input['action'] ?? '';

if ($action === 'revogar') {
    $convites->revogarDaBanda($bandaId);
    echo json_encode(['ok' => true, 'sucesso' => true, 'estado' => ['ativo' => false]]);
    exit;
}

if ($action !== 'gerar') {
    http_response_code(422);
    echo json_encode(['ok' => false, 'sucesso' => false, 'mensagem' => 'Ação inválida.']);
    exit;
}

// Responde 403 com plano_limit e encerra quando a banda já está no teto.
cifro_require_plan_limit('users', (new UserRepository())->countByBanda($bandaId));

$token = $convites->gerar($bandaId, $_SESSION['usuario']['id'] ?? null);
$banda = $_SESSION['banda_atual'] ?? [];

OperationalLogger::log('info', 'convite.link_gerado', ['operation' => 'convite_gerar', 'result' => 'success']);

echo json_encode([
    'ok'         => true,
    'sucesso'    => true,
    'caminho'    => base_url('/convite.php?t=' . urlencode($token)),
    'banda_nome' => $banda['nome'] ?? '',
    'estado'     => convite_estado($convites, $bandaId),
], JSON_UNESCAPED_UNICODE);
