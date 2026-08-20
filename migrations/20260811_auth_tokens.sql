-- Login persistente ("lembrar-me"): mantém o músico logado entre sessões do
-- navegador. Só o hash do validador é guardado; o valor em claro vive apenas
-- no cookie cifro_lembrar do aparelho.
CREATE TABLE IF NOT EXISTS auth_tokens (
  seletor        CHAR(32)  NOT NULL,
  validador_hash CHAR(64)  NOT NULL,
  validador_anterior_hash CHAR(64) NULL,
  rotacionado_em TIMESTAMP NULL,
  usuario_id     CHAR(36)  NOT NULL,
  criado_em      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em      DATETIME  NOT NULL,
  usado_em       TIMESTAMP NULL,
  PRIMARY KEY (seletor),
  KEY idx_usuario (usuario_id),
  KEY idx_expira (expira_em),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
