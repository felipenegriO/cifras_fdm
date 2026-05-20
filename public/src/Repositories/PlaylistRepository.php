<?php
class PlaylistRepository {
    private $pdo;

    public function __construct() {
        $this->pdo = Database::getConnection();
    }

    public function countByBanda(string $bandaId): int {
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM playlists WHERE banda_id = ?');
        $stmt->execute([$bandaId]);
        return (int)$stmt->fetchColumn();
    }

    public function getAllByBanda(string $bandaId): array {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM playlists WHERE banda_id = ? ORDER BY id'
        );
        $stmt->execute([$bandaId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['itens'] = $row['itens'] ? json_decode($row['itens'], true) : [];
        }
        return $rows;
    }

    public function findById(int $id, string $bandaId): ?array {
        $stmt = $this->pdo->prepare('SELECT * FROM playlists WHERE id=? AND banda_id=?');
        $stmt->execute([$id, $bandaId]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $row['itens'] = $row['itens'] ? json_decode($row['itens'], true) : [];
        return $row;
    }

    public function saveAll(array $playlists, string $bandaId): void {
        $this->pdo->prepare('DELETE FROM playlists WHERE banda_id=?')->execute([$bandaId]);
        $stmt = $this->pdo->prepare(
            'INSERT INTO playlists (banda_id, nome, visivel_ate, itens) VALUES (?,?,?,?)'
        );
        foreach ($playlists as $p) {
            $stmt->execute([
                $bandaId,
                $p['nome'],
                ($p['visivel_ate'] ?? '') ?: null,
                json_encode($p['itens'] ?? [], JSON_UNESCAPED_UNICODE),
            ]);
        }
    }
}
