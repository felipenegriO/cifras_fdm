<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
require_auth();
if (!is_master()) {
    http_response_code(403);
    echo '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Acesso negado</title></head><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>403 — Acesso restrito</h2><p>Esta área é exclusiva para usuários master.</p><a href="index.php">Voltar</a></body></html>';
    exit;
}
render_view('bandas/editorbandas');
