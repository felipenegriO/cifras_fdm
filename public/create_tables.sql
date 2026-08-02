-- StageBox - Cifras: Schema MySQL
-- Execute uma vez no Hostinger para criar todas as tabelas

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- Bandas
CREATE TABLE IF NOT EXISTS bandas (
  id        CHAR(36)      NOT NULL,
  nome      VARCHAR(120)  NOT NULL,
  logo      VARCHAR(255)  DEFAULT NULL,
  ativo     TINYINT(1)    NOT NULL DEFAULT 1,
  plano     ENUM('trial','gratuito','basico','banda','bloqueado','ativo') NOT NULL DEFAULT 'trial',
  trial_expira_em DATE    DEFAULT NULL,
  stripe_subscription_id VARCHAR(100) DEFAULT NULL,
  criado_em TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id         CHAR(36)     NOT NULL,
  nome       VARCHAR(120) NOT NULL,
  username   VARCHAR(60)  NOT NULL,
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
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Google account linking (one-time migration; re-running on an existing DB
-- that already has this column/key errors — apply once per environment)
ALTER TABLE usuarios ADD COLUMN google_sub VARCHAR(255) DEFAULT NULL;
ALTER TABLE usuarios ADD UNIQUE KEY uq_google_sub (google_sub);

-- Vínculo usuário ↔ banda
CREATE TABLE IF NOT EXISTS usuario_banda (
  usuario_id CHAR(36) NOT NULL,
  banda_id   CHAR(36) NOT NULL,
  perfil     ENUM('administrador','gestor','basico') NOT NULL DEFAULT 'basico',
  PRIMARY KEY (usuario_id, banda_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (banda_id)   REFERENCES bandas(id)   ON DELETE CASCADE
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
  atualizado_em TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE,
  INDEX idx_musicas_banda (banda_id)
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
  INDEX idx_playlists_banda (banda_id)
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
  INDEX idx_roteiros_banda (banda_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Estado do modo live (por banda)
CREATE TABLE IF NOT EXISTS live_state (
  banda_id         CHAR(36)     NOT NULL,
  host_id          VARCHAR(64)  DEFAULT NULL,
  host_user_id     CHAR(36)     DEFAULT NULL,
  host_username    VARCHAR(60)  DEFAULT NULL,
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

-- ── Migração de planos: executar em bases já existentes ──────────────────────
-- ALTER TABLE bandas MODIFY COLUMN plano ENUM('trial','gratuito','basico','banda','bloqueado','ativo') NOT NULL DEFAULT 'trial';
-- UPDATE bandas SET plano = 'banda' WHERE plano = 'ativo';
