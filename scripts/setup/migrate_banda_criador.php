<?php
require_once __DIR__ . '/../../public/config/env.php';
require_once __DIR__ . '/../../public/src/Services/Database.php';

$pdo = Database::getConnection();
$column = $pdo->prepare('SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "bandas" AND column_name = "criador_id"');
$column->execute();

if ((int)$column->fetchColumn() === 0) {
    $pdo->exec('ALTER TABLE bandas ADD COLUMN criador_id CHAR(36) DEFAULT NULL AFTER stripe_subscription_id');
}

$pdo->exec(
    'UPDATE bandas b
     SET b.criador_id = (
       SELECT ub.usuario_id FROM usuario_banda ub
       WHERE ub.banda_id = b.id AND ub.perfil = "administrador"
       ORDER BY ub.usuario_id LIMIT 1
     )
     WHERE b.criador_id IS NULL'
);

$constraint = $pdo->prepare('SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = "bandas" AND constraint_name = "fk_bandas_criador"');
$constraint->execute();

if ((int)$constraint->fetchColumn() === 0) {
    $pdo->exec('ALTER TABLE bandas ADD CONSTRAINT fk_bandas_criador FOREIGN KEY (criador_id) REFERENCES usuarios(id) ON DELETE SET NULL');
}

echo "Coluna criador_id configurada em bandas.\n";
