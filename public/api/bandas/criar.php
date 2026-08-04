<?php
/**
 * POST /api/bandas/criar.php
 * Cria uma nova banda para o usuário autenticado.
 *
 * Regras:
 *   - Requer autenticação e CSRF
 *   - master pode criar sem limite
 *   - gratuito: máximo de 1 banda (onde é administrador)
 *   - mensal/semestral/anual: ilimitado
 *
 * Body JSON: { "nome": "Nome da Banda" }
 * Resposta: { "ok": true, "id": "uuid", "nome": "..." }
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'mensagem' => 'Método não permitido.']);
    exit;
}

require_auth_json();
require_csrf();

if (ClosedBetaPolicy::fromEnvironment()->enabled()) {
    OperationalLogger::log('warning', 'beta.band_creation_denied', ['result' => 'blocked', 'http_status' => 403]);
    http_response_code(403);
    echo json_encode(['ok' => false, 'sucesso' => false, 'error' => 'beta_closed', 'mensagem' => 'A criação de bandas está desativada durante o beta fechado.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$nome  = trim($input['nome'] ?? '');

if (!$nome) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'mensagem' => 'Nome da banda é obrigatório.']);
    exit;
}

if (strlen($nome) > 120) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'mensagem' => 'Nome da banda muito longo (máximo 120 caracteres).']);
    exit;
}

$userId    = $_SESSION['usuario']['id'] ?? null;
$bandaRepo = new BandaRepository();

// Verifica limite do plano — usa o plano da banda atual como referência do usuário.
// Master nunca tem limite.
if (!is_master()) {
    $planoAtual = $_SESSION['banda_atual']['plano'] ?? 'gratuito';
    $limites    = cifro_plan_limits($planoAtual);
    $limiteBandas = $limites['bandas'] ?? 1;

    if ($limiteBandas !== -1) {
        $totalBandas = $bandaRepo->countByUsuario($userId);
        if ($totalBandas >= $limiteBandas) {
            http_response_code(403);
            echo json_encode([
                'ok'          => false,
                'sucesso'     => false,
                'plano_limit' => true,
                'mensagem'    => "Limite do plano " . cifro_plan_label($planoAtual) . " atingido: máximo de {$limiteBandas} banda(s). Faça upgrade para criar mais bandas.",
            ]);
            exit;
        }
    }
}

$bandaId = bin2hex(random_bytes(16));

$pdo = Database::getConnection();
try {
    $pdo->beginTransaction();

    $bandaRepo->save([
        'id'             => $bandaId,
        'nome'           => $nome,
        'ativo'          => 1,
        'plano'          => 'gratuito',
        'trial_expira_em'=> null,
    ]);

    // Vincula usuário como administrador da nova banda
    $stmt = $pdo->prepare(
        'INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, "administrador")'
    );
    $stmt->execute([$userId, $bandaId]);

    $pdo->commit();
} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['ok' => false, 'mensagem' => 'Erro ao criar banda. Tente novamente.']);
    exit;
}

echo json_encode([
    'ok'     => true,
    'sucesso'=> true,
    'id'     => $bandaId,
    'nome'   => $nome,
    'plano'  => 'gratuito',
]);
