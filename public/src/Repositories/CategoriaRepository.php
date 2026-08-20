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
                $equivalente = $this->findEquivalente($nome, $bandaId, $id);
                if ($equivalente !== null) throw new CategoriaDuplicadaException($equivalente);
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

        $equivalente = $this->findEquivalente($nome, $bandaId);
        if ($equivalente !== null) throw new CategoriaDuplicadaException($equivalente);

        $stmt = $this->pdo->prepare('INSERT INTO categorias (banda_id, nome) VALUES (?, ?)');
        $stmt->execute([$bandaId, $nome]);
        return (int)$this->pdo->lastInsertId();
    }

    public function existsByName(string $nome, string $bandaId): bool {
        $stmt = $this->pdo->prepare('SELECT 1 FROM categorias WHERE banda_id = ? AND nome = ? LIMIT 1');
        $stmt->execute([$bandaId, $nome]);
        return (bool)$stmt->fetchColumn();
    }

    /**
     * Mapa explícito em vez de iconv//TRANSLIT: o resultado do TRANSLIT muda
     * conforme a biblioteca C do sistema, e a comparação precisa dar o mesmo
     * resultado no XAMPP do desenvolvimento e no servidor de produção.
     */
    private const ACENTOS = [
        'á'=>'a','à'=>'a','ã'=>'a','â'=>'a','ä'=>'a',
        'é'=>'e','è'=>'e','ê'=>'e','ë'=>'e',
        'í'=>'i','ì'=>'i','î'=>'i','ï'=>'i',
        'ó'=>'o','ò'=>'o','õ'=>'o','ô'=>'o','ö'=>'o',
        'ú'=>'u','ù'=>'u','û'=>'u','ü'=>'u',
        'ç'=>'c','ñ'=>'n',
    ];

    public static function normalizarNome(string $nome): string {
        $semEspacoDuplo = preg_replace('/\s+/u', ' ', trim($nome));
        return strtr(mb_strtolower($semEspacoDuplo, 'UTF-8'), self::ACENTOS);
    }

    /** @return array{id:int,nome:string}|null */
    public function findEquivalente(string $nome, string $bandaId, int $ignorarId = 0): ?array {
        $stmt = $this->pdo->prepare('SELECT id, nome FROM categorias WHERE banda_id = ? ORDER BY id');
        $stmt->execute([$bandaId]);
        $alvo = self::normalizarNome($nome);
        foreach ($stmt->fetchAll() as $categoria) {
            if ((int) $categoria['id'] === $ignorarId) continue;
            if (self::normalizarNome((string) $categoria['nome']) === $alvo) {
                return ['id' => (int) $categoria['id'], 'nome' => (string) $categoria['nome']];
            }
        }
        return null;
    }

    public function countByBanda(string $bandaId): int {
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM categorias WHERE banda_id = ?');
        $stmt->execute([$bandaId]);
        return (int) $stmt->fetchColumn();
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
