<?php
require_once __DIR__ . '/guard.php';
// SETUP DO BANCO — REMOVER APÓS EXECUTAR
header('Content-Type: text/plain; charset=utf-8');

// Carrega .env manualmente
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $k = trim($parts[0]);
            $v = trim($parts[1], "\"'");
            putenv("$k=$v");
        }
    }
}

$host = getenv('DB_HOST') ?: 'localhost';
$db   = getenv('DB_NAME');
$user = getenv('DB_USER');
$pass = getenv('DB_PASS');

echo "Conectando em $host / $db...\n";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "Conexão OK\n\n";
} catch (Exception $e) {
    die("ERRO de conexão: " . $e->getMessage() . "\n");
}

$sql = "
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS bandas (
  id        CHAR(36)      NOT NULL,
  nome      VARCHAR(120)  NOT NULL,
  logo      MEDIUMTEXT    DEFAULT NULL,
  ativo     TINYINT(1)    NOT NULL DEFAULT 1,
  plano     ENUM('trial','gratuito','mensal','semestral','anual','bloqueado','ativo','basico','banda') NOT NULL DEFAULT 'gratuito',
  trial_expira_em DATE    DEFAULT NULL,
  stripe_subscription_id VARCHAR(100) DEFAULT NULL,
  criador_id CHAR(36) DEFAULT NULL,
  criado_em TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
  id         CHAR(36)     NOT NULL,
  nome       VARCHAR(120) NOT NULL,
  email      VARCHAR(180) NOT NULL,
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

CREATE TABLE IF NOT EXISTS usuario_banda (
  usuario_id CHAR(36) NOT NULL,
  banda_id   CHAR(36) NOT NULL,
  perfil     ENUM('administrador','gestor','basico','externo') NOT NULL DEFAULT 'basico',
  PRIMARY KEY (usuario_id, banda_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (banda_id)   REFERENCES bandas(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS musicas (
  id            INT          NOT NULL AUTO_INCREMENT,
  banda_id      CHAR(36)     NOT NULL,
  nome          VARCHAR(200) NOT NULL,
  artista       VARCHAR(200) NOT NULL DEFAULT '',
  classificacao VARCHAR(100) NOT NULL DEFAULT '',
  cifra         MEDIUMTEXT   DEFAULT NULL,
  bit           VARCHAR(50)  NOT NULL DEFAULT '',
  atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE,
  INDEX idx_musicas_banda (banda_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS band_sync_state (
  banda_id         CHAR(36)     NOT NULL,
  content_revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  atualizado_em    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (banda_id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS playlists (
  id            INT          NOT NULL AUTO_INCREMENT,
  banda_id      CHAR(36)     NOT NULL,
  nome          VARCHAR(200) NOT NULL,
  visivel_ate   DATE         DEFAULT NULL,
  itens         JSON         DEFAULT NULL,
  atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE,
  INDEX idx_playlists_banda (banda_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS roteiros (
  id            INT          NOT NULL AUTO_INCREMENT,
  banda_id      CHAR(36)     NOT NULL,
  titulo        VARCHAR(200) NOT NULL,
  conteudo      MEDIUMTEXT   DEFAULT NULL,
  visivel_ate   DATE         DEFAULT NULL,
  atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE,
  INDEX idx_roteiros_banda (banda_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS live_state (
  banda_id        CHAR(36)     NOT NULL,
  host_id         VARCHAR(64)  DEFAULT NULL,
  host_user_id    CHAR(36)     DEFAULT NULL,
  host_nome       VARCHAR(120) DEFAULT NULL,
  cifra_atual     VARCHAR(20)  NOT NULL DEFAULT '',
  pagina_atual    VARCHAR(200) NOT NULL DEFAULT 'index.php',
  scroll_top      INT          NOT NULL DEFAULT 0,
  scroll_percent  FLOAT        NOT NULL DEFAULT 0,
  can_sync_scroll TINYINT(1)   NOT NULL DEFAULT 1,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version         INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (banda_id),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token      CHAR(64)   NOT NULL,
  usuario_id CHAR(36)   NOT NULL,
  expira_em  TIMESTAMP  NOT NULL,
  usado      TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (token),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";

// Executa cada statement separadamente
$statements = array_filter(array_map('trim', explode(';', $sql)));
$ok = 0;
$erros = 0;

foreach ($statements as $stmt) {
    if ($stmt === '' || stripos($stmt, 'SET ') === 0) continue;
    // Extrai nome da tabela para exibir
    preg_match('/CREATE TABLE.*?`?(\w+)`?\s*\(/i', $stmt, $m);
    $tabela = $m[1] ?? '(?)';
    try {
        $pdo->exec($stmt);
        echo "✓ Tabela '$tabela' criada\n";
        $ok++;
    } catch (Exception $e) {
        echo "✗ '$tabela': " . $e->getMessage() . "\n";
        $erros++;
    }
}

require __DIR__ . '/migrate_banda_criador.php';
require __DIR__ . '/migrate_banda_logo.php';
require __DIR__ . '/migrate_usuario_banda_externo.php';

echo "\n--- Resultado: $ok criadas, $erros erros ---\n\n";

// Lista tabelas finais
$tabelas = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
echo "Tabelas no banco agora:\n";
foreach ($tabelas as $t) echo "  - $t\n";

echo "\n✅ PRONTO! Delete este arquivo (setup_db.php) do servidor.\n";
