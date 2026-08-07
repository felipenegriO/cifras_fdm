<?php
class PrivacyService
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::getConnection();
    }

    public function exportAccount(string $userId): array
    {
        $userStmt = $this->pdo->prepare('SELECT id, nome, email, perfil, ativo, validade, config, criado_em FROM usuarios WHERE id=?');
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch();
        if (!$user) throw new RuntimeException('Conta não encontrada.');
        $user['config'] = $user['config'] ? json_decode($user['config'], true) : [];

        $bandsStmt = $this->pdo->prepare(
            'SELECT b.id, b.nome, ub.perfil FROM usuario_banda ub INNER JOIN bandas b ON b.id=ub.banda_id WHERE ub.usuario_id=? ORDER BY b.nome'
        );
        $bandsStmt->execute([$userId]);

        $legalStmt = $this->pdo->prepare(
            'SELECT terms_version, privacy_version, accepted_at FROM user_legal_acceptances WHERE usuario_id=? ORDER BY accepted_at'
        );
        $legalStmt->execute([$userId]);

        return [
            'exported_at' => gmdate('c'),
            'account' => $user,
            'band_memberships' => $bandsStmt->fetchAll(),
            'legal_acceptances' => $legalStmt->fetchAll(),
        ];
    }

    public function deleteAccount(string $userId): void
    {
        $ownsTransaction = !$this->pdo->inTransaction();
        if ($ownsTransaction) $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                'SELECT ub.banda_id FROM usuario_banda ub
                 WHERE ub.usuario_id=? AND (SELECT COUNT(*) FROM usuario_banda members WHERE members.banda_id=ub.banda_id)=1'
            );
            $stmt->execute([$userId]);
            $orphanBands = $stmt->fetchAll(PDO::FETCH_COLUMN);

            $delete = $this->pdo->prepare('DELETE FROM usuarios WHERE id=?');
            $delete->execute([$userId]);
            if ($delete->rowCount() !== 1) throw new RuntimeException('Conta não encontrada.');

            $deleteBand = $this->pdo->prepare('DELETE FROM bandas WHERE id=?');
            foreach ($orphanBands as $bandId) $deleteBand->execute([$bandId]);
            if ($ownsTransaction) $this->pdo->commit();
        } catch (Throwable $error) { // @codeCoverageIgnoreStart
            if ($ownsTransaction && $this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        } // @codeCoverageIgnoreEnd
    }
}
