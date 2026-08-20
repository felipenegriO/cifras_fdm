<?php

use PHPUnit\Framework\TestCase;

final class CategoriaRepositoryTest extends TestCase
{
    private PDO $pdo;
    private string $bandaId;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();

        $this->bandaId = 'categoria-banda-' . bin2hex(random_bytes(8));
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?,?,?)')
            ->execute([$this->bandaId, 'Banda das Categorias', 'mensal']);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) $this->pdo->rollBack();
    }

    public function testNomeEquivalenteNaoCriaCategoriaRepetida(): void
    {
        $repo = new CategoriaRepository();
        $idOriginal = $repo->save(['nome' => 'Adoração'], $this->bandaId);

        try {
            $repo->save(['nome' => 'adoracao'], $this->bandaId);
            self::fail('salvar nome equivalente deveria acusar duplicidade');
        } catch (CategoriaDuplicadaException $e) {
            self::assertSame($idOriginal, (int) $e->getCategoriaExistente()['id']);
            self::assertSame('Adoração', $e->getCategoriaExistente()['nome']);
        }

        self::assertSame(1, $repo->countByBanda($this->bandaId));
    }

    public function testNomeNovoContinuaSendoCriado(): void
    {
        $repo = new CategoriaRepository();
        $repo->save(['nome' => 'Adoração'], $this->bandaId);
        $repo->save(['nome' => 'Ministração'], $this->bandaId);

        self::assertSame(2, $repo->countByBanda($this->bandaId));
    }

    public function testRenomearParaOProprioNomeNaoAcusaDuplicidade(): void
    {
        $repo = new CategoriaRepository();
        $id = $repo->save(['nome' => 'Adoração'], $this->bandaId);

        self::assertSame($id, $repo->save(['id' => $id, 'nome' => 'ADORAÇÃO'], $this->bandaId));
    }

    public function testContagemDeCategoriasDaBanda(): void
    {
        $repo = new CategoriaRepository();
        $repo->save(['nome' => 'Adoração'], $this->bandaId);

        self::assertSame(1, $repo->countByBanda($this->bandaId));
    }
}
