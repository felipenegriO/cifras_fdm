<?php
/**
 * Convites de banda por link (ROLE-003).
 *
 * Guarda só o SHA-256 do token, como password_reset_tokens: o valor em claro
 * existe apenas dentro do link que o administrador compartilha. A consequência
 * é que um link já compartilhado NÃO pode ser recuperado do banco — por isso
 * gerar de novo não revoga o anterior, senão tocar "Convidar" duas vezes
 * mataria em silêncio o link recém-enviado ao grupo.
 */
class BandaConviteRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::getConnection();
    }

    /** Cria um convite e devolve o token EM CLARO — única chance de vê-lo. */
    public function gerar(string $bandaId, ?string $criadoPor = null, ?int $agora = null): string
    {
        $token = bin2hex(random_bytes(32));
        $this->pdo->prepare(
            'INSERT INTO banda_convites (token, banda_id, criado_por, expira_em) VALUES (?,?,?,?)'
        )->execute([
            $this->hash($token),
            $bandaId,
            $criadoPor ?: null,
            BandaConvitePolicy::expiraEm($agora),
        ]);
        return $token;
    }

    /** Linha bruta do convite. NÃO decide se vale — quem decide é BandaConvitePolicy. */
    public function buscarPorToken(string $token): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM banda_convites WHERE token = ?');
        $stmt->execute([$this->hash($token)]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /** Estado agregado dos convites vivos da banda, para a linha do administrador. */
    public function resumoDaBanda(string $bandaId): ?array
    {
        $now = date('Y-m-d H:i:s');
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) AS ativos, MAX(expira_em) AS expira_em, COALESCE(SUM(usos), 0) AS usos
               FROM banda_convites
              WHERE banda_id = ? AND revogado_em IS NULL AND expira_em > ?'
        );
        $stmt->execute([$bandaId, $now]);
        $linha = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$linha || (int) $linha['ativos'] === 0) return null;

        return [
            'ativos'    => (int) $linha['ativos'],
            'expira_em' => (string) $linha['expira_em'],
            'usos'      => (int) $linha['usos'],
        ];
    }

    public function revogarDaBanda(string $bandaId): void
    {
        $this->pdo->prepare(
            'UPDATE banda_convites SET revogado_em = NOW() WHERE banda_id = ? AND revogado_em IS NULL'
        )->execute([$bandaId]);
    }

    public function registrarUso(string $token): void
    {
        $this->pdo->prepare('UPDATE banda_convites SET usos = usos + 1 WHERE token = ?')
            ->execute([$this->hash($token)]);
    }

    private function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
