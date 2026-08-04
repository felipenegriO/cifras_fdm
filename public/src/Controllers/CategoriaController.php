<?php
class CategoriaController {
    public function show(): void {
        require_auth();
        if (!can_edit_content()) {
            http_response_code(403);
            echo 'Acesso restrito a gestores e administradores.';
            exit;
        }
        render_view('categorias');
    }
}
