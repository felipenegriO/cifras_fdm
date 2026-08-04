<?php

use PHPUnit\Framework\TestCase;

final class RepositoryAutocommitIntegrationTest extends TestCase
{
    private PDO $pdo;
    private string $bandId;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
        $this->bandId = 'phpunit-autocommit-' . bin2hex(random_bytes(8));
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$this->bandId, 'Banda Autocommit', 'gratuito']);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
        $this->pdo->prepare('DELETE FROM live_state WHERE banda_id = ?')->execute([$this->bandId]);
        $this->pdo->prepare('DELETE FROM playlists WHERE banda_id = ?')->execute([$this->bandId]);
        $this->pdo->prepare('DELETE FROM categorias WHERE banda_id = ?')->execute([$this->bandId]);
        $this->pdo->prepare('DELETE FROM bandas WHERE id = ?')->execute([$this->bandId]);
    }

    public function testCategoriaAtualizaComTransacaoPropriaEFazRollbackNoErro(): void
    {
        $repo = new CategoriaRepository();
        $id = $repo->save(['nome' => 'Entrada'], $this->bandId);

        self::assertSame($id, $repo->save(['id' => $id, 'nome' => 'Louvor'], $this->bandId));
        self::assertTrue($repo->existsByName('Louvor', $this->bandId));
        self::assertFalse($this->pdo->inTransaction());

        try {
            $repo->save(['id' => 99999999, 'nome' => 'Ausente'], $this->bandId);
            self::fail('A atualização inexistente deveria falhar.');
        } catch (RuntimeException $error) {
            self::assertSame('Categoria não encontrada.', $error->getMessage());
        }

        self::assertFalse($this->pdo->inTransaction());
    }

    public function testPlaylistSemItensRetornaColecaoVazia(): void
    {
        $stmt = $this->pdo->prepare('INSERT INTO playlists (banda_id, nome, itens) VALUES (?, ?, NULL)');
        $stmt->execute([$this->bandId, 'Sem itens']);
        $id = (int)$this->pdo->lastInsertId();
        $repo = new PlaylistRepository();

        self::assertSame([], $repo->findById($id, $this->bandId)['itens']);
        self::assertSame([], $repo->getAllByBanda($this->bandId)[0]['itens']);
    }

    public function testLiveStateInserePadroesEIgnoraAtualizacaoVazia(): void
    {
        $repo = new LiveStateRepository();
        $default = $repo->get($this->bandId);
        self::assertSame($this->bandId, $default['banda_id']);
        self::assertSame(0, $default['version']);

        $repo->update($this->bandId, []);

        self::assertSame(1, (int)$repo->get($this->bandId)['can_sync_scroll']);
        $repo->update($this->bandId, []);
        self::assertSame(1, (int)$repo->get($this->bandId)['version']);

        $repo->update($this->bandId, [
            'host_id' => str_repeat('a', 32),
            'host_nome' => 'Host PHPUnit',
            'can_sync_scroll' => 0,
        ]);
        $updated = $repo->get($this->bandId);
        self::assertSame('Host PHPUnit', $updated['host_nome']);
        self::assertSame(0, (int)$updated['can_sync_scroll']);
        self::assertSame(2, (int)$updated['version']);
    }
}
