<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/backend/bootstrap.php';

/**
 * Personalização de capotraste por músico. O que importa aqui é isolamento:
 * a linha é privada, e nem outro integrante nem outra banda podem alcançá-la.
 */
final class UsuarioMusicaRepositoryTest extends TestCase
{
    private PDO $pdo;
    private UsuarioMusicaRepository $repo;
    private string $bandaId;
    private string $outraBandaId;
    private string $userId;
    private string $outroUserId;
    private int $musicaId;
    private int $outraMusicaId;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();
        $sufixo = bin2hex(random_bytes(8));

        $this->bandaId = 'phpunit-um-banda-' . $sufixo;
        $this->outraBandaId = 'phpunit-um-outra-' . $sufixo;
        $this->userId = 'phpunit-um-user-' . $sufixo;
        $this->outroUserId = 'phpunit-um-outro-' . $sufixo;

        $banda = $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)');
        $banda->execute([$this->bandaId, 'Banda Capotraste', 'gratuito']);
        $banda->execute([$this->outraBandaId, 'Outra Banda', 'gratuito']);

        $usuario = $this->pdo->prepare('INSERT INTO usuarios (id, nome, email, perfil, ativo, plano) VALUES (?, ?, ?, ?, ?, ?)');
        $usuario->execute([$this->userId, 'Músico Um', "um-$sufixo@phpunit.local", 'usuario', 1, 'ativo']);
        $usuario->execute([$this->outroUserId, 'Músico Dois', "dois-$sufixo@phpunit.local", 'usuario', 1, 'ativo']);

        $musica = $this->pdo->prepare('INSERT INTO musicas (banda_id, nome, cifra, transposicao_instrumento) VALUES (?, ?, ?, ?)');
        $musica->execute([$this->bandaId, 'Música da Banda', '<b>D A Bm G</b>', 0]);
        $this->musicaId = (int) $this->pdo->lastInsertId();
        $musica->execute([$this->outraBandaId, 'Música de Outra Banda', '<b>C G Am F</b>', 0]);
        $this->outraMusicaId = (int) $this->pdo->lastInsertId();

        $this->repo = new UsuarioMusicaRepository($this->pdo);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
    }

    public function testGuardaEDevolveOCapotrasteDoMusico(): void
    {
        $this->repo->salvar($this->userId, $this->bandaId, $this->musicaId, 3, 0, 'D');

        $linhas = $this->repo->listarPorUsuario($this->userId, $this->bandaId);

        $this->assertCount(1, $linhas);
        $this->assertSame($this->musicaId, $linhas[0]['musica_id']);
        $this->assertSame(3, $linhas[0]['transposicao_instrumento']);
        $this->assertSame(0, $linhas[0]['base_transposicao']);
        $this->assertSame('D', $linhas[0]['base_tom']);
    }

    public function testUmMusicoNaoEnxergaAEscolhaDeOutro(): void
    {
        $this->repo->salvar($this->userId, $this->bandaId, $this->musicaId, 3, 0, 'D');

        $this->assertSame([], $this->repo->listarPorUsuario($this->outroUserId, $this->bandaId));
    }

    public function testNaoDevolveEscolhaDeOutraBanda(): void
    {
        $this->repo->salvar($this->userId, $this->outraBandaId, $this->outraMusicaId, 5, 0, 'C');

        $this->assertSame([], $this->repo->listarPorUsuario($this->userId, $this->bandaId));
        $this->assertCount(1, $this->repo->listarPorUsuario($this->userId, $this->outraBandaId));
    }

    public function testSalvarDuasVezesAtualizaEmVezDeDuplicar(): void
    {
        $this->repo->salvar($this->userId, $this->bandaId, $this->musicaId, 3, 0, 'D');
        $this->repo->salvar($this->userId, $this->bandaId, $this->musicaId, 5, 2, 'E');

        $linhas = $this->repo->listarPorUsuario($this->userId, $this->bandaId);

        $this->assertCount(1, $linhas);
        $this->assertSame(5, $linhas[0]['transposicao_instrumento']);
        $this->assertSame(2, $linhas[0]['base_transposicao']);
        $this->assertSame('E', $linhas[0]['base_tom']);
    }

    public function testRemoverApagaSomenteALinhaDaquelaMusica(): void
    {
        $outra = $this->pdo->prepare('INSERT INTO musicas (banda_id, nome, cifra) VALUES (?, ?, ?)');
        $outra->execute([$this->bandaId, 'Segunda Música', '<b>G C D</b>']);
        $segundaId = (int) $this->pdo->lastInsertId();

        $this->repo->salvar($this->userId, $this->bandaId, $this->musicaId, 3, 0, 'D');
        $this->repo->salvar($this->userId, $this->bandaId, $segundaId, 2, 0, 'G');

        $this->repo->remover($this->userId, $this->bandaId, $this->musicaId);

        $linhas = $this->repo->listarPorUsuario($this->userId, $this->bandaId);
        $this->assertCount(1, $linhas);
        $this->assertSame($segundaId, $linhas[0]['musica_id']);
    }

    public function testAtualizarBaseMantemOValorEscolhido(): void
    {
        $this->repo->salvar($this->userId, $this->bandaId, $this->musicaId, 3, 0, 'D');

        // É o que acontece quando o músico resolve o conflito por "manter o meu".
        $this->repo->atualizarBase($this->userId, $this->bandaId, $this->musicaId, 4, 'E');

        $linhas = $this->repo->listarPorUsuario($this->userId, $this->bandaId);
        $this->assertSame(3, $linhas[0]['transposicao_instrumento']);
        $this->assertSame(4, $linhas[0]['base_transposicao']);
        $this->assertSame('E', $linhas[0]['base_tom']);
    }

    public function testExcluirAMusicaLevaAPersonalizacaoJunto(): void
    {
        $this->repo->salvar($this->userId, $this->bandaId, $this->musicaId, 3, 0, 'D');

        $this->pdo->prepare('DELETE FROM musicas WHERE id=?')->execute([$this->musicaId]);

        $this->assertSame([], $this->repo->listarPorUsuario($this->userId, $this->bandaId));
    }
}
