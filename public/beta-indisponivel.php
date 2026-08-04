<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
http_response_code(403);
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Beta fechado — Cifrô</title>
  <link href="/src/css/theme.css" rel="stylesheet">
</head>
<body>
  <main style="max-width:680px;margin:10vh auto;padding:24px;text-align:center">
    <h1>Beta fechado</h1>
    <p>Esta banda ainda não foi convidada para esta fase de testes.</p>
    <p><a class="btn btn-primary" href="/select-banda.php">Selecionar outra banda</a></p>
  </main>
</body>
</html>
