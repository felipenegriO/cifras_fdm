<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Caminho padrão — inclusive a sonda de conectividade (?probe=) que o app
// dispara em timer. Não carrega bootstrap e não toca no banco de propósito:
// se responder "estou vivo" passar a depender do MySQL, uma lentidão do banco
// faz o app inteiro se declarar offline.
if (($_GET['check'] ?? '') !== 'schema') {
    http_response_code(200);
    echo json_encode(['status' => 'ok', 'service' => 'cifro', 'request_id' => bin2hex(random_bytes(8))]);
    return;
}

// Caminho explícito de diagnóstico: o banco está no estado que este código
// espera? Responde 503 quando há migration pendente, que é o cenário em que a
// aplicação sobe e quebra só nos endpoints que usam a tabela nova.
require_once __DIR__ . '/src/backend/bootstrap.php';

$relatorio = SchemaHealth::report(new MigrationRunner(Database::getConnection(), __DIR__ . '/../migrations'));

// O veredito é público (monitoração precisa dele sem credencial); os nomes das
// migrations não são — dizem a um estranho qual tabela ainda não existe.
$resposta = [
    'status' => $relatorio['status'],
    'service' => 'cifro',
    'pending_count' => count($relatorio['pending_migrations']),
];
if (!empty($_SESSION['usuario'])) {
    $resposta['pending_migrations'] = $relatorio['pending_migrations'];
}

http_response_code($relatorio['http_status']);
echo json_encode($resposta);
