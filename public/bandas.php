<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
require_auth();
if (!can_manage_bands()) {
    http_response_code(403);
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Acesso negado</title></head><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>403 — Acesso restrito</h2><p>Esta área exige perfil administrador em uma banda com plano ativo.</p><a href="index.php">Voltar</a></body></html>';
    exit;
}
render_view('bandas/editorbandas');
