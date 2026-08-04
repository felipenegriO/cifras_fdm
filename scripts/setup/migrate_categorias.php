<?php
require_once __DIR__ . '/guard.php';
require_once __DIR__ . '/../../public/src/backend/bootstrap.php';

$pdo = Database::getConnection();
$pdo->exec(
    "CREATE TABLE IF NOT EXISTS categorias (
        id INT NOT NULL AUTO_INCREMENT,
        banda_id CHAR(36) NOT NULL,
        nome VARCHAR(100) NOT NULL,
        atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_categorias_banda_nome (banda_id, nome),
        FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE,
        INDEX idx_categorias_banda (banda_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

$pdo->exec(
    "INSERT IGNORE INTO categorias (banda_id, nome)
     SELECT id, categoria.nome
     FROM bandas
     CROSS JOIN (
       SELECT 'Louvor Animado' AS nome UNION ALL
       SELECT 'Marianas' UNION ALL
       SELECT 'Oracionais' UNION ALL
       SELECT 'Adoração' UNION ALL
       SELECT 'Missa'
     ) categoria"
);

$pdo->exec(
    "INSERT IGNORE INTO categorias (banda_id, nome)
     SELECT DISTINCT banda_id, TRIM(classificacao)
     FROM musicas
     WHERE TRIM(classificacao) <> ''"
);

echo "Migração de categorias concluída.\n";
