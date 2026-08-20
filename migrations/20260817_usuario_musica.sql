-- Personalização do músico sobre a música da banda. Hoje guarda só o
-- capotraste; é a semente do NOTE-001 (anotações pessoais), que acrescenta
-- nota e âncora nesta mesma tabela.
--
-- As colunas base_* são o merge base do modelo do Git: a foto do cadastro no
-- instante da escolha. Com elas dá para distinguir "o cadastro não mudou" de
-- "mudou e eu tinha personalizado", que é o conflito de verdade.
--
-- IF NOT EXISTS porque a tabela também nasce no create_tables.sql, e banco
-- novo aplica o baseline antes das migrations.
CREATE TABLE IF NOT EXISTS usuario_musica (
  usuario_id  CHAR(36) NOT NULL,
  banda_id    CHAR(36) NOT NULL,
  musica_id   INT      NOT NULL,
  transposicao_instrumento TINYINT    DEFAULT NULL,
  base_transposicao        TINYINT    DEFAULT NULL,
  base_tom                 VARCHAR(8) DEFAULT NULL,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, musica_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (musica_id)  REFERENCES musicas(id)  ON DELETE CASCADE,
  FOREIGN KEY (banda_id)   REFERENCES bandas(id)   ON DELETE CASCADE,
  INDEX idx_usuario_musica_banda (usuario_id, banda_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
