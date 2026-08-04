<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/backend/bootstrap.php';
require_once __DIR__ . '/../../public/src/backend/backup_helpers.php';

final class LegacyControllerTest extends TestCase
{
    private string $dir;
    private array $session;
    private array $server;
    private array $post;
    private string $serviceWorker;
    private string $serviceWorkerContent;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cifro-controller-' . bin2hex(random_bytes(6));
        mkdir($this->dir, 0755, true);
        $this->session = $_SESSION;
        $this->server = $_SERVER;
        $this->post = $_POST;
        $_SESSION = [
            'autenticado' => true,
            'usuario' => ['id' => 'phpunit', 'perfil' => 'usuario'],
            'banda_atual' => ['id' => 'phpunit', 'perfil' => 'administrador', 'plano' => 'gratuito'],
        ];
        $_POST = [];
        $_SERVER['REQUEST_METHOD'] = 'GET';
        $this->serviceWorker = __DIR__ . '/../../public/service-worker.js';
        $this->serviceWorkerContent = file_get_contents($this->serviceWorker);
        http_response_code(200);
    }

    protected function tearDown(): void
    {
        file_put_contents($this->serviceWorker, $this->serviceWorkerContent);
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->dir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $item) {
            $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
        }
        rmdir($this->dir);
        $_SESSION = $this->session;
        $_SERVER = $this->server;
        $_POST = $this->post;
        http_response_code(200);
    }

    private function capture(callable $action): string
    {
        ob_start();
        $action();
        return (string)ob_get_clean();
    }

    public function testLivePlayerLeESalvaArquivoReal(): void
    {
        $file = $this->dir . DIRECTORY_SEPARATOR . 'live.txt';
        $controller = new LivePlayerController($file);
        self::assertSame('0', $this->capture(fn () => $controller->read()));

        file_put_contents($file, '12');
        self::assertSame('12', $this->capture(fn () => $controller->read()));

        self::assertSame('Método não permitido.', $this->capture(fn () => $controller->save()));
        self::assertSame(405, http_response_code());

        http_response_code(200);
        $_SERVER['REQUEST_METHOD'] = 'POST';
        self::assertSame('Número não enviado.', $this->capture(fn () => $controller->save()));
        self::assertSame(400, http_response_code());

        http_response_code(200);
        $_POST['numero'] = '27';
        self::assertSame('OK', $this->capture(fn () => $controller->save()));
        self::assertSame('27', file_get_contents($file));
    }

    public function testPlaylistControllerValidaEGravaDoisFormatos(): void
    {
        $file = $this->dir . DIRECTORY_SEPARATOR . 'playlists.js';
        $controller = new PlaylistController($file);

        $invalid = json_decode($this->capture(fn () => $controller->save('{')), true);
        self::assertFalse($invalid['sucesso']);
        self::assertSame(400, http_response_code());
        self::assertFalse(json_decode($this->capture(fn () => $controller->save()), true)['sucesso']);

        http_response_code(200);
        $invalidStructure = json_decode($this->capture(fn () => $controller->save('true')), true);
        self::assertSame('Estrutura inválida.', $invalidStructure['mensagem']);

        http_response_code(200);
        $saved = json_decode($this->capture(fn () => $controller->save(json_encode([
            'playlists' => [['nome' => 'Palco', 'itens' => [['id' => 1]]]],
        ]))), true);
        self::assertTrue($saved['sucesso']);
        self::assertStringContainsString('Palco', file_get_contents($file));

        $saved = json_decode($this->capture(fn () => $controller->save(json_encode([
            'Culto' => [['id' => 2]],
            'Ignorado' => 'texto',
        ]))), true);
        self::assertTrue($saved['sucesso']);
        self::assertStringContainsString('Culto', file_get_contents($file));
        self::assertStringNotContainsString('Ignorado', file_get_contents($file));

        $failure = json_decode($this->capture(fn () => (new PlaylistController($this->dir))->save('{"playlists":[]}')), true);
        self::assertFalse($failure['sucesso']);
        self::assertSame(500, http_response_code());
    }

    public function testSongControllerValidaCriaEAtualizaArquivoReal(): void
    {
        $file = $this->dir . DIRECTORY_SEPARATOR . 'songs.js';
        file_put_contents($file, "var songs = [{id: 1, nome: 'Antiga', cifra: '<b>C</b>', bit: '90', artista: 'A', classificacao: 'X'}];");
        $controller = new SongController($file);

        $invalid = json_decode($this->capture(fn () => $controller->save('{')), true);
        self::assertFalse($invalid['ok']);
        self::assertFalse(json_decode($this->capture(fn () => $controller->save()), true)['ok']);
        $incomplete = json_decode($this->capture(fn () => $controller->save('{}')), true);
        self::assertSame('Dados incompletos', $incomplete['error']);

        $badFile = $this->dir . DIRECTORY_SEPARATOR . 'invalid-songs.js';
        file_put_contents($badFile, 'var songs = inválido;');
        $badSource = json_decode($this->capture(fn () => (new SongController($badFile))->save(json_encode([
            'id' => 1, 'nome' => 'X', 'cifra' => '<b>C</b>', 'bit' => '', 'artista' => '', 'classificacao' => '',
        ]))), true);
        self::assertStringContainsString('conteúdo do arquivo', $badSource['error']);

        $updated = [
            'id' => 1,
            'nome' => 'Atualizada',
            'cifra' => '<b>C G Am F</b><b>letra comum</b><b>&nbsp;</b>',
            'bit' => '100',
            'artista' => "D'Ávila",
            'classificacao' => 'Entrada',
        ];
        self::assertTrue(json_decode($this->capture(fn () => $controller->save(json_encode($updated))), true)['ok']);
        self::assertStringContainsString('Atualizada', file_get_contents($file));
        self::assertStringContainsString('letra comum', file_get_contents($file));

        $created = $updated;
        $created['id'] = 999;
        $created['nome'] = 'Nova';
        file_put_contents($file, "var songs = [{id: 2, nome: 'Maior', cifra: '', bit: '', artista: '', classificacao: ''}, {id: 1, nome: 'Menor', cifra: '<b>C</b>', bit: '100', artista: 'A', classificacao: 'X'}, {id: 'texto', nome: 'Inválida', cifra: '', bit: '', artista: '', classificacao: ''}];");
        self::assertTrue(json_decode($this->capture(fn () => $controller->save(json_encode($created))), true)['ok']);
        self::assertStringContainsString("id: 3", file_get_contents($file));
        self::assertDirectoryExists($this->dir . DIRECTORY_SEPARATOR . 'backups');

        file_put_contents($file, 'var songs = [];');
        self::assertTrue(json_decode($this->capture(fn () => $controller->save(json_encode($created))), true)['ok']);
        self::assertStringContainsString("id: 1", file_get_contents($file));
    }

    public function testCategoriaControllerRenderizaTelaRealAutorizada(): void
    {
        self::assertStringContainsString('<html', strtolower($this->capture(fn () => (new CategoriaController())->show())));
    }

}
