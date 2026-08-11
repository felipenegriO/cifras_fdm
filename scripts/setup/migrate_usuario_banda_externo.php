<?php
require_once __DIR__ . '/../../public/src/backend/bootstrap.php';

$pdo = db();
$pdo->exec("ALTER TABLE usuario_banda MODIFY COLUMN perfil ENUM('administrador','gestor','basico','externo') NOT NULL DEFAULT 'basico'");

echo "Perfil externo habilitado.\n";
