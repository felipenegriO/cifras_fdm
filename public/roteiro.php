<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
if (class_exists('RoteiroController')) {
    $controller = new RoteiroController();
    $controller->show();
    return;
}
render_view('roteiro');
