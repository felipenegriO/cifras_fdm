CREATE TABLE IF NOT EXISTS sync_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  banda_id CHAR(36) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL,
  entity_type ENUM('musica','playlist','roteiro','categoria') NOT NULL,
  entity_id INT NOT NULL DEFAULT 0,
  operation ENUM('upsert','delete','replace') NOT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sync_changes_banda_revision (banda_id, revision),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
