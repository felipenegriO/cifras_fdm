<?php
class CategoriaRepository {
    private $pdo;

    public function __construct() {
        $this->pdo = Database::getConnection();
    }

    public function getAllByBanda(string $bandaId): array {
        $stmt = $this->pdo->prepare('SELECT id, nome FROM categorias WHERE banda_id = ? ORDER BY nome');
        $stmt->execute([$bandaId]);
        return $stmt->fetchAll();
    }

    public function save(array $categoria, string $bandaId): int {
        $nome = trim((string)($categoria['nome'] ?? ''));
        if (!empty($categoria['id'])) {
            $id = (int)$categoria['id'];
            $ownsTransaction = !$this->pdo->inTransaction();
            if ($ownsTransaction) $this->pdo->beginTransaction();
            try {
                $stmt = $this->pdo->prepare('SELECT nome FROM categorias WHERE id = ? AND banda_id = ? FOR UPDATE');
                $stmt->execute([$id, $bandaId]);
                $nomeAnterior = $stmt->fetchColumn();
                if ($nomeAnterior === false) {
                    throw new RuntimeException('Categoria não encontrada.');
                }
                $stmt = $this->pdo->prepare('UPDATE categorias SET nome = ? WHERE id = ? AND banda_id = ?');
                $stmt->execute([$nome, $id, $bandaId]);
                $stmt = $this->pdo->prepare('UPDATE musicas SET classificacao = ? WHERE banda_id = ? AND classificacao = ?');
                $stmt->execute([$nome, $bandaId, $nomeAnterior]);
                if ($ownsTransaction) $this->pdo->commit();
                return $id;
            } catch (Throwable $e) {
                if ($ownsTransaction && $this->pdo->inTransaction()) $this->pdo->rollBack();
                throw $e;
            }
        }

        $stmt = $this->pdo->prepare('INSERT INTO categorias (banda_id, nome) VALUES (?, ?)');
        $stmt->execute([$bandaId, $nome]);
        return (int)$this->pdo->lastInsertId();
    }

    public function existsByName(string $nome, string $bandaId): bool {
        $stmt = $this->pdo->prepare('SELECT 1 FROM categorias WHERE banda_id = ? AND nome = ? LIMIT 1');
        $stmt->execute([$bandaId, $nome]);
        return (bool)$stmt->fetchColumn();
    }

    public function delete(int $id, string $bandaId): void {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM musicas m INNER JOIN categorias c ON c.banda_id = m.banda_id AND c.nome = m.classificacao WHERE c.id = ? AND c.banda_id = ?'
        );
        $stmt->execute([$id, $bandaId]);
        if ((int)$stmt->fetchColumn() > 0) {
            throw new RuntimeException('A categoria está sendo usada por músicas e não pode ser excluída.');
        }
        $stmt = $this->pdo->prepare('DELETE FROM categorias WHERE id = ? AND banda_id = ?');
        $stmt->execute([$id, $bandaId]);
        if ($stmt->rowCount() !== 1) throw new RuntimeException('Categoria não encontrada.');
    }

    public function getVersion(string $bandaId): int {
        $stmt = $this->pdo->prepare(
            "SELECT COALESCE(CRC32(GROUP_CONCAT(CONCAT(id, ':', nome) ORDER BY id SEPARATOR '|')), 0) FROM categorias WHERE banda_id = ?"
        );
        $stmt->execute([$bandaId]);
        return (int)$stmt->fetchColumn();
    }
}
