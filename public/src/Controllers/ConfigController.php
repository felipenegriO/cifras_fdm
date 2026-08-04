<?php
class ConfigController {
    public function show() {
        require_auth();
        $usuario = $_SESSION['usuario'] ?? [];
        render_view('config', ['usuario' => $usuario]);
    }
}
