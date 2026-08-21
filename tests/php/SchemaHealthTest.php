<?php

use PHPUnit\Framework\TestCase;

/**
 * O drift de schema que derrubou o sync em 20/08/2026 passou despercebido
 * porque health.php respondia 'ok' sem olhar para o banco. Estes testes fixam
 * o contrário: a saúde precisa saber a diferença entre "no ar" e "no ar com o
 * banco atrasado".
 */
final class SchemaHealthTest extends TestCase
{
    private string $directory;

    /** @var list<string> */
    private array $bancosDeRascunho = [];

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cifro-health-' . bin2hex(random_bytes(6));
        mkdir($this->directory, 0700, true);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory . DIRECTORY_SEPARATOR . '*') ?: [] as $file) {
            unlink($file);
        }
        rmdir($this->directory);
        foreach ($this->bancosDeRascunho as $nome) {
            $this->servidor()->exec("DROP DATABASE IF EXISTS `{$nome}`");
        }
        $this->bancosDeRascunho = [];
    }

    public function testBancoEmDiaRespondeOkCom200(): void
    {
        file_put_contents($this->directory . '/20260810_primeira.sql', 'SELECT 1;');
        $pdo = $this->bancoDeRascunho();
        $this->registrarLedger($pdo, ['20260810_primeira' => 'SELECT 1;']);

        $relatorio = SchemaHealth::report(new MigrationRunner($pdo, $this->directory));

        self::assertSame('ok', $relatorio['status']);
        self::assertSame(200, $relatorio['http_status']);
        self::assertSame([], $relatorio['pending_migrations']);
    }

    public function testBancoAtrasadoRespondeDegradedCom503ENomeiaAsPendentes(): void
    {
        file_put_contents($this->directory . '/20260810_primeira.sql', 'SELECT 1;');
        file_put_contents($this->directory . '/20260817_usuario_musica.sql', 'SELECT 2;');
        $pdo = $this->bancoDeRascunho();
        $this->registrarLedger($pdo, ['20260810_primeira' => 'SELECT 1;']);

        $relatorio = SchemaHealth::report(new MigrationRunner($pdo, $this->directory));

        self::assertSame('degraded', $relatorio['status']);
        self::assertSame(503, $relatorio['http_status']);
        self::assertSame(['20260817_usuario_musica'], $relatorio['pending_migrations']);
    }

    /**
     * Era o caso de produção antes do reparo: nenhuma migration jamais
     * aplicada, sem sequer a tabela de controle. Precisa acusar tudo, e sem
     * criar nada — health check que escreve no banco deixa de ser leitura.
     */
    public function testBancoQueNuncaMigrouAcusaTudoSemCriarTabela(): void
    {
        file_put_contents($this->directory . '/20260810_primeira.sql', 'SELECT 1;');
        file_put_contents($this->directory . '/20260817_usuario_musica.sql', 'SELECT 2;');
        $pdo = $this->bancoDeRascunho();

        $relatorio = SchemaHealth::report(new MigrationRunner($pdo, $this->directory));

        self::assertSame('degraded', $relatorio['status']);
        self::assertSame(['20260810_primeira', '20260817_usuario_musica'], $relatorio['pending_migrations']);
        self::assertSame(0, $pdo->query("SHOW TABLES LIKE 'schema_migrations'")->rowCount());
    }

    /**
     * Banco fora do ar não pode virar 500 com stack trace na cara de quem
     * monitora: é uma resposta de saúde legítima, e negativa.
     */
    public function testBancoInacessivelRespondeUnavailableSemVazarErro(): void
    {
        file_put_contents($this->directory . '/20260810_primeira.sql', 'SELECT 1;');
        $pdo = $this->bancoDeRascunho();
        $this->servidor()->exec("DROP DATABASE `{$this->bancosDeRascunho[0]}`");

        $relatorio = SchemaHealth::report(new MigrationRunner($pdo, $this->directory));

        self::assertSame('unavailable', $relatorio['status']);
        self::assertSame(503, $relatorio['http_status']);
        self::assertArrayNotHasKey('error', $relatorio);
    }

    private function registrarLedger(PDO $pdo, array $aplicadas): void
    {
        $pdo->exec('CREATE TABLE schema_migrations (migration_id VARCHAR(190) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        $stmt = $pdo->prepare('INSERT INTO schema_migrations (migration_id, checksum) VALUES (?, ?)');
        foreach ($aplicadas as $id => $conteudo) {
            $stmt->execute([$id, hash('sha256', $conteudo)]);
        }
    }

    private function servidor(): PDO
    {
        return new PDO(
            'mysql:host=' . env('DB_HOST') . ';charset=utf8mb4',
            (string) env('DB_USER'),
            (string) env('DB_PASS'),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
    }

    private function bancoDeRascunho(): PDO
    {
        $nome = 'cifro_health_' . bin2hex(random_bytes(6));
        $this->servidor()->exec("CREATE DATABASE `{$nome}` CHARACTER SET utf8mb4");
        $this->bancosDeRascunho[] = $nome;

        return new PDO(
            'mysql:host=' . env('DB_HOST') . ";dbname={$nome};charset=utf8mb4",
            (string) env('DB_USER'),
            (string) env('DB_PASS'),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
}
