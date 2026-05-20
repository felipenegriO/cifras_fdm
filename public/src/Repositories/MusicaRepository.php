<?php
class MusicaRepository {
    private $pdo;

    public function __construct() {
        $this->pdo = Database::getConnection();
    }

    public function countByBanda(string $bandaId): int {
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM musicas WHERE banda_id = ?');
        $stmt->execute([$bandaId]);
        return (int)$stmt->fetchColumn();
    }

    public function getAllByBanda(string $bandaId): array {
        $stmt = $this->pdo->prepare(
            'SELECT * FROM musicas WHERE banda_id = ? ORDER BY id'
        );
        $stmt->execute([$bandaId]);
        return $stmt->fetchAll();
    }

    public function findById(int $id, string $bandaId): ?array {
        $stmt = $this->pdo->prepare('SELECT * FROM musicas WHERE id = ? AND banda_id = ?');
        $stmt->execute([$id, $bandaId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function save(array $musica, string $bandaId): int {
        if (!empty($musica['id'])) {
            $stmt = $this->pdo->prepare(
                'UPDATE musicas SET nome=?, artista=?, classificacao=?, cifra=?, bit=? WHERE id=? AND banda_id=?'
            );
            $stmt->execute([
                $musica['nome'],
                $musica['artista'] ?? '',
                $musica['classificacao'] ?? '',
                $musica['cifra'] ?? '',
                $musica['bit'] ?? '',
                (int)$musica['id'],
                $bandaId,
            ]);
            return (int)$musica['id'];
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO musicas (banda_id, nome, artista, classificacao, cifra, bit) VALUES (?,?,?,?,?,?)'
        );
        $stmt->execute([
            $bandaId,
            $musica['nome'],
            $musica['artista'] ?? '',
            $musica['classificacao'] ?? '',
            $musica['cifra'] ?? '',
            $musica['bit'] ?? '',
        ]);
        return (int)$this->pdo->lastInsertId();
    }

    public function delete(int $id, string $bandaId): void {
        $stmt = $this->pdo->prepare('DELETE FROM musicas WHERE id=? AND banda_id=?');
        $stmt->execute([$id, $bandaId]);
    }

    public function copy(int $id, string $bandaId): int {
        $original = $this->findById($id, $bandaId);
        if (!$original) throw new RuntimeException('Música não encontrada.');
        $stmt = $this->pdo->prepare(
            'INSERT INTO musicas (banda_id, nome, artista, classificacao, cifra, bit)
             VALUES (?,?,?,?,?,?)'
        );
        $stmt->execute([
            $bandaId,
            'Cópia de ' . $original['nome'],
            $original['artista'],
            $original['classificacao'],
            $original['cifra'],
            $original['bit'],
        ]);
        return (int)$this->pdo->lastInsertId();
    }

    public function getVersion(string $bandaId): int {
        $stmt = $this->pdo->prepare(
            'SELECT COALESCE(MAX(UNIX_TIMESTAMP(atualizado_em)),0) as v FROM musicas WHERE banda_id=?'
        );
        $stmt->execute([$bandaId]);
        return (int)$stmt->fetchColumn();
    }
}
