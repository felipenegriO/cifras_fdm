-- Capotraste (violão) ou transpose (teclado) sugerido pelo cadastro da música.
-- Positivo = o instrumento sobe em relação às formas mostradas na tela; o som
-- que sai não muda. A cifra continua guardada sempre no tom soante, então as
-- músicas que já existem ficam corretas com o valor padrão 0.
-- IF NOT EXISTS é obrigatório, não zelo: a coluna também é declarada no
-- create_tables.sql, e um banco novo aplica o baseline ANTES das migrations.
-- Sem isto, provisionar máquina nova morre com "1060 Duplicate column name".
ALTER TABLE musicas
  ADD COLUMN IF NOT EXISTS transposicao_instrumento TINYINT NOT NULL DEFAULT 0;
