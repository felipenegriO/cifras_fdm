<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $numero = $_POST['numero'] ?? null;
    if ($numero !== null) {
        file_put_contents('numero.txt', $numero);
        echo 'OK';
    } else {
        http_response_code(400);
        echo 'Número não enviado.';
    }
}
?>