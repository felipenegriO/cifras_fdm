-- Leva a bancos já existentes tudo que hoje vive só no create_tables.sql.
--
-- Motivo: o baseline e os scripts avulsos de scripts/setup/ acumularam
-- correções que nunca viraram migration. Quem provisionou banco novo recebeu;
-- quem já tinha banco, não. Foi assim que produção ficou sem criador_id.
--
-- Antes de apagar os scripts avulsos, o conteúdo deles precisa estar aqui —
-- senão a remoção perde a correção para todo banco existente.
--
-- Tudo é aditivo e idempotente (MariaDB): reaplicar não estraga nada. O UPDATE
-- do final é idempotente pela própria cláusula WHERE.

-- ── de migrate_privacy.php ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_legal_acceptances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id CHAR(36) NOT NULL,
  terms_version VARCHAR(40) NOT NULL,
  privacy_version VARCHAR(40) NOT NULL,
  accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash CHAR(64) DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_legal_acceptance_user (usuario_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── de migrate_stripe_events.php ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  event_created BIGINT UNSIGNED NOT NULL,
  status ENUM('processing','processed','ignored','failed') NOT NULL DEFAULT 'processing',
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stripe_events_resource_created (resource_id, event_created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stripe_webhook_resources (
  resource_id VARCHAR(255) PRIMARY KEY,
  last_event_created BIGINT UNSIGNED NOT NULL,
  last_event_id VARCHAR(255) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── de migrate_categorias.php ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id            INT          NOT NULL AUTO_INCREMENT,
  banda_id      CHAR(36)     NOT NULL,
  nome          VARCHAR(100) NOT NULL,
  atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_banda_nome (banda_id, nome),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE,
  INDEX idx_categorias_banda (banda_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── de create_tables.sql: vínculo com conta Google ───────────────────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) DEFAULT NULL;
ALTER TABLE usuarios ADD UNIQUE KEY IF NOT EXISTS uq_google_sub (google_sub);

-- ── de migrate_banda_logo.php ────────────────────────────────────────────────
-- Logo em base64 estoura TEXT (64 KB); MEDIUMTEXT segura 16 MB.
ALTER TABLE bandas MODIFY COLUMN logo MEDIUMTEXT DEFAULT NULL;

-- ── de create_tables.sql: membro de banda sem e-mail ─────────────────────────
-- Gestor pode cadastrar músico sem e-mail; MariaDB aceita vários NULL na
-- UNIQUE KEY, então uq_email continua válido.
ALTER TABLE usuarios MODIFY COLUMN email VARCHAR(180) DEFAULT NULL;

-- ── de migrate_performance_indexes.php ───────────────────────────────────────
-- Endereço de origem da cifra importada por link.
ALTER TABLE musicas ADD COLUMN IF NOT EXISTS source_url VARCHAR(2048) DEFAULT NULL;

-- Os cinco índices existiam SÓ no baseline: banco já provisionado nunca os
-- recebeu. A falta não gera erro, só lentidão — o pior tipo de perda, porque
-- ninguém percebe.
CREATE INDEX IF NOT EXISTS idx_usuario_banda_banda_perfil ON usuario_banda (banda_id, perfil);
CREATE INDEX IF NOT EXISTS idx_musicas_banda_atualizado ON musicas (banda_id, atualizado_em);
CREATE INDEX IF NOT EXISTS idx_musicas_banda_classificacao ON musicas (banda_id, classificacao);
CREATE INDEX IF NOT EXISTS idx_playlists_banda_visibilidade ON playlists (banda_id, visivel_ate, atualizado_em);
CREATE INDEX IF NOT EXISTS idx_roteiros_banda_visibilidade ON roteiros (banda_id, visivel_ate, atualizado_em);

-- ── de migrate_planos.php e do fim do create_tables.sql ──────────────────────
ALTER TABLE bandas MODIFY COLUMN plano ENUM('trial','gratuito','mensal','semestral','anual','bloqueado','ativo','basico','banda') NOT NULL DEFAULT 'gratuito';

-- O plano 'trial' foi descontinuado. Idempotente pela cláusula WHERE: depois
-- da primeira execução não sobra linha para atualizar.
UPDATE bandas SET plano = 'gratuito', trial_expira_em = NULL WHERE plano = 'trial';

-- ── de migrate_banda_criador.php ─────────────────────────────────────────────
-- A coluna criador_id já foi criada em 20260813_alinhar_schema_producao.sql,
-- mas ficou sem valor: nada preenchia o criador em banco já existente. Deduz
-- o criador a partir do administrador vinculado (o mesmo critério do script
-- que está sendo apagado). Idempotente pela cláusula WHERE: depois da
-- primeira execução não sobra criador_id NULL para atualizar.
UPDATE bandas b
SET b.criador_id = (
  SELECT ub.usuario_id FROM usuario_banda ub
  WHERE ub.banda_id = b.id AND ub.perfil = 'administrador'
  ORDER BY ub.usuario_id LIMIT 1
)
WHERE b.criador_id IS NULL;

-- migrate_banda_criador.php também adicionava a FK fk_bandas_criador quando
-- ausente. MariaDB 10.4 não suporta "ADD CONSTRAINT IF NOT EXISTS" para
-- FOREIGN KEY (só a partir da 10.5), então o idempotente aqui é checar
-- information_schema e montar o DDL condicionalmente via PREPARE/EXECUTE.
SET @fk_bandas_criador_exists := (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'bandas'
    AND constraint_name = 'fk_bandas_criador'
);
SET @fk_bandas_criador_ddl := IF(
  @fk_bandas_criador_exists = 0,
  'ALTER TABLE bandas ADD CONSTRAINT fk_bandas_criador FOREIGN KEY (criador_id) REFERENCES usuarios(id) ON DELETE SET NULL',
  'DO 0'
);
PREPARE fk_bandas_criador_stmt FROM @fk_bandas_criador_ddl;
EXECUTE fk_bandas_criador_stmt;
DEALLOCATE PREPARE fk_bandas_criador_stmt;

-- ── de migrate_categorias.php ────────────────────────────────────────────────
-- Converte a classificação de texto livre (antiga) em linhas de categoria,
-- preservando o dado que já existe em musicas. Idempotente pelo INSERT
-- IGNORE somado à UNIQUE KEY uq_categorias_banda_nome: reexecutar não duplica
-- nem falha.
INSERT IGNORE INTO categorias (banda_id, nome)
SELECT DISTINCT banda_id, TRIM(classificacao)
FROM musicas
WHERE TRIM(COALESCE(classificacao, '')) <> '';

-- migrate_categorias.php também semeava 5 categorias fixas ("Louvor Animado",
-- "Marianas", "Oracionais", "Adoração", "Missa") em toda banda. Deixado de
-- fora por decisão do dono do produto: não é schema nem dado a preservar, é
-- opinião de um contexto específico — esses nomes não existem em nenhum
-- outro lugar do app — e replicá-la aqui gravaria dado opinativo em toda
-- banda de produção.
