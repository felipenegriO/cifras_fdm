<?php
require_once __DIR__ . '/../../backend/bootstrap.php';
$controller = new EditorController();
if (method_exists($controller, 'roteiro')) {
    $controller->roteiro();
    return;
}
render_view('editor/editorroteiro');
