<?php

use PHPUnit\Framework\TestCase;

final class MigrationRunnerTest extends TestCase
{
    private string $directory;

    /** @var list<string> bancos criados por bancoDeRascunho(), derrubados no tearDown. */
    private array $bancosDeRascunho = [];

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'cifro-migrations-' . bin2hex(random_bytes(6));
        mkdir($this->directory, 0700, true);
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory . DIRECTORY_SEPARATOR . '*') ?: [] as $file) {
            unlink($file);
        }
        rmdir($this->directory);

        foreach ($this->bancosDeRascunho as $nome) {
            (new PDO(
                'mysql:host=' . env('DB_HOST') . ';charset=utf8mb4',
                (string) env('DB_USER'),
                (string) env('DB_PASS'),
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            ))->exec("DROP DATABASE IF EXISTS `{$nome}`");
        }
        $this->bancosDeRascunho = [];
    }

    public function testDescobreMigrationsOrdenadasComChecksum(): void
    {
        file_put_contents($this->directory . '/20260811_segunda.sql', 'SELECT 2;');
        file_put_contents($this->directory . '/20260810_primeira.sql', 'SELECT 1;');

        $migrations = MigrationRunner::discover($this->directory);

        self::assertSame(['20260810_primeira', '20260811_segunda'], array_column($migrations, 'id'));
        self::assertSame(hash('sha256', 'SELECT 1;'), $migrations[0]['checksum']);
    }

    public function testRejeitaNomeInvalidoEVazio(): void
    {
        file_put_contents($this->directory . '/migration.sql', 'SELECT 1;');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Nome de migration inválido');
        MigrationRunner::discover($this->directory);
    }

    public function testSeparaStatementsSemQuebrarPontoEVirgulaEmString(): void
    {
        $statements = MigrationRunner::splitStatements("INSERT INTO teste VALUES ('a;b'); UPDATE teste SET nome=\"c;d\";");

        self::assertSame([
            "INSERT INTO teste VALUES ('a;b')",
            'UPDATE teste SET nome="c;d"',
        ], $statements);
    }

    public function testRejeitaStringNaoFinalizada(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('string não finalizada');
        MigrationRunner::splitStatements("SELECT 'inválida;");
    }

    public function testRejeitaComentarioDeBlocoNaoFinalizado(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('comentário de bloco não finalizado');
        MigrationRunner::splitStatements('SELECT 1; /* nunca fecha SELECT 2;');
    }

    public function testPontoEVirgulaDentroDeComentarioDeLinhaNaoDivideAInstrucao(): void
    {
        $sql = "CREATE TABLE teste (\n  id INT NOT NULL -- comentário com ; no meio\n) ENGINE=InnoDB;";

        $statements = MigrationRunner::splitStatements($sql);

        self::assertCount(1, $statements);
        self::assertStringStartsWith('CREATE TABLE teste', $statements[0]);
        self::assertStringNotContainsString('comentário com', $statements[0]);
    }

    public function testPontoEVirgulaDentroDeComentarioDeBlocoNaoDivideAInstrucao(): void
    {
        $sql = "CREATE TABLE teste (\n  id INT NOT NULL /* comentário de bloco; com ponto e vírgula */\n) ENGINE=InnoDB;";

        $statements = MigrationRunner::splitStatements($sql);

        self::assertCount(1, $statements);
        self::assertStringStartsWith('CREATE TABLE teste', $statements[0]);
        self::assertStringNotContainsString('comentário de bloco', $statements[0]);
    }

    public function testTracoTracoDentroDeStringContinuaSendoDadoENaoComentario(): void
    {
        $statements = MigrationRunner::splitStatements("INSERT INTO teste VALUES ('a--b'); SELECT 1;");

        self::assertSame([
            "INSERT INTO teste VALUES ('a--b')",
            'SELECT 1',
        ], $statements);
    }

    public function testMigrationsReaisDoProjetoGeramApenasInstrucoesSqlValidas(): void
    {
        $palavrasChaveSql = '/^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP|SELECT|SET|--|\/\*)/i';

        $arquivos = [
            dirname(__DIR__, 2) . '/migrations/20260811_auth_tokens.sql',
            dirname(__DIR__, 2) . '/migrations/20260813_alinhar_schema_producao.sql',
        ];

        foreach ($arquivos as $arquivo) {
            self::assertFileExists($arquivo);
            $conteudo = file_get_contents($arquivo);
            self::assertNotFalse($conteudo);

            $statements = MigrationRunner::splitStatements($conteudo);

            self::assertNotEmpty($statements, 'Migration não produziu nenhuma instrução: ' . $arquivo);
            foreach ($statements as $statement) {
                self::assertMatchesRegularExpression(
                    $palavrasChaveSql,
                    $statement,
                    'Instrução com prosa de comentário em vez de SQL em ' . $arquivo . ': ' . substr($statement, 0, 80)
                );
            }
        }
    }

    /**
     * Consultar o que falta aplicar precisa ser leitura pura. Um banco de
     * produção que nunca migrou não tem schema_migrations, e a checagem de
     * saúde não pode criá-la só para descobrir isso — health check que
     * escreve no banco deixa de ser health check.
     */
    public function testPendentesListaTudoQuandoBancoNuncaFoiMigrado(): void
    {
        file_put_contents($this->directory . '/20260810_primeira.sql', 'SELECT 1;');
        file_put_contents($this->directory . '/20260811_segunda.sql', 'SELECT 2;');
        $pdo = $this->bancoDeRascunho();

        $pendentes = (new MigrationRunner($pdo, $this->directory))->pendingIds();

        self::assertSame(['20260810_primeira', '20260811_segunda'], $pendentes);
        self::assertSame(
            0,
            $pdo->query("SHOW TABLES LIKE 'schema_migrations'")->rowCount(),
            'a consulta de pendências não pode criar a tabela de controle'
        );
    }

    public function testPendentesIgnoramAsJaRegistradas(): void
    {
        file_put_contents($this->directory . '/20260810_primeira.sql', 'SELECT 1;');
        file_put_contents($this->directory . '/20260811_segunda.sql', 'SELECT 2;');
        $pdo = $this->bancoDeRascunho();
        $pdo->exec('CREATE TABLE schema_migrations (migration_id VARCHAR(190) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        $pdo->prepare('INSERT INTO schema_migrations (migration_id, checksum) VALUES (?, ?)')
            ->execute(['20260810_primeira', hash('sha256', 'SELECT 1;')]);

        $pendentes = (new MigrationRunner($pdo, $this->directory))->pendingIds();

        self::assertSame(['20260811_segunda'], $pendentes);
    }

    public function testPendentesVazioQuandoTudoAplicado(): void
    {
        file_put_contents($this->directory . '/20260810_primeira.sql', 'SELECT 1;');
        $pdo = $this->bancoDeRascunho();
        $pdo->exec('CREATE TABLE schema_migrations (migration_id VARCHAR(190) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
        $pdo->prepare('INSERT INTO schema_migrations (migration_id, checksum) VALUES (?, ?)')
            ->execute(['20260810_primeira', hash('sha256', 'SELECT 1;')]);

        self::assertSame([], (new MigrationRunner($pdo, $this->directory))->pendingIds());
    }

    /**
     * Banco descartável e isolado: criar/derrubar schema_migrations é DDL, que
     * faz commit implícito no MySQL e escaparia de um rollback de transação.
     */
    private function bancoDeRascunho(): PDO
    {
        $nome = 'cifro_migguard_' . bin2hex(random_bytes(6));
        $servidor = new PDO(
            'mysql:host=' . env('DB_HOST') . ';charset=utf8mb4',
            (string) env('DB_USER'),
            (string) env('DB_PASS'),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $servidor->exec("CREATE DATABASE `{$nome}` CHARACTER SET utf8mb4");
        $this->bancosDeRascunho[] = $nome;

        return new PDO(
            'mysql:host=' . env('DB_HOST') . ";dbname={$nome};charset=utf8mb4",
            (string) env('DB_USER'),
            (string) env('DB_PASS'),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
}
