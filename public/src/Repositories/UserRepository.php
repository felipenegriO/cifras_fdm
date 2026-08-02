<?php
class UserRepository {
    private $pdo;

    /** @param string|null $usersFile kept for backwards-compat but ignored */
    public function __construct($usersFile = null) {
        $this->pdo = Database::getConnection();
    }

    public function countByBanda(string $bandaId): int {
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM usuario_banda WHERE banda_id = ?');
        $stmt->execute([$bandaId]);
        return (int)$stmt->fetchColumn();
    }

    public function findByUsername(string $username): ?array {
        $stmt = $this->pdo->prepare(
            'SELECT u.*, ub.perfil AS banda_perfil, ub.banda_id
             FROM usuarios u
             LEFT JOIN usuario_banda ub ON u.id = ub.usuario_id
             WHERE LOWER(u.username) = LOWER(?)'
        );
        $stmt->execute([$username]);
        $rows = $stmt->fetchAll();

        if (empty($rows)) return null;

        $user = $rows[0];
        $user['bandas'] = [];
        foreach ($rows as $row) {
            if ($row['banda_id']) {
                $user['bandas'][] = [
                    'id'    => $row['banda_id'],
                    'perfil'=> $row['banda_perfil'],
                ];
            }
        }
        unset($user['banda_id'], $user['banda_perfil']);

        // Legacy field names used by AuthService and session
        $user['senhaHash'] = $user['senha_hash'] ?? null;
        $user['config']    = $user['config'] ? json_decode($user['config'], true) : [];

        return $user;
    }

    public function findByGoogleSub(string $sub): ?array {
        $stmt = $this->pdo->prepare(
            'SELECT u.*, ub.perfil AS banda_perfil, ub.banda_id
             FROM usuarios u
             LEFT JOIN usuario_banda ub ON u.id = ub.usuario_id
             WHERE u.google_sub = ?'
        );
        $stmt->execute([$sub]);
        $rows = $stmt->fetchAll();

        if (empty($rows)) return null;

        $user = $rows[0];
        $user['bandas'] = [];
        foreach ($rows as $row) {
            if ($row['banda_id']) {
                $user['bandas'][] = [
                    'id'    => $row['banda_id'],
                    'perfil'=> $row['banda_perfil'],
                ];
            }
        }
        unset($user['banda_id'], $user['banda_perfil']);

        $user['senhaHash'] = $user['senha_hash'] ?? null;
        $user['config']    = $user['config'] ? json_decode($user['config'], true) : [];

        return $user;
    }

    public function linkGoogleSub(string $userId, string $sub): void {
        $this->pdo->prepare('UPDATE usuarios SET google_sub=? WHERE id=?')->execute([$sub, $userId]);
    }

    public function findById(string $id): ?array {
        $stmt = $this->pdo->prepare('SELECT * FROM usuarios WHERE id=?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $row['senhaHash'] = $row['senha_hash'] ?? null;
        $row['config']    = $row['config'] ? json_decode($row['config'], true) : [];
        return $row;
    }

    public function getAll(): array {
        $stmt = $this->pdo->query('SELECT * FROM usuarios ORDER BY nome');
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['senhaHash'] = $row['senha_hash'] ?? null;
            $row['config']    = $row['config'] ? json_decode($row['config'], true) : [];
        }
        return $rows;
    }

