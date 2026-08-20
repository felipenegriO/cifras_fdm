<?php
/**
 * Personalização de capotraste do músico sobre uma música da banda.
 *
 * De propósito NÃO altera band_sync_state: dado pessoal não é conteúdo de
 * banda, e subir a revisão invalidaria o cache offline de todos os integrantes
 * por causa da escolha de um só.
 */
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
send_no_cache_headers();

require_auth_json();
require_current_band_json();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Método inválido.']);
    exit;
}
require_csrf();

$payload = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Payload inválido.']);
    exit;
}

$usuarioId = (string) ($_SESSION['usuario']['id'] ?? '');
$bandaId   = current_band_id();
$musicaId  = filter_var($payload['musica_id'] ?? null, FILTER_VALIDATE_INT);
if ($usuarioId === '' || !$musicaId) {
    http_response_code(422);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Música inválida.']);
    exit;
}

// A música tem de ser da banda atual: sem esta checagem, o id viraria uma
// sonda para descobrir conteúdo de outra banda.
$musica = (new MusicaRepository())->findById($musicaId, $bandaId);
if (!$musica) {
    http_response_code(404);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Música não encontrada.']);
    exit;
}

$repo = new UsuarioMusicaRepository();
$acao = (string) ($payload['acao'] ?? 'salvar');

// A base vem sempre do cadastro lido no servidor. Aceitá-la do cliente
// permitiria forjar um estado "sem conflito".
$baseCadastro = (int) ($musica['transposicao_instrumento'] ?? 0);
$baseTom = $payload['base_tom'] ?? null;
$baseTom = is_string($baseTom) && preg_match('/^[A-G](?:#|b)?m?$/', $baseTom) === 1 ? $baseTom : null;

if ($acao === 'remover') {
    $repo->remover($usuarioId, $bandaId, $musicaId);
    echo json_encode(['sucesso' => true]);
    exit;
}

if ($acao === 'manter') {
    $repo->atualizarBase($usuarioId, $bandaId, $musicaId, $baseCadastro, $baseTom);
    echo json_encode(['sucesso' => true]);
    exit;
}

$valor = TransposicaoInstrumento::normalizar($payload['transposicao_instrumento'] ?? null);
if ($valor === null) {
    http_response_code(422);
    echo json_encode(['sucesso' => false, 'mensagem' => 'Deslocamento inválido.']);
    exit;
}

$repo->salvar($usuarioId, $bandaId, $musicaId, $valor, $baseCadastro, $baseTom);
echo json_encode(['sucesso' => true, 'preferencia' => [
    'musica_id' => $musicaId,
    'transposicao_instrumento' => $valor,
    'base_transposicao' => $baseCadastro,
    'base_tom' => $baseTom,
]]);
