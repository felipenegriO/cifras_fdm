<?php

use PHPUnit\Framework\TestCase;

final class MigrationRunnerTest extends TestCase
{
    private string $directory;

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
}
