<?php
require_once __DIR__ . '/../bootstrap.php';
header('Content-Type: application/json');
send_no_cache_headers();
require_band_role('gestor');
require_csrf();

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode(['ok' => false, 'error' => 'JSON inválido: ' . json_last_error_msg()]);
    exit;
}

$bandaId = current_band_id();
$repo    = new MusicaRepository();

// ----- COPY -----
if (($data['action'] ?? '') === 'copy') {
    if (!isset($data['id']) || !is_numeric($data['id'])) {
        echo json_encode(['ok' => false, 'error' => 'ID inválido']);
        exit;
    }
    fdm_require_plan_limit('musicas', $repo->countByBanda($bandaId));
    try {
        $newId = $repo->copy((int)$data['id'], $bandaId);
        echo json_encode(['ok' => true, 'id' => $newId]);
    } catch (RuntimeException $e) {
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
    $repo->delete((int)$data['id'], $bandaId);
    echo json_encode(['ok' => true]);
    exit;
}

// ----- SAVE (create or update) -----
if (!isset($data['nome'], $data['cifra'])) {
    echo json_encode(['ok' => false, 'error' => 'Dados incompletos']);
    exit;
}

// Only check limit when creating (no id = new music)
if (empty($data['id'])) {
    fdm_require_plan_limit('musicas', $repo->countByBanda($bandaId));
}

$data['cifra'] = normalizar_cifra_para_salvar($data['cifra']);

$newId = $repo->save([
    'id'            => $data['id'] ?? null,
    'nome'          => $data['nome'],
    'cifra'         => $data['cifra'],
    'bit'           => $data['bit']           ?? '',
    'artista'       => $data['artista']       ?? '',
    'classificacao' => $data['classificacao'] ?? '',
], $bandaId);

echo json_encode([
    'ok'      => true,
    'id'      => $newId,
    'created' => empty($data['id']),
]);

// ---- helpers ----

function normalizar_cifra_para_salvar(string $cifra): string {
    $chordRegex = '/^[A-G](?:#|b)?(?:(?:m(?![a-z])|maj|min|dim|aug|sus|add|M)?[0-9]*(?:M)?(?:\([^)]+\))?(?:[+º°])?)(?:\/[A-G](?:#|b)?)?$/iu';

    return preg_replace_callback('/<b\b[^>]*>([\s\S]*?)<\/b>/i', function ($m) use ($chordRegex) {
        $texto = html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $texto = str_replace("\xc2\xa0", ' ', $texto);
        $texto = trim(preg_replace('/\s+/u', ' ', $texto));
        if ($texto === '') return '';

        $tokens    = preg_split('/\s+/u', $texto);
        $soAcordes = count($tokens) > 0;
        foreach ($tokens as $token) {
            if (!preg_match($chordRegex, trim($token, '.,;:!?'))) { $soAcordes = false; break; }
        }
        return $soAcordes
            ? '<b>' . htmlspecialchars(implode(' ', $tokens), ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</b>'
            : $m[0];
    }, $cifra);
}
