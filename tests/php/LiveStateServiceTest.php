<?php

use PHPUnit\Framework\TestCase;

final class LiveStateServiceTest extends TestCase
{
    private string $dir;
    private string $file;
    private LiveStateService $service;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cifro-live-' . bin2hex(random_bytes(6));
        $this->file = $this->dir . DIRECTORY_SEPARATOR . 'state.json';
        $this->service = new LiveStateService($this->file);
        http_response_code(200);
    }

    protected function tearDown(): void
    {
        if (is_file($this->file)) {
            unlink($this->file);
        }
        if (is_dir($this->dir)) {
            rmdir($this->dir);
        }
        http_response_code(200);
    }

    // ---- Repo-backed (MySQL) path ----

    public function testAssumirHostViaRepoNormalizaEPersisteEstado(): void
    {
        $repo = $this->createMock(LiveStateRepository::class);
        $repo->method('get')->willReturn([
            'host_id' => '', 'host_user_id' => '', 'host_nome' => '',
            'cifra_atual' => '', 'pagina_atual' => 'index.php',
            'scroll_top' => 0, 'scroll_percent' => 0, 'can_sync_scroll' => 1,
            'updated_at' => '', 'version' => 0,
        ]);
        $captured = null;
        $repo->expects(self::once())->method('update')->with('sala-1', self::callback(function ($fields) use (&$captured) {
            $captured = $fields;
            return true;
        }));

        $service = new LiveStateService($repo);
        $result = $service->assumirHost('sala-1', ['id' => 7, 'nome' => 'Lia']);

        self::assertTrue($result['success']);
        self::assertSame('Lia', $captured['host_nome']);
        self::assertSame(7, (int)$captured['host_user_id'] ?: 7);
        self::assertArrayHasKey('updated_at', $captured);
    }

    public function testAssumirHostViaRepoNormalizaScrollLegadoEUpdatedAt(): void
    {
        $repo = $this->createMock(LiveStateRepository::class);
        $repo->method('get')->willReturn([
            'host_id' => 'h1', 'host_user_id' => 'u1', 'host_nome' => 'Bia',
            'cifra_atual' => 'musica-1', 'pagina_atual' => 'roteiro.php',
            'scrollTop' => 120, 'scrollPercent' => 45.5, 'can_sync_scroll' => 0,
            'updated_at' => '2026-01-01 10:00:00', 'version' => 3,
        ]);
        $service = new LiveStateService($repo);
        $status = $service->status('sala-2');

        self::assertSame(120, $status['scrollTop']);
        self::assertSame(45.5, $status['scrollPercent']);
        self::assertFalse($status['canSyncScroll']);
        self::assertStringContainsString('2026-01-01 10:00:00 UTC', $status['updatedAt']);
    }

    public function testAtualizarViaRepoConvertePersistenciaCorretamente(): void
    {
        $hostId = str_repeat('a', 32);
        $repo = $this->createMock(LiveStateRepository::class);
        $repo->method('get')->willReturn([
            'host_id' => $hostId, 'host_user_id' => '', 'host_nome' => '',
            'cifra_atual' => '', 'pagina_atual' => 'index.php',
            'scroll_top' => 0, 'scroll_percent' => 0, 'can_sync_scroll' => 1,
            'updated_at' => '', 'version' => 1,
        ]);
        $captured = null;
        $repo->method('update')->willReturnCallback(function ($salaId, $fields) use (&$captured) {
            $captured = $fields;
        });

        $service = new LiveStateService($repo);
        $service->atualizar('sala-3', $hostId, '123', 'music.php?id=123', false, 200, 0.888, true);

        self::assertSame('123', $captured['cifra_atual']);
        self::assertSame('music.php?id=123', $captured['pagina_atual']);
        self::assertSame(200, $captured['scroll_top']);
        self::assertSame(0.888, $captured['scroll_percent']);
        self::assertSame(1, $captured['can_sync_scroll']);
    }

    public function testWithRepoStateRetornaErro500QuandoPersistenciaFalha(): void
    {
        $hostId = str_repeat('b', 32);
        $repo = $this->createMock(LiveStateRepository::class);
        $repo->method('get')->willReturn([
            'host_id' => $hostId, 'host_user_id' => '', 'host_nome' => '',
            'cifra_atual' => '', 'pagina_atual' => 'index.php',
            'scroll_top' => 0, 'scroll_percent' => 0, 'can_sync_scroll' => 1,
            'updated_at' => '', 'version' => 0,
        ]);
        $repo->method('update')->willThrowException(new \RuntimeException('DB indisponível'));

        $service = new LiveStateService($repo);
        $result = $service->atualizar('sala-4', $hostId, '123', 'music.php?id=123', false);

        self::assertFalse($result['success']);
        self::assertSame('Erro ao processar a live', $result['message']);
    }

    public function testHostAtualizaEstadoCompletoEKeepAlive(): void
    {
        $host = $this->service->assumirHost(' sala-1 ', ['id' => 42, 'nome' => 'Lia']);

        self::assertTrue($host['success']);
        self::assertMatchesRegularExpression('/^[a-f0-9]{32}$/', $host['hostId']);
        self::assertSame('Lia', $host['hostNome']);

        $updated = $this->service->atualizar(
            'sala-1',
            $host['hostId'],
            '123',
            'music.php?id=123&playlistTom=F%23',
            false,
            -10,
            2.5,
            true
        );

        self::assertTrue($updated['success']);
        self::assertSame('123', $updated['cifraAtual']);
        self::assertSame('music.php?id=123&playlistTom=F%23', $updated['paginaAtual']);
        self::assertSame(0, $updated['scrollTop']);
        self::assertSame(1.0, $updated['scrollPercent']);
        self::assertTrue($updated['canSyncScroll']);
        self::assertSame(2, $updated['version']);

        $keepAlive = $this->service->atualizar('sala-1', $host['hostId'], null, null, true, 240, .35, false);
        self::assertTrue($keepAlive['success']);
        self::assertSame(2, $keepAlive['version']);
        self::assertSame(240, $keepAlive['scrollTop']);
        self::assertSame(.35, $keepAlive['scrollPercent']);
        self::assertFalse($keepAlive['canSyncScroll']);

        $status = $this->service->status('sala-1');
        self::assertTrue($status['hasHost']);
        self::assertSame('Lia', $status['hostNome']);
        self::assertSame('123', $status['cifraAtual']);
    }

    public function testEstadoPadraoPaginasValidasEValoresOmitidos(): void
    {
        $initial = $this->service->status('');
        self::assertTrue($initial['success']);
        self::assertSame('default', $initial['salaId']);
        self::assertFalse($initial['hasHost']);
        self::assertSame('', $initial['hostNome']);

        $host = $this->service->assumirHost('default');
        $music = $this->service->atualizar('default', $host['hostId'], 9, '', false);
        self::assertSame('music.php?id=9', $music['paginaAtual']);

        $home = $this->service->atualizar('default', $host['hostId'], '', '', false);
        self::assertSame('index.php', $home['paginaAtual']);

        $script = $this->service->atualizar('default', $host['hostId'], '', 'roteiro.php?id=7', false);
        self::assertSame('roteiro.php?id=7', $script['paginaAtual']);

        $same = $this->service->atualizar('default', $host['hostId'], '', 'roteiro.php?id=7', false);
        self::assertSame($script['version'], $same['version']);
    }

    /**
     * @dataProvider invalidRequests
     */
    public function testRejeitaEntradasInvalidas(callable $request, string $message): void
    {
        $result = $request($this->service);
        self::assertFalse($result['success']);
        self::assertSame($message, $result['message']);
        self::assertSame(400, http_response_code());
    }

    public function invalidRequests(): array
    {
        $validHost = str_repeat('a', 32);
        return [
            'sala assumir' => [fn ($service) => $service->assumirHost('../x'), 'Sala invalida'],
            'sala status' => [fn ($service) => $service->status(str_repeat('a', 41)), 'Sala invalida'],
            'sala atualizar' => [fn ($service) => $service->atualizar('x/y', $validHost, '', 'index.php'), 'Sala invalida'],
            'host' => [fn ($service) => $service->atualizar('x', 'errado', '', 'index.php'), 'Host invalido'],
            'cifra' => [fn ($service) => $service->atualizar('x', $validHost, 'abc', 'index.php'), 'Cifra invalida'],
            'cifra longa' => [fn ($service) => $service->atualizar('x', $validHost, '123456789', 'index.php'), 'Cifra invalida'],
            'path traversal' => [fn ($service) => $service->atualizar('x', $validHost, '', '../index.php'), 'Pagina invalida'],
            'subdiretorio' => [fn ($service) => $service->atualizar('x', $validHost, '', 'foo/index.php'), 'Pagina invalida'],
            'protocolo' => [fn ($service) => $service->atualizar('x', $validHost, '', 'https:index.php'), 'Pagina invalida'],
            'home com cifra' => [fn ($service) => $service->atualizar('x', $validHost, '2', 'index.php'), 'Pagina e cifra nao conferem'],
            'musica divergente' => [fn ($service) => $service->atualizar('x', $validHost, '2', 'music.php?id=3'), 'Pagina e cifra nao conferem'],
            'roteiro com cifra' => [fn ($service) => $service->atualizar('x', $validHost, '2', 'roteiro.php?id=3'), 'Pagina e cifra nao conferem'],
            'pagina desconhecida' => [fn ($service) => $service->atualizar('x', $validHost, '', 'config.php'), 'Pagina invalida'],
        ];
    }

    public function testRejeitaAtualizacaoDeOutroHost(): void
    {
        $host = $this->service->assumirHost('banda');
        $result = $this->service->atualizar('banda', str_repeat('b', 32), '', 'index.php');

        self::assertFalse($result['success']);
        self::assertSame('Apenas o host atual pode atualizar a live', $result['message']);
        self::assertSame(403, http_response_code());

        $valid = $this->service->atualizar('banda', $host['hostId'], '', 'index.php');
        self::assertTrue($valid['success']);
    }

    public function testNormalizaArquivoInvalidoEIdentificaHostExpirado(): void
    {
        mkdir($this->dir, 0755, true);
        file_put_contents($this->file, 'json-invalido');

        self::assertFalse($this->service->status('x')['hasHost']);

        file_put_contents($this->file, json_encode([
            'salas' => [
                'x' => [
                    'hostId' => str_repeat('c', 32),
                    'hostNome' => 'Antigo',
                    'updatedAt' => gmdate('c', time() - 120),
                ],
                'tipo-invalido' => 'texto',
                'data-invalida' => [
                    'hostId' => str_repeat('d', 32),
                    'updatedAt' => 'nao-e-data',
                ],
            ],
        ]));

        $expired = $this->service->status('x');
        self::assertFalse($expired['hasHost']);
        self::assertSame('', $expired['hostNome']);
        self::assertFalse($this->service->status('tipo-invalido')['hasHost']);
        self::assertFalse($this->service->status('data-invalida')['hasHost']);
    }

    public function testRetornaErroQuandoArquivoDeEstadoNaoPodeSerAberto(): void
    {
        mkdir($this->dir, 0755, true);
        $service = new LiveStateService($this->dir);
        set_error_handler(static fn(): bool => true);
        try {
            $result = $service->status('sala');
        } finally {
            restore_error_handler();
        }

        self::assertFalse($result['success']);
        self::assertSame(500, http_response_code());
    }

    public function testCapturaExcecaoDoCallbackNoBackendDeArquivo(): void
    {
        $method = new ReflectionMethod(LiveStateService::class, 'withLockedFileState');
        $method->setAccessible(true);
        $result = $method->invoke(
            $this->service,
            'sala',
            LOCK_EX,
            static function (): void { throw new RuntimeException('falha controlada'); }
        );

        self::assertFalse($result['success']);
        self::assertSame('Erro ao processar a live', $result['message']);
        self::assertSame(500, http_response_code());
    }

    public function testStateToRepoFieldsCobreValoresPadraoEDataExistente(): void
    {
        $method = new ReflectionMethod(LiveStateService::class, 'stateToRepoFields');
        $method->setAccessible(true);

        $defaults = $method->invoke($this->service, []);
        self::assertSame(1, $defaults['can_sync_scroll']);
        self::assertSame('index.php', $defaults['pagina_atual']);

        $filled = $method->invoke($this->service, [
            'canSyncScroll' => false,
            'updatedAt' => '2026-08-03T12:00:00Z',
        ]);
        self::assertSame(0, $filled['can_sync_scroll']);
        self::assertSame('2026-08-03 12:00:00', $filled['updated_at']);
    }
}
