<?php

use PHPUnit\Framework\TestCase;

final class RepositoryIntegrationTest extends TestCase
{
    private PDO $pdo;
    private string $bandId;
    private string $userId;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();
        $suffix = bin2hex(random_bytes(8));
        $this->bandId = 'phpunit-band-' . $suffix;
        $this->userId = 'phpunit-user-' . $suffix;
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$this->bandId, 'Banda PHPUnit', 'gratuito']);
        $this->pdo->prepare('INSERT INTO usuarios (id, nome, email, perfil, ativo, plano) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$this->userId, 'Usuário PHPUnit', "$suffix@phpunit.local", 'usuario', 1, 'ativo']);
        $this->pdo->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, ?)')
            ->execute([$this->userId, $this->bandId, 'administrador']);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
    }

    public function testBandaRepositoryExecutaLeituraAtualizacaoPlanosEExclusao(): void
    {
        $repo = new BandaRepository();
        self::assertNotNull($repo->findById($this->bandId));
        self::assertNull($repo->findById('ausente'));
        self::assertSame(1, $repo->countByUsuario($this->userId));
        self::assertCount(1, $repo->getByUsuario($this->userId));
        self::assertNotEmpty($repo->getAll());

        $repo->save([
            'id' => $this->bandId,
            'nome' => 'Banda Atualizada',
            'logo' => 'logo.svg',
            'ativo' => 0,
            'plano' => 'mensal',
            'trial_expira_em' => '2030-01-01',
            'stripe_subscription_id' => 'sub_1',
        ]);
        self::assertSame('Banda Atualizada', $repo->findById($this->bandId)['nome']);

        $newId = 'phpunit-new-' . bin2hex(random_bytes(8));
        $repo->save(['id' => $newId, 'nome' => 'Nova']);
        self::assertSame('gratuito', $repo->findById($newId)['plano']);
        $repo->ativarPlano($newId, 'anual', 'sub_2');
        self::assertSame('sub_2', $repo->findById($newId)['stripe_subscription_id']);
        $repo->marcarBloqueada($newId);
        self::assertSame('bloqueado', $repo->findById($newId)['plano']);
        $repo->atualizarPlano($newId, 'gratuito');
        $repo->delete($newId);
        self::assertNull($repo->findById($newId));
    }

    public function testMusicasECategoriasMantemIsolamentoEReferencias(): void
    {
        $musicas = new MusicaRepository();
        $categorias = new CategoriaRepository();
        self::assertSame(0, $musicas->countByBanda($this->bandId));
        self::assertSame(0, $categorias->getVersion($this->bandId));

        $categoryId = $categorias->save(['nome' => 'Entrada'], $this->bandId);
        self::assertTrue($categorias->existsByName('Entrada', $this->bandId));
        self::assertFalse($categorias->existsByName('Entrada', 'outra-banda'));
        self::assertCount(1, $categorias->getAllByBanda($this->bandId));

        $musicId = $musicas->save([
            'nome' => 'Música Real',
            'artista' => 'PHPUnit',
            'classificacao' => 'Entrada',
            'cifra' => '<b>C</b>',
            'bit' => '120',
        ], $this->bandId);
        self::assertSame(1, $musicas->countByBanda($this->bandId));
        self::assertNull($musicas->findById($musicId, 'outra-banda'));
        self::assertCount(1, $musicas->getAllByBanda($this->bandId));

        $categorias->save(['id' => $categoryId, 'nome' => 'Louvor'], $this->bandId);
        self::assertSame('Louvor', $musicas->findById($musicId, $this->bandId)['classificacao']);

        try {
            $categorias->delete($categoryId, $this->bandId);
            self::fail('Categoria em uso deveria ser preservada.');
        } catch (RuntimeException $error) {
            self::assertSame('A categoria está sendo usada por músicas e não pode ser excluída.', $error->getMessage());
        }

        $musicas->save(['id' => $musicId, 'nome' => 'Atualizada'], $this->bandId);
        self::assertSame('Atualizada', $musicas->findById($musicId, $this->bandId)['nome']);
        $copyId = $musicas->copy($musicId, $this->bandId);
        self::assertStringStartsWith('Cópia de ', $musicas->findById($copyId, $this->bandId)['nome']);
        self::assertGreaterThan(0, $musicas->getVersion($this->bandId));

        $this->expectException(RuntimeException::class);
        $musicas->copy(99999999, $this->bandId);
    }

    public function testCategoriaInexistenteERemocaoSemUso(): void
    {
        $repo = new CategoriaRepository();
        $id = $repo->save(['nome' => 'Temporária'], $this->bandId);
        $repo->delete($id, $this->bandId);
        self::assertFalse($repo->existsByName('Temporária', $this->bandId));

        $this->expectException(RuntimeException::class);
        $repo->save(['id' => 99999999, 'nome' => 'Ausente'], $this->bandId);
    }

    public function testRepositoriesRejeitamAtualizacaoEExclusoesInexistentes(): void
    {
        $musicas = new MusicaRepository();
        try {
            $musicas->save(['id' => 99999999, 'nome' => 'Ausente'], $this->bandId);
            self::fail('Música inexistente deveria ser rejeitada.');
        } catch (RuntimeException $error) {
            self::assertSame('Música não encontrada.', $error->getMessage());
        }

        $categorias = new CategoriaRepository();
        try {
            $categorias->delete(99999999, $this->bandId);
            self::fail('Categoria inexistente deveria ser rejeitada.');
        } catch (RuntimeException $error) {
            self::assertSame('Categoria não encontrada.', $error->getMessage());
        }

        $roteiros = new RoteiroRepository();
        try {
            $roteiros->delete(99999999, $this->bandId);
            self::fail('Roteiro inexistente deveria ser rejeitado.');
        } catch (RuntimeException $error) {
            self::assertSame('Roteiro não encontrado.', $error->getMessage());
        }
    }

    public function testPlaylistsERoteirosPersistemColecoesVaziasEComConteudo(): void
    {
        $playlists = new PlaylistRepository();
        $roteiros = new RoteiroRepository();
        self::assertSame(0, $playlists->countByBanda($this->bandId));
        self::assertNull($playlists->findById(99999999, $this->bandId));
        self::assertNull($roteiros->findById(99999999, $this->bandId));

        $playlists->saveAll([
            ['nome' => 'Vazia'],
            ['nome' => 'Palco', 'visivel_ate' => '2030-01-01', 'itens' => [['id' => 1, 'tom' => 'D']]],
        ], $this->bandId);
        $savedPlaylists = $playlists->getAllByBanda($this->bandId);
        self::assertCount(2, $savedPlaylists);
        self::assertSame([], $savedPlaylists[0]['itens']);
        self::assertSame('D', $playlists->findById((int)$savedPlaylists[1]['id'], $this->bandId)['itens'][0]['tom']);
        $playlists->saveAll([], $this->bandId);
        self::assertSame(0, $playlists->countByBanda($this->bandId));

        $roteiros->saveAll([
            ['titulo' => 'Vazio'],
            ['titulo' => 'Culto', 'conteudo' => '<p>Entrada</p>', 'visivel_ate' => '2030-01-01'],
        ], $this->bandId);
        $savedRoteiros = $roteiros->getAllByBanda($this->bandId);
        self::assertCount(2, $savedRoteiros);
        self::assertSame('<p>Entrada</p>', $roteiros->findById((int)$savedRoteiros[1]['id'], $this->bandId)['conteudo']);
        $roteiros->delete((int)$savedRoteiros[0]['id'], $this->bandId);
        self::assertCount(1, $roteiros->getAllByBanda($this->bandId));
        $roteiros->saveAll([], $this->bandId);
        self::assertSame([], $roteiros->getAllByBanda($this->bandId));
    }
}
