<?php
require_once __DIR__ . '/guard.php';

$pdo = Database::getConnection();
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS user_legal_acceptances (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        usuario_id CHAR(36) NOT NULL,
        terms_version VARCHAR(40) NOT NULL,
        privacy_version VARCHAR(40) NOT NULL,
        accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ip_hash CHAR(64) DEFAULT NULL,
        PRIMARY KEY (id),
        INDEX idx_legal_acceptance_user (usuario_id),
        CONSTRAINT fk_legal_acceptance_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

echo "Migração de privacidade concluída.\n";
