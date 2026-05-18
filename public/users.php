<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
$usersFile = __DIR__ . '/src/backend/users/usuarios.json';
$controller = new UsersController($usersFile);
$controller->showEditor();
