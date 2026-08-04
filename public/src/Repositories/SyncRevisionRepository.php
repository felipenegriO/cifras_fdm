<?php
class SyncRevisionRepository {
    private PDO $pdo;

    public function __construct() {
        $this->pdo = Database::getConnection();
    }

    public function get(string $bandaId): int {
        $stmt = $this->pdo->prepare('SELECT content_revision FROM band_sync_state WHERE banda_id = ?');
        $stmt->execute([$bandaId]);
        return (int)($stmt->fetchColumn() ?: 0);
    }

    public function mutate(string $bandaId, $baseRevision, callable $operation): array {
        $this->pdo->beginTransaction();
        try {
            $this->pdo->prepare('INSERT IGNORE INTO band_sync_state (banda_id, content_revision) VALUES (?, 0)')->execute([$bandaId]);
            $stmt = $this->pdo->prepare('SELECT content_revision FROM band_sync_state WHERE banda_id = ? FOR UPDATE');
            $stmt->execute([$bandaId]);
            $current = (int)$stmt->fetchColumn();
            if ($baseRevision !== null && $baseRevision !== '' && (int)$baseRevision !== $current) {
                throw new SyncConflictException($current);
            }
            $result = $operation();
            $revision = $current + 1;
            $this->pdo->prepare('UPDATE band_sync_state SET content_revision = ? WHERE banda_id = ?')->execute([$revision, $bandaId]);
            $this->pdo->commit();
            return ['result' => $result, 'revision' => $revision];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $e;
        }
    }
}