    public function save(array $user): void {
        $config = isset($user['config']) && is_array($user['config'])
            ? json_encode($user['config'], JSON_UNESCAPED_UNICODE)
            : null;

        $senha_hash = $user['senhaHash'] ?? $user['senha_hash'] ?? null;
        $googleSub  = $user['google_sub'] ?? null;

        $existing = $this->findById($user['id']);
        if ($existing) {
            $stmt = $this->pdo->prepare(
                'UPDATE usuarios SET nome=?, email=?, senha_hash=?, perfil=?,
                 ativo=?, validade=?, config=?, google_sub=COALESCE(?, google_sub) WHERE id=?'
            );
            $stmt->execute([
                $user['nome'],
                $user['email'] ?? null,
                $senha_hash,
                $user['perfil'] ?? 'usuario',
                (int)($user['ativo'] ?? 1),
                ($user['validade'] ?? '') ?: null,
                $config,
                $googleSub,
                $user['id'],
            ]);
        } else {
            $stmt = $this->pdo->prepare(
                'INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, validade, config, google_sub)
                 VALUES (?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $user['id'],
                $user['nome'],
                $user['email'] ?? null,
                $senha_hash,
                $user['perfil'] ?? 'usuario',
                (int)($user['ativo'] ?? 1),
                ($user['validade'] ?? '') ?: null,
                $config,
                $googleSub,
            ]);
        }

        if (isset($user['bandas']) && is_array($user['bandas'])) {
            $this->pdo->prepare('DELETE FROM usuario_banda WHERE usuario_id=?')->execute([$user['id']]);
            $ins = $this->pdo->prepare(
                'INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)'
            );
            foreach ($user['bandas'] as $b) {
                $ins->execute([$user['id'], $b['id'], $b['perfil']]);
            }
        }
    }

    public function updateConfig(string $userId, array $config): void {
        $stmt = $this->pdo->prepare('SELECT config FROM usuarios WHERE id=?');
        $stmt->execute([$userId]);
        $existing = $stmt->fetchColumn();
        $existing = $existing ? json_decode($existing, true) : [];
        $merged = array_merge($existing, $config);
        $this->pdo->prepare('UPDATE usuarios SET config=? WHERE id=?')
            ->execute([json_encode($merged, JSON_UNESCAPED_UNICODE), $userId]);
    }

    public function delete(string $id): void {
        $this->pdo->prepare('DELETE FROM usuarios WHERE id=?')->execute([$id]);
    }

    public function getBandasDoUsuario(string $userId): array {
        $stmt = $this->pdo->prepare(
            'SELECT b.*, ub.perfil AS usuario_perfil
             FROM bandas b
             JOIN usuario_banda ub ON b.id = ub.banda_id
             WHERE ub.usuario_id = ?
             ORDER BY b.nome'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function getByBanda(string $bandaId): array {
        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.nome, u.username, u.ativo, u.validade, u.perfil,
                    ub.perfil AS banda_perfil
             FROM usuarios u
             JOIN usuario_banda ub ON u.id = ub.usuario_id
             WHERE ub.banda_id = ?
             ORDER BY u.nome'
        );
        $stmt->execute([$bandaId]);
        return $stmt->fetchAll();
    }

    public function saveToBanda(array $userData, string $bandaId, string $bandaPerfil): string {
        $id = $userData['id'] ?? null;
        if (!$id) $id = bin2hex(random_bytes(16));

        $senhaHash = null;
        if (!empty($userData['_senhaPlain'])) {
            $senhaHash = password_hash($userData['_senhaPlain'], PASSWORD_DEFAULT);
        }

        $email = ($userData['email'] ?? '') ?: null;

        $existing = $this->findById($id);
        if ($existing) {
            if ($senhaHash) {
                $this->pdo->prepare('UPDATE usuarios SET nome=?, username=?, email=?, ativo=?, validade=?, senha_hash=? WHERE id=?')
                    ->execute([$userData['nome'], $userData['username'], $email, (int)($userData['ativo'] ?? 1), ($userData['validade'] ?? '') ?: null, $senhaHash, $id]);
            } else {
                $this->pdo->prepare('UPDATE usuarios SET nome=?, username=?, email=?, ativo=?, validade=? WHERE id=?')
                    ->execute([$userData['nome'], $userData['username'], $email, (int)($userData['ativo'] ?? 1), ($userData['validade'] ?? '') ?: null, $id]);
            }
        } else {
            $this->pdo->prepare(
                'INSERT INTO usuarios (id, nome, username, email, senha_hash, perfil, ativo, validade) VALUES (?,?,?,?,?,?,?,?)'
            )->execute([
                $id, $userData['nome'], $userData['username'], $email,
                $senhaHash, 'usuario',
                (int)($userData['ativo'] ?? 1),
                ($userData['validade'] ?? '') ?: null,
            ]);
        }

        $this->pdo->prepare(
            'INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)
             ON DUPLICATE KEY UPDATE perfil=?'
        )->execute([$id, $bandaId, $bandaPerfil, $bandaPerfil]);

        return $id;
    }

