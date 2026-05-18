<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../backup_helpers.php';
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header('Content-Type: application/json');
require_admin_json();
require_csrf();

$entrada = file_get_contents('php://input');
$data = json_decode($entrada, true);
if (!$data) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "JSON invalido."]);
    exit;
}

$arquivoJs = __DIR__ . '/../../js/roteiros_salvos.js';
if (!file_exists($arquivoJs)) {
    file_put_contents($arquivoJs, "const roteirosSalvos = [];\n");
}

$conteudo = file_get_contents($arquivoJs);
$conteudo = trim($conteudo);
$conteudo = preg_replace('/^const\s+roteirosSalvos\s*=\s*/', '', $conteudo);
$conteudo = preg_replace('/;\s*$/', '', $conteudo);

$roteiros = json_decode($conteudo, true);
if (!is_array($roteiros)) $roteiros = [];

if (isset($data['deleteId'])) {
    $deleteId = $data['deleteId'];
    $roteiros = array_values(array_filter($roteiros, function($r) use ($deleteId) {
        return (string)$r['id'] !== (string)$deleteId;
    }));
} else {
    if (!isset($data['titulo'], $data['conteudo'])) {
        echo json_encode(["ok" => false, "error" => "Dados incompletos."]);
        exit;
    }

    $visivelAte = isset($data['visivel_ate']) ? $data['visivel_ate'] : '';
    $conteudo = isset($data['conteudo']) ? $data['conteudo'] : '';
    $conteudo = preg_replace("/\r?\n/", "<br/>", $conteudo);
    $conteudo = preg_replace("/<br\s*?>/i", "<br/>", $conteudo);

    $encontrado = false;
    $maiorId = 0;
    foreach ($roteiros as &$r) {
        if (isset($r['id']) && is_numeric($r['id']) && $r['id'] > $maiorId) {
            $maiorId = $r['id'];
        }
        if ((string)$r['id'] === (string)$data['id']) {
            $r['titulo'] = $data['titulo'];
            $r['visivel_ate'] = $visivelAte;
            $r['conteudo'] = $conteudo;
            $encontrado = true;
        }
    }
    unset($r);

    if (!$encontrado) {
        $data['id'] = $maiorId + 1;
        $data['visivel_ate'] = $visivelAte;
        $data['conteudo'] = $conteudo;
        $roteiros[] = $data;
    }
}

$novoConteudo = "const roteirosSalvos = " . json_encode($roteiros, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ";\n";
fdm_backup_file($arquivoJs);
file_put_contents($arquivoJs, $novoConteudo);
fdm_bump_cache_version();

echo json_encode(["ok" => true]);
