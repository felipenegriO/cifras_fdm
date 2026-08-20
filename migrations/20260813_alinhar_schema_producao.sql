-- Alinha bases antigas ao schema atual de create_tables.sql.
--
-- Motivo: produção subiu antes destas quatro adições e ficou para trás. O
-- sintoma que apareceu foi "Erro ao salvar banda" — PDOException
-- "Unknown column 'criador_id'" —, mas as outras três também são usadas por
-- código em produção e falhariam do mesmo jeito quando exercitadas.
--
-- Tudo aqui é aditivo e idempotente: pode rodar mais de uma vez sem estragar
-- nada, e não toca em dado existente.

-- 1) Autor da banda. Usado na criação de banda (bandas/salvar_banda.php e
--    api/bandas/criar.php). Sem ela, criar banda quebra.
ALTER TABLE bandas ADD COLUMN IF NOT EXISTS criador_id CHAR(36) DEFAULT NULL;

-- 2) Vencimento do plano pago, escrito pelo webhook do Stripe.
ALTER TABLE bandas ADD COLUMN IF NOT EXISTS plano_expira_em DATETIME DEFAULT NULL;

-- 3) Cancelamento self-service: marca o pedido; o downgrade real vem depois,
--    pelo webhook customer.subscription.deleted.
ALTER TABLE bandas ADD COLUMN IF NOT EXISTS cancelamento_agendado_em DATETIME DEFAULT NULL;

-- 4) Diário de alterações para a sincronização incremental
--    (api/sync/changes.php). Sem a tabela, o app cai sempre no sync completo.
CREATE TABLE IF NOT EXISTS sync_changes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  banda_id    CHAR(36) NOT NULL,
  revision    BIGINT UNSIGNED NOT NULL,
  entity_type ENUM('musica','playlist','roteiro','categoria') NOT NULL,
  entity_id   INT NOT NULL DEFAULT 0,
  operation   ENUM('upsert','delete','replace') NOT NULL,
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_sync_changes_banda_revision (banda_id, revision),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A chave estrangeira de criador_id fica de fora de propósito: em base antiga
-- ela pode falhar por dado inconsistente, e a coluna funciona sem ela. Se
-- quiser adicionar depois, confira antes que todo criador_id preenchido
-- exista em usuarios:
--   ALTER TABLE bandas ADD CONSTRAINT fk_bandas_criador
--     FOREIGN KEY (criador_id) REFERENCES usuarios(id) ON DELETE SET NULL;
