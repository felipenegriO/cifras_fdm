<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../backup_helpers.php';
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header('Content-Type: application/json');
require_admin_json();
require_csrf();

// Lê os dados do corpo da requisição
$entrada = file_get_contents("php://input");
$data = json_decode($entrada, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["sucesso" => false, "mensagem" => "JSON inválido."]);
    exit;
}

// Garante que o dado será salvo no formato {"playlists": [...]}
$dadosParaSalvar = [];

if (isset($data['playlists']) && is_array($data['playlists'])) {
    $dadosParaSalvar = $data['playlists'];  // pega só o array playlists
} elseif (is_array($data)) {
    // Tenta reformatar o JSON no modelo de array simples de playlists
    $playlistsFormatadas = [];
    foreach ($data as $nome => $itens) {
        if (is_array($itens)) {
            $playlistsFormatadas[] = ["nome" => $nome, "itens" => $itens];
        }
    }
    $dadosParaSalvar = $playlistsFormatadas;
} else {
    http_response_code(400);
    echo json_encode(["sucesso" => false, "mensagem" => "Estrutura inválida."]);
    exit;
}

// Caminho do arquivo JS que define a variável playlistsSalvas
$arquivoJs = __DIR__ . '/../../js/playlists_salvas.js';

// Gera o conteúdo JS: define a variável global playlistsSalvas (apenas o array)
$conteudoJs = "const playlistsSalvas = " . json_encode($dadosParaSalvar, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . ";";

// Salva o arquivo JS
fdm_backup_file($arquivoJs);
$sucessoJs = file_put_contents($arquivoJs, $conteudoJs);

if ($sucessoJs !== false) {
    fdm_bump_cache_version();
    echo json_encode(["sucesso" => true, "mensagem" => "Playlists salvas com sucesso!"]);
} else {
    http_response_code(500);
    echo json_encode(["sucesso" => false, "mensagem" => "Erro ao salvar o arquivo JS."]);
}
