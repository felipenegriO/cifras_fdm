<?php
/**
 * GET /api/auth/status.php
 * Diz apenas se a requisição está autenticada. Nunca redireciona e nunca
 * devolve 401: o cliente precisa distinguir "sem sessão" de "sem rede", e um
 * redirect atrapalharia essa leitura.
 */
require_once __DIR__ . '/../../src/backend/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

echo json_encode([
    'ok'          => true,
    'autenticado' => !empty($_SESSION['autenticado']),
]);
