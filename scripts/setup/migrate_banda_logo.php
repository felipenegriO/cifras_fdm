<?php
require_once __DIR__ . '/../../public/config/env.php';
require_once __DIR__ . '/../../public/src/Services/Database.php';

$pdo = Database::getConnection();
$pdo->exec('ALTER TABLE bandas MODIFY COLUMN logo MEDIUMTEXT DEFAULT NULL');
echo "Coluna logo configurada para Base64.\n";