    public function removeFromBanda(string $userId, string $bandaId): void {
        $this->pdo->prepare('DELETE FROM usuario_banda WHERE usuario_id=? AND banda_id=?')
            ->execute([$userId, $bandaId]);
    }

    public function searchNotInBanda(string $bandaId, string $search): array {
        $like = '%' . $search . '%';
        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.nome, u.username, u.ativo
             FROM usuarios u
             WHERE u.id NOT IN (SELECT usuario_id FROM usuario_banda WHERE banda_id=?)
               AND (u.nome LIKE ? OR u.username LIKE ?)
             ORDER BY u.nome LIMIT 20'
        );
        $stmt->execute([$bandaId, $like, $like]);
        return $stmt->fetchAll();
    }

    public function importToBanda(string $userId, string $bandaId, string $perfil): void {
        $this->pdo->prepare(
            'INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)
             ON DUPLICATE KEY UPDATE perfil=?'
        )->execute([$userId, $bandaId, $perfil, $perfil]);
    }

    public function findByEmail(string $email): ?array {
        $stmt = $this->pdo->prepare('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?)');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $row['senhaHash'] = $row['senha_hash'] ?? null;
        $row['config']    = $row['config'] ? json_decode($row['config'], true) : [];
        return $row;
    }

    public function findByUsernameOrEmail(string $q): ?array {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM usuarios WHERE LOWER(username)=LOWER(?) OR LOWER(email)=LOWER(?)'
        );
        $stmt->execute([$q, $q]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $row['senhaHash'] = $row['senha_hash'] ?? null;
        $row['config']    = $row['config'] ? json_decode($row['config'], true) : [];
        return $row;
    }

    public function activate(string $userId, string $senhaHash): void {
        $this->pdo->prepare(
            'UPDATE usuarios SET ativo=1, senha_hash=? WHERE id=?'
        )->execute([$senhaHash, $userId]);
    }

    public function updatePassword(string $userId, string $senhaHash): void {
        $this->pdo->prepare('UPDATE usuarios SET senha_hash=? WHERE id=?')
            ->execute([$senhaHash, $userId]);
    }

    // ── Token management ─────────────────────────────────────────────────────

    public function createToken(string $userId, int $ttlSeconds = 172800): string {
        $token    = bin2hex(random_bytes(32)); // 64-char hex
        $expiraEm = date('Y-m-d H:i:s', time() + $ttlSeconds);
        $this->pdo->prepare(
            'INSERT INTO password_reset_tokens (token, usuario_id, expira_em, usado) VALUES (?,?,?,0)'
        )->execute([$token, $userId, $expiraEm]);
        return $token;
    }

    /** Returns userId if token is valid and unused; null otherwise. Marks token as used. */
    public function consumeToken(string $token): ?string {
        $stmt = $this->pdo->prepare(
            'SELECT usuario_id, expira_em, usado FROM password_reset_tokens WHERE token=?'
        );
        $stmt->execute([$token]);
        $row = $stmt->fetch();

        if (!$row) return null;
        if ($row['usado']) return null;
        if (strtotime($row['expira_em']) < time()) return null;

        $this->pdo->prepare('UPDATE password_reset_tokens SET usado=1 WHERE token=?')
            ->execute([$token]);

        return $row['usuario_id'];
    }

    /** Peek at token without consuming it — returns userId or null. */
    public function peekToken(string $token): ?string {
        $stmt = $this->pdo->prepare(
            'SELECT usuario_id, expira_em, usado FROM password_reset_tokens WHERE token=?'
        );
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        if (!$row || $row['usado'] || strtotime($row['expira_em']) < time()) return null;
        return $row['usuario_id'];
    }
}
