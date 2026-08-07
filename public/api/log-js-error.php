<?php
require_once __DIR__ . '/../src/backend/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$raw = file_get_contents('php://input');
if (!$raw) { http_response_code(204); exit; }

$data = json_decode($raw, true);
if (!is_array($data)) { http_response_code(400); exit; }

$descricao  = mb_substr(trim((string) ($data['descricao']  ?? 'JS error')), 0, 500);
$referencia = mb_substr(trim((string) ($data['referencia'] ?? 'frontend')), 0, 255);
$detalhes   = is_array($data['detalhes'] ?? null) ? $data['detalhes'] : [];
$detalhes['ua'] = mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200);

ErrorLogger::log($descricao, $referencia, 'error', $detalhes);

http_response_code(204);
