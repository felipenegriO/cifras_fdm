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

    public function mutate(string $bandaId, $baseRevision, callable $operation, $changes = []): array {
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
            $resolvedChanges = is_callable($changes) ? $changes($result) : $changes;
            if ($resolvedChanges) {
                try {
                    $stmtChange = $this->pdo->prepare('INSERT INTO sync_changes (banda_id, revision, entity_type, entity_id, operation) VALUES (?,?,?,?,?)');
                    foreach ($resolvedChanges as $change) {
                        $stmtChange->execute([$bandaId, $revision, $change['type'], (int)($change['id'] ?? 0), $change['operation']]);
                    }
                } catch (PDOException $e) {
                    if ($e->getCode() !== '42S02') throw $e;
                }
            }
            $this->pdo->commit();
            return ['result' => $result, 'revision' => $revision];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $e;
        }
    }

    public function changesSince(string $bandaId, int $revision): ?array {
        try {
            $stmt = $this->pdo->prepare('SELECT revision, entity_type, entity_id, operation FROM sync_changes WHERE banda_id = ? AND revision > ? ORDER BY revision, id');
            $stmt->execute([$bandaId, $revision]);
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            if ($e->getCode() === '42S02') return null;
            throw $e;
        }
    }
}
