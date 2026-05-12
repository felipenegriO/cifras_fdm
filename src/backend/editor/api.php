<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../backup_helpers.php';
session_start();
if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true || strtolower((string)($_SESSION['usuario']['perfil'] ?? 'administrador')) !== 'administrador') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Acesso restrito ao administrador.']);
    exit;
}

// Lê o corpo da requisição JSON
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode([
        'ok' => false,
        'error' => 'Erro ao decodificar JSON da requisição: ' . json_last_error_msg(),
        'raw' => $raw
    ]);
    exit;
}

if (!isset( $data['nome'], $data['cifra'])) {
    echo json_encode(['ok' => false, 'error' => 'Dados incompletos']);
    exit;
}

function normalizar_cifra_para_salvar($cifra) {
    $chordRegex = '/^[A-G](?:#|b)?(?:(?:m(?![a-z])|maj|min|dim|aug|sus|add|M)?[0-9]*(?:M)?(?:\([^)]+\))?(?:[+º°])?)(?:\/[A-G](?:#|b)?)?$/iu';

    return preg_replace_callback('/<b\b[^>]*>([\s\S]*?)<\/b>/i', function ($matches) use ($chordRegex) {
        $texto = html_entity_decode(strip_tags($matches[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $texto = str_replace("\xc2\xa0", ' ', $texto);
        $texto = trim(preg_replace('/\s+/u', ' ', $texto));

        if ($texto === '') {
            return '';
        }

        $tokens = preg_split('/\s+/u', $texto);
        $soAcordes = count($tokens) > 0;
        foreach ($tokens as $token) {
            $token = trim($token, '.,;:!?');
            if (!preg_match($chordRegex, $token)) {
                $soAcordes = false;
                break;
            }
        }

        if (!$soAcordes) {
            return $matches[0];
        }

        return '<b>' . htmlspecialchars(implode(' ', $tokens), ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</b>';
    }, (string)$cifra);
}

$data['cifra'] = normalizar_cifra_para_salvar($data['cifra']);

$arquivo = __DIR__ . '/../../js/musicas.js';

$conteudo = file_get_contents($arquivo);

// Remove prefixo e sufixo JS
$conteudo = trim($conteudo);
$conteudo = preg_replace('/^var\s+songs\s*=\s*/', '', $conteudo);
$conteudo = preg_replace('/;\s*$/', '', $conteudo);

// 1) Coloca aspas duplas nas propriedades (ex: id: -> "id":)
$conteudo = preg_replace('/(\b\w+\b)\s*:/', '"$1":', $conteudo);

// 2) Converte strings entre aspas simples para aspas duplas e escapa caracteres especiais
$conteudo = preg_replace_callback(
    "/'((?:[^'\\\\]|\\\\.)*)'/s",
    function($matches) {
        $str = $matches[1];
        // Primeiro, desescapa aspas simples e barras para evitar confusão
        $str = str_replace("\\'", "'", $str);
        $str = str_replace("\\\\", "\\", $str);

        // Escapa caracteres de controle e aspas duplas para JSON válido
        $str = json_encode($str);

        // json_encode adiciona aspas duplas no começo e fim, removemos para colocar na string maior
        $str = substr($str, 1, -1);

        return '"' . $str . '"';
    },
    $conteudo
);



// Agora decodifica o JSON corretamente
$songs = json_decode($conteudo, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode([
        'ok' => false,
        'error' => 'Erro ao decodificar o conteúdo do arquivo: ' . json_last_error_msg(),
        'conteudo' => $conteudo
    ]);
    exit;
}

// Atualiza a música
$encontrado = false;
$maiorId = 0;
foreach ($songs as &$musica) {
     if (isset($musica['id']) && is_numeric($musica['id']) && $musica['id'] > $maiorId) {
        $maiorId = $musica['id'];
    }
    if ($musica['id'] == $data['id']) {
        $musica['nome'] = $data['nome'];
        $musica['cifra'] = $data['cifra'];
        $musica['bit'] = $data['bit'];
        $musica['artista'] = $data['artista'];
        $musica['classificacao'] = $data['classificacao'];
        $encontrado = true;
        break;
    }
}

if (!$encontrado) {
    $data['id'] = $maiorId + 1;
    $songs[] = $data;
}
// Converte de volta para JSON formatado
$novoConteudo = json_encode($songs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

// Remove aspas das propriedades (ex: "id": -> id:)
$novoConteudo = preg_replace('/"(\w+)"\s*:/', '$1:', $novoConteudo);

// Converte as strings de aspas duplas para aspas simples, escapando aspas simples internas
$novoConteudo = preg_replace_callback(
    '/"(.*?)"/s',
    function ($m) {
        $str = $m[1];
        $str = str_replace("'", "\\'", $str);
        // Também desescapa barras para ficar compatível com JS simples
        $str = str_replace('\\"', '"', $str);
        return "'$str'";
    },
    $novoConteudo
);

// Adiciona prefixo e sufixo para o arquivo JS
$novoConteudo = "var songs = " . $novoConteudo . ";";

// Salva no arquivo
fdm_backup_file($arquivo);
file_put_contents($arquivo, $novoConteudo);
fdm_bump_cache_version();

echo json_encode(['ok' => true]);
