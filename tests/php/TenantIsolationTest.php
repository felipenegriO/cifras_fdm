<?php

use PHPUnit\Framework\TestCase;

/**
 * Confirma que uma banda não consegue ler, alterar, excluir ou copiar dados
 * de outra banda através dos repositórios — isolamento multi-tenant no nível
 * de dados (WHERE banda_id = ?), independente da camada HTTP/sessão.
 */
final class TenantIsolationTest extends TestCase
{
    private PDO $pdo;
    private string $bandaA;
    private string $bandaB;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();
        $suffix = bin2hex(random_bytes(8));
        $this->bandaA = 'phpunit-tenant-a-' . $suffix;
        $this->bandaB = 'phpunit-tenant-b-' . $suffix;
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$this->bandaA, 'Banda A', 'gratuito']);
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$this->bandaB, 'Banda B', 'gratuito']);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
    }

    public function testMusicaDaBandaAFicaInvisivelParaBandaB(): void
    {
        $repo = new MusicaRepository();
        $musicaId = $repo->save(['nome' => 'Música A', 'cifra' => '<b>C</b>'], $this->bandaA);

        self::assertNotNull($repo->findById($musicaId, $this->bandaA));
        self::assertNull($repo->findById($musicaId, $this->bandaB));
        self::assertSame(1, $repo->countByBanda($this->bandaA));
        self::assertSame(0, $repo->countByBanda($this->bandaB));
        self::assertCount(0, $repo->getAllByBanda($this->bandaB));
    }

    public function testMusicaDaBandaANaoPodeSerAtualizadaPelaBandaB(): void
    {
        $repo = new MusicaRepository();
        $musicaId = $repo->save(['nome' => 'Música A', 'cifra' => '<b>C</b>'], $this->bandaA);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Música não encontrada.');
        $repo->save(['id' => $musicaId, 'nome' => 'Sequestrada', 'cifra' => '<b>G</b>'], $this->bandaB);
    }

    public function testMusicaDaBandaANaoPodeSerExcluidaPelaBandaB(): void
    {
        $repo = new MusicaRepository();
        $musicaId = $repo->save(['nome' => 'Música A', 'cifra' => '<b>C</b>'], $this->bandaA);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Música não encontrada.');
        $repo->delete($musicaId, $this->bandaB);

        self::assertNotNull($repo->findById($musicaId, $this->bandaA));
    }

    public function testMusicaDaBandaANaoPodeSerCopiadaPelaBandaB(): void
    {
        $repo = new MusicaRepository();
        $musicaId = $repo->save(['nome' => 'Música A', 'cifra' => '<b>C</b>'], $this->bandaA);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Música não encontrada.');
        $repo->copy($musicaId, $this->bandaB);
    }

    public function testCategoriaDaBandaAFicaInvisivelParaBandaB(): void
    {
        $repo = new CategoriaRepository();
        $categoriaId = $repo->save(['nome' => 'Louvor'], $this->bandaA);

        self::assertTrue($repo->existsByName('Louvor', $this->bandaA));
        self::assertFalse($repo->existsByName('Louvor', $this->bandaB));
        self::assertCount(0, $repo->getAllByBanda($this->bandaB));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Categoria não encontrada.');
        $repo->save(['id' => $categoriaId, 'nome' => 'Sequestrada'], $this->bandaB);
    }

    public function testCategoriaDaBandaANaoPodeSerExcluidaPelaBandaB(): void
    {
        $repo = new CategoriaRepository();
        $categoriaId = $repo->save(['nome' => 'Louvor'], $this->bandaA);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Categoria não encontrada.');
        $repo->delete($categoriaId, $this->bandaB);
    }

    public function testPlaylistDaBandaAFicaInvisivelParaBandaBENaoEAfetadaPorSaveAll(): void
    {
        $repo = new PlaylistRepository();
        $repo->saveAll([['nome' => 'Repertório A', 'itens' => []]], $this->bandaA);
        $playlistA = $repo->getAllByBanda($this->bandaA)[0];

        self::assertNull($repo->findById((int)$playlistA['id'], $this->bandaB));

        // saveAll da banda B não pode apagar/alterar os repertórios da banda A.
        $repo->saveAll([['nome' => 'Repertório B', 'itens' => []]], $this->bandaB);
        self::assertCount(1, $repo->getAllByBanda($this->bandaA));
        self::assertSame('Repertório A', $repo->getAllByBanda($this->bandaA)[0]['nome']);
    }

    public function testRoteiroDaBandaAFicaInvisivelParaBandaBENaoEAfetadaPorSaveAll(): void
    {
        $repo = new RoteiroRepository();
        $repo->saveAll([['titulo' => 'Culto A', 'conteudo' => '<p>Entrada</p>']], $this->bandaA);
        $roteiroA = $repo->getAllByBanda($this->bandaA)[0];

        self::assertNull($repo->findById((int)$roteiroA['id'], $this->bandaB));

        $repo->saveAll([['titulo' => 'Culto B', 'conteudo' => '<p>Entrada</p>']], $this->bandaB);
        self::assertCount(1, $repo->getAllByBanda($this->bandaA));
        self::assertSame('Culto A', $repo->getAllByBanda($this->bandaA)[0]['titulo']);
    }

    public function testRoteiroDaBandaANaoPodeSerExcluidoPelaBandaB(): void
    {
        $repo = new RoteiroRepository();
        $repo->saveAll([['titulo' => 'Culto A', 'conteudo' => '<p>Entrada</p>']], $this->bandaA);
        $roteiroA = $repo->getAllByBanda($this->bandaA)[0];

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Roteiro não encontrado.');
        $repo->delete((int)$roteiroA['id'], $this->bandaB);
    }
}
