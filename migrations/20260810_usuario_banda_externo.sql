ALTER TABLE usuario_banda
  MODIFY COLUMN perfil ENUM('administrador','gestor','basico','externo') NOT NULL DEFAULT 'basico';
