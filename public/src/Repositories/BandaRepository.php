<?php
class BandaRepository {
    private $pdo;

    public function __construct() {
        $this->pdo = Database::getConnection();
    }

    public function getAll(): array {
        $stmt = $this->pdo->query('SELECT * FROM bandas ORDER BY nome');
        return $stmt->fetchAll();
    }

    /** Retorna todas as bandas onde o usuário é administrador (dono). */
    public function getByUsuario(string $usuarioId): array {
        $stmt = $this->pdo->prepare(
            'SELECT b.* FROM bandas b
             JOIN usuario_banda ub ON b.id = ub.banda_id
             WHERE ub.usuario_id = ? ORDER BY b.nome'
        );
        $stmt->execute([$usuarioId]);
        return $stmt->fetchAll();
    }

    /** Conta quantas bandas o usuário administra (para checar limite do plano). */
    public function countByUsuario(string $usuarioId): int {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM bandas b
             JOIN usuario_banda ub ON b.id = ub.banda_id
             WHERE ub.usuario_id = ? AND ub.perfil = "administrador"'
        );
        $stmt->execute([$usuarioId]);
        return (int)$stmt->fetchColumn();
    }

    /**
     * Conta quantas bandas no plano gratuito o usuário administra — usado
     * para limitar a 1 banda gratuita por dono, independente de ele também
     * administrar outras bandas pagas (o plano é da banda, mas o limite de
     * "quantas bandas grátis eu posso ter" é do dono).
     */
    public function countGratuitasByUsuario(string $usuarioId): int {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM bandas b
             JOIN usuario_banda ub ON b.id = ub.banda_id
             WHERE ub.usuario_id = ? AND ub.perfil = "administrador" AND b.plano = "gratuito"'
        );
        $stmt->execute([$usuarioId]);
        return (int)$stmt->fetchColumn();
    }

    public function findById(string $id): ?array {
        $stmt = $this->pdo->prepare('SELECT * FROM bandas WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function save(array $banda): void {
        $existing = $this->findById($banda['id']);
        if ($existing) {
            $stmt = $this->pdo->prepare(
                'UPDATE bandas SET nome=?, logo=?, ativo=?, plano=?, trial_expira_em=?, stripe_subscription_id=? WHERE id=?'
            );
            $stmt->execute([
                $banda['nome'],
                $banda['logo'] ?? null,
                (int)($banda['ativo'] ?? 1),
                $banda['plano'] ?? 'gratuito',
                $banda['trial_expira_em'] ?? null,
                $banda['stripe_subscription_id'] ?? null,
                $banda['id'],
            ]);
        } else {
            $stmt = $this->pdo->prepare(
                'INSERT INTO bandas (id, nome, logo, ativo, plano, trial_expira_em, stripe_subscription_id) VALUES (?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $banda['id'],
                $banda['nome'],
                $banda['logo'] ?? null,
                (int)($banda['ativo'] ?? 1),
                $banda['plano'] ?? 'gratuito',
                $banda['trial_expira_em'] ?? null,
                $banda['stripe_subscription_id'] ?? null,
            ]);
        }
    }

    public function marcarBloqueada(string $id): void {
        $this->atualizarPlano($id, 'bloqueado');
    }

    public function atualizarPlano(string $id, string $plano): void {
        $stmt = $this->pdo->prepare('UPDATE bandas SET plano=? WHERE id=?');
        $stmt->execute([$plano, $id]);
    }

    /**
     * Ativa um plano pago, vinculando a subscription_id do Stripe.
     */
    public function ativarPlano(string $id, string $plano, string $stripeSubId): void {
        $stmt = $this->pdo->prepare(
            'UPDATE bandas SET plano=?, stripe_subscription_id=? WHERE id=?'
        );
        $stmt->execute([$plano, $stripeSubId, $id]);
    }

    /**
     * Atualiza a data de expiração do plano (armazenada de current_period_end do Stripe).
     * $periodEnd é um Unix timestamp UTC.
     */
    public function atualizarExpiracao(string $stripeSubId, int $periodEnd): void {
        $stmt = $this->pdo->prepare(
            'UPDATE bandas SET plano_expira_em = FROM_UNIXTIME(?) WHERE stripe_subscription_id = ?'
        );
        $stmt->execute([$periodEnd, $stripeSubId]);
    }

    /** Retorna a banda pelo stripe_subscription_id. */
    public function findBySubscriptionId(string $subId): ?array {
        $pdo  = Database::getConnection();
        $stmt = $pdo->prepare('SELECT * FROM bandas WHERE stripe_subscription_id = ?');
        $stmt->execute([$subId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function delete(string $id): void {
        $stmt = $this->pdo->prepare('DELETE FROM bandas WHERE id=?');
        $stmt->execute([$id]);
    }

    /** Retorna os administradores de uma banda (para notificações). */
    public function getAdmins(string $bandaId): array {
        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.nome, u.email FROM usuarios u
             JOIN usuario_banda ub ON u.id = ub.usuario_id
             WHERE ub.banda_id = ? AND ub.perfil = "administrador" AND u.ativo = 1'
        );
        $stmt->execute([$bandaId]);
        return $stmt->fetchAll();
    }
}
