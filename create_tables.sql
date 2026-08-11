-- Cifrô: Schema MySQL
-- Execute uma vez no Hostinger para criar todas as tabelas

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Bandas
CREATE TABLE IF NOT EXISTS bandas (
  id        CHAR(36)      NOT NULL,
  nome      VARCHAR(120)  NOT NULL,
  logo      MEDIUMTEXT    DEFAULT NULL,
  ativo     TINYINT(1)    NOT NULL DEFAULT 1,
  plano     ENUM('trial','gratuito','mensal','semestral','anual','bloqueado','ativo','basico','banda') NOT NULL DEFAULT 'gratuito',
  trial_expira_em DATE    DEFAULT NULL,
  stripe_subscription_id VARCHAR(100) DEFAULT NULL,
  plano_expira_em        DATETIME    DEFAULT NULL,
  -- Cancelamento self-service: marcado quando o administrador pede o
  -- cancelamento. A assinatura segue ativa até plano_expira_em; quem faz o
  -- downgrade de fato é o webhook customer.subscription.deleted do Stripe.
  cancelamento_agendado_em DATETIME  DEFAULT NULL,
  criador_id CHAR(36)      DEFAULT NULL,
  criado_em TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bandas_stripe_subscription (stripe_subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS band_sync_state (
  banda_id         CHAR(36)     NOT NULL,
  content_revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  atualizado_em    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (banda_id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id         CHAR(36)     NOT NULL,
  nome       VARCHAR(120) NOT NULL,
  -- Nulo é permitido de propósito: membros adicionados à banda pelo gestor
  -- podem não ter e-mail (UserRepository::saveToBanda grava NULL quando vazio).
  -- MySQL aceita vários NULL numa UNIQUE KEY, então uq_email continua válido.
  email      VARCHAR(180) DEFAULT NULL,
  senha_hash VARCHAR(255) DEFAULT NULL,
  perfil     ENUM('master','usuario') NOT NULL DEFAULT 'usuario',
  ativo      TINYINT(1)   NOT NULL DEFAULT 1,
  validade   DATE         DEFAULT NULL,
  plano      ENUM('trial','ativo','bloqueado') NOT NULL DEFAULT 'ativo',
  trial_expira_em DATE    DEFAULT NULL,
  config     JSON         DEFAULT NULL,
  criado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Google account linking (one-time migration; re-running on an existing DB
-- that already has this column/key errors — apply once per environment)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) DEFAULT NULL;
ALTER TABLE usuarios ADD UNIQUE KEY IF NOT EXISTS uq_google_sub (google_sub);

-- Vínculo usuário ↔ banda
CREATE TABLE IF NOT EXISTS usuario_banda (
  usuario_id CHAR(36) NOT NULL,
  banda_id   CHAR(36) NOT NULL,
  perfil     ENUM('administrador','gestor','basico','externo') NOT NULL DEFAULT 'basico',
  PRIMARY KEY (usuario_id, banda_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (banda_id)   REFERENCES bandas(id)   ON DELETE CASCADE,
  INDEX idx_usuario_banda_banda_perfil (banda_id, perfil)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE bandas
  ADD CONSTRAINT fk_bandas_criador FOREIGN KEY (criador_id) REFERENCES usuarios(id) ON DELETE SET NULL;

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

-- Músicas
CREATE TABLE IF NOT EXISTS musicas (
  id           INT          NOT NULL AUTO_INCREMENT,
  banda_id     CHAR(36)     NOT NULL,
  nome         VARCHAR(200) NOT NULL,
  artista      VARCHAR(200) NOT NULL DEFAULT '',
  classificacao VARCHAR(100) NOT NULL DEFAULT '',
  cifra        MEDIUMTEXT   DEFAULT NULL,
  bit          VARCHAR(50)  NOT NULL DEFAULT '',
  source_url   VARCHAR(2048) DEFAULT NULL,
  atualizado_em TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE,
  INDEX idx_musicas_banda (banda_id),
  INDEX idx_musicas_banda_atualizado (banda_id, atualizado_em),
  INDEX idx_musicas_banda_classificacao (banda_id, classificacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Categorias de músicas por banda
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

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
  id           INT          NOT NULL AUTO_INCREMENT,
  banda_id     CHAR(36)     NOT NULL,
  nome         VARCHAR(200) NOT NULL,
  visivel_ate  DATE         DEFAULT NULL,
  itens        JSON         DEFAULT NULL,
  atualizado_em TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE,
  INDEX idx_playlists_banda (banda_id),
  INDEX idx_playlists_banda_visibilidade (banda_id, visivel_ate, atualizado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Roteiros
CREATE TABLE IF NOT EXISTS roteiros (
  id           INT          NOT NULL AUTO_INCREMENT,
  banda_id     CHAR(36)     NOT NULL,
  titulo       VARCHAR(200) NOT NULL,
  conteudo     MEDIUMTEXT   DEFAULT NULL,
  visivel_ate  DATE         DEFAULT NULL,
  atualizado_em TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE,
  INDEX idx_roteiros_banda (banda_id),
  INDEX idx_roteiros_banda_visibilidade (banda_id, visivel_ate, atualizado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Estado do modo live (por banda)
CREATE TABLE IF NOT EXISTS live_state (
  banda_id         CHAR(36)     NOT NULL,
  host_id          VARCHAR(64)  DEFAULT NULL,
  host_user_id     CHAR(36)     DEFAULT NULL,
  host_nome        VARCHAR(120) DEFAULT NULL,
  cifra_atual      VARCHAR(20)  NOT NULL DEFAULT '',
  pagina_atual     VARCHAR(200) NOT NULL DEFAULT 'index.php',
  scroll_top       INT          NOT NULL DEFAULT 0,
  scroll_percent   FLOAT        NOT NULL DEFAULT 0,
  can_sync_scroll  TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version          INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (banda_id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tokens de reset de senha
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token      CHAR(64)  NOT NULL,
  usuario_id CHAR(36)  NOT NULL,
  expira_em  TIMESTAMP NOT NULL,
  usado      TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (token),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- Log de erros da aplicação (ErrorLogger / api/log-js-error.php).
CREATE TABLE IF NOT EXISTS app_error_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nivel      ENUM('error','warning','info') NOT NULL DEFAULT 'error',
  referencia VARCHAR(255) NOT NULL DEFAULT '',
  descricao  VARCHAR(500) NOT NULL,
  detalhes   JSON         DEFAULT NULL,
  criado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_app_error_logs_criado (criado_em),
  INDEX idx_app_error_logs_nivel (nivel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Migração de planos: executar em bases já existentes ──────────────────────
UPDATE bandas SET plano = 'gratuito', trial_expira_em = NULL WHERE plano = 'trial';
ALTER TABLE bandas MODIFY COLUMN plano ENUM('trial','gratuito','mensal','semestral','anual','bloqueado','ativo','basico','banda') NOT NULL DEFAULT 'gratuito';

-- ── Cancelamento self-service: executar em bases já existentes ───────────────
ALTER TABLE bandas ADD COLUMN cancelamento_agendado_em DATETIME DEFAULT NULL;

-- ── Membro de banda sem e-mail: executar em bases já existentes ──────────────
ALTER TABLE usuarios MODIFY COLUMN email VARCHAR(180) DEFAULT NULL;
