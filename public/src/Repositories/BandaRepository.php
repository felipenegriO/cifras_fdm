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
                $banda['plano'] ?? 'trial',
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
                $banda['plano'] ?? 'trial',
                $banda['trial_expira_em'] ?? null,
                $banda['stripe_subscription_id'] ?? null,
            ]);
        }
    }

    public function marcarBloqueada(string $id): void {
        $stmt = $this->pdo->prepare('UPDATE bandas SET plano=? WHERE id=?');
        $stmt->execute(['bloqueado', $id]);
    }

    public function delete(string $id): void {
        $stmt = $this->pdo->prepare('DELETE FROM bandas WHERE id=?');
        $stmt->execute([$id]);
    }
}
