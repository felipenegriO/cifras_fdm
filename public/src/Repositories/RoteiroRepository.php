<?php
class RoteiroRepository {
    private $pdo;

    public function __construct() {
        $this->pdo = Database::getConnection();
    }

    public function getAllByBanda(string $bandaId): array {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM roteiros WHERE banda_id = ? ORDER BY id'
        );
        $stmt->execute([$bandaId]);
        return $stmt->fetchAll();
    }

    public function findById(int $id, string $bandaId): ?array {
        $stmt = $this->pdo->prepare('SELECT * FROM roteiros WHERE id=? AND banda_id=?');
        $stmt->execute([$id, $bandaId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function delete(int $id, string $bandaId): void {
        $this->pdo->prepare('DELETE FROM roteiros WHERE id=? AND banda_id=?')->execute([$id, $bandaId]);
    }

    public function saveAll(array $roteiros, string $bandaId): void {
        $this->pdo->prepare('DELETE FROM roteiros WHERE banda_id=?')->execute([$bandaId]);
        $stmt = $this->pdo->prepare(
            'INSERT INTO roteiros (banda_id, titulo, conteudo, visivel_ate) VALUES (?,?,?,?)'
        );
        foreach ($roteiros as $r) {
            $stmt->execute([
                $bandaId,
                $r['titulo'],
                $r['conteudo'] ?? '',
                ($r['visivel_ate'] ?? '') ?: null,
            ]);
        }
    }
}
