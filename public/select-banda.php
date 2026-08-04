<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
require_auth();

$usuario = $_SESSION['usuario'] ?? [];
$bandas  = (new UserRepository())->getBandasDoUsuario($usuario['id'] ?? '');

// master sees all bands
if (is_master()) {
    $bandas = (new BandaRepository())->getAll();
    // attach a role label for display
    foreach ($bandas as &$b) {
        $b['usuario_perfil'] = 'master';
    }
    unset($b);
}

render_view('select-banda', ['bandas' => $bandas, 'usuario' => $usuario]);
