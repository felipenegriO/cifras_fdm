-- Convite da banda por link compartilhável (ROLE-003). Guarda só o SHA-256 do
-- token; o valor em claro existe apenas dentro do link que circula no grupo,
-- mesmo padrão de password_reset_tokens.
CREATE TABLE IF NOT EXISTS banda_convites (
  token       CHAR(64)  NOT NULL,
  banda_id    CHAR(36)  NOT NULL,
  criado_por  CHAR(36)  DEFAULT NULL,
  expira_em   DATETIME  NOT NULL,
  revogado_em DATETIME  DEFAULT NULL,
  usos        INT       NOT NULL DEFAULT 0,
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token),
  KEY idx_convite_banda (banda_id),
  KEY idx_convite_expira (expira_em),
  FOREIGN KEY (banda_id)   REFERENCES bandas(id)   ON DELETE CASCADE,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
