<?php
/**
 * UsuarioMusicaRepository — personalização de um músico sobre uma música da
 * banda. Hoje guarda o capotraste; é a mesma tabela que o NOTE-001 usará para
 * anotações pessoais.
 *
 * Toda consulta inclui usuario_id E banda_id: a linha é privada, e nenhum
 * integrante pode alcançar a de outro nem a de outra banda.
 */
class UsuarioMusicaRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Database::getConnection();
    }

    public function listarPorUsuario(string $usuarioId, string $bandaId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT musica_id, transposicao_instrumento, base_transposicao, base_tom
             FROM usuario_musica WHERE usuario_id=? AND banda_id=? ORDER BY musica_id'
        );
        $stmt->execute([$usuarioId, $bandaId]);

        return array_map(static fn(array $row): array => [
            'musica_id' => (int) $row['musica_id'],
            'transposicao_instrumento' => $row['transposicao_instrumento'] === null ? null : (int) $row['transposicao_instrumento'],
            'base_transposicao' => $row['base_transposicao'] === null ? null : (int) $row['base_transposicao'],
            'base_tom' => $row['base_tom'],
        ], $stmt->fetchAll());
    }

    public function salvar(string $usuarioId, string $bandaId, int $musicaId, int $valor, ?int $baseTransposicao, ?string $baseTom): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO usuario_musica (usuario_id, banda_id, musica_id, transposicao_instrumento, base_transposicao, base_tom)
             VALUES (?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE transposicao_instrumento=VALUES(transposicao_instrumento),
                                     base_transposicao=VALUES(base_transposicao),
                                     base_tom=VALUES(base_tom)'
        );
        $stmt->execute([$usuarioId, $bandaId, $musicaId, $valor, $baseTransposicao, $baseTom]);
    }

    /** Resolve o conflito a favor do músico: mantém a escolha, adota a base nova. */
    public function atualizarBase(string $usuarioId, string $bandaId, int $musicaId, ?int $baseTransposicao, ?string $baseTom): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE usuario_musica SET base_transposicao=?, base_tom=?
             WHERE usuario_id=? AND banda_id=? AND musica_id=?'
        );
        $stmt->execute([$baseTransposicao, $baseTom, $usuarioId, $bandaId, $musicaId]);
    }

    public function remover(string $usuarioId, string $bandaId, int $musicaId): void
    {
        $stmt = $this->pdo->prepare(
            'DELETE FROM usuario_musica WHERE usuario_id=? AND banda_id=? AND musica_id=?'
        );
        $stmt->execute([$usuarioId, $bandaId, $musicaId]);
    }
}
