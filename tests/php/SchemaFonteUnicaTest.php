<?php

use PHPUnit\Framework\TestCase;

/**
 * O schema do Cifrô tem um lugar só.
 *
 * Estas travas existem por causa do incidente de 13/08: o schema era declarado
 * em create_tables.sql E em setup_db.php, os dois divergiram, e produção ficou
 * sem quatro coisas que o código já usava. A tabela auth_tokens repetiu o erro
 * na mesma semana.
 *
 * Não é teste de estilo. É a única barreira automática entre "declarei a tabela
 * no arquivo errado" e "descobri em produção seis meses depois".
 */
final class SchemaFonteUnicaTest extends TestCase
{
    private const RAIZ = __DIR__ . '/../..';

    /**
     * Onde declarar tabela é permitido.
     *
     * - create_tables.sql: o baseline, única declaração de tabelas;
     * - migrations/: alterações para bancos que já existem;
     * - MigrationRunner: declara a própria tabela de livro-razão, e ela não
     *   pode estar no baseline porque precisa existir antes dele rodar;
     * - tests/: tabelas de fixture, que morrem com o teste.
     */
    private const PERMITIDOS = [
        'create_tables.sql',
        'migrations/',
        'public/src/Services/MigrationRunner.php',
        'tests/',
    ];

    /** Caminhos relativos à raiz, com barra normal, ignorando dependências. */
    private function arquivosDoProjeto(): array
    {
        $raiz = realpath(self::RAIZ);
        $iterator = new RecursiveIteratorIterator(
            new RecursiveCallbackFilterIterator(
                new RecursiveDirectoryIterator($raiz, FilesystemIterator::SKIP_DOTS),
                static function (SplFileInfo $atual): bool {
                    $nome = $atual->getFilename();
                    if ($atual->isDir()) {
                        return !in_array($nome, ['vendor', 'node_modules', '.git', 'test-results', 'coverage'], true);
                    }
                    return in_array($atual->getExtension(), ['php', 'sql'], true);
                }
            )
        );

        $arquivos = [];
        foreach ($iterator as $arquivo) {
            $relativo = str_replace('\\', '/', substr($arquivo->getPathname(), strlen($raiz) + 1));
            $arquivos[] = $relativo;
        }
        sort($arquivos);
        return $arquivos;
    }

    private function conteudo(string $relativo): string
    {
        return (string) file_get_contents(self::RAIZ . '/' . $relativo);
    }

    private function ehPermitido(string $relativo): bool
    {
        foreach (self::PERMITIDOS as $permitido) {
            if (str_starts_with($relativo, $permitido)) {
                return true;
            }
        }
        return false;
    }

    public function testTabelaSoPodeSerDeclaradaNoBaselineOuNumaMigration(): void
    {
        $infratores = [];
        foreach ($this->arquivosDoProjeto() as $relativo) {
            if ($this->ehPermitido($relativo)) {
                continue;
            }
            if (preg_match('/\bCREATE\s+TABLE\b/i', $this->conteudo($relativo))) {
                $infratores[] = $relativo;
            }
        }

        self::assertSame(
            [],
            $infratores,
            "CREATE TABLE fora de create_tables.sql e migrations/:\n  "
                . implode("\n  ", $infratores)
        );
    }

    /**
     * O baseline declara estrutura e não encosta em dado.
     *
     * Havia um "UPDATE bandas SET plano='gratuito' WHERE plano='trial'" no fim
     * do arquivo. Rodar o baseline num banco povoado rebaixaria toda banda em
     * trial — perda de dado silenciosa, sem erro nenhum. Instrução de dado
     * pertence a migration, onde o livro-razão garante que roda uma vez só.
     */
    public function testBaselineNaoAlteraDados(): void
    {
        $sql = $this->conteudo('create_tables.sql');
        // Tira comentários de linha para não acusar um exemplo comentado.
        $sql = preg_replace('/^\s*--.*$/m', '', $sql);
        // Tira literais entre aspas simples: valores de ENUM como
        // "ENUM('upsert','delete','replace')" contêm a palavra "delete" sem
        // ser instrução nenhuma — é só o nome de uma opção.
        $sql = preg_replace("/'(?:\\\\.|[^'\\\\])*'/", "''", (string) $sql);
        // Tira "ON UPDATE CURRENT_TIMESTAMP" (cláusula de coluna) e
        // "ON DELETE CASCADE" / "ON DELETE SET NULL" etc. (cláusula de FK) —
        // nenhuma das duas é instrução de dados. Sem isto, a palavra UPDATE ou
        // DELETE dentro delas dispara falso positivo.
        $sql = preg_replace('/\bON\s+UPDATE\s+CURRENT_TIMESTAMP\b/i', '', (string) $sql);
        $sql = preg_replace('/\bON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION)\b/i', '', (string) $sql);

        $encontrados = [];
        foreach (['UPDATE', 'INSERT', 'DELETE', 'TRUNCATE'] as $comando) {
            if (preg_match('/\b' . $comando . '\b/i', (string) $sql)) {
                $encontrados[] = $comando;
            }
        }

        self::assertSame(
            [],
            $encontrados,
            'create_tables.sql contém instrução de dados (' . implode(', ', $encontrados)
                . '). Isso pertence a uma migration.'
        );
    }

    /**
     * Toda migration precisa ser idempotente.
     *
     * Motivo de desenho: um banco novo aplica create_tables.sql (que já traz o
     * schema atual completo) e SÓ DEPOIS aplica todas as migrations. Ou seja,
     * as migrations sempre rodam sobre um schema que já contém o que elas
     * fazem. Idempotência não é boa prática aqui, é requisito.
     *
     * O defeito que motivou: 20260816_musica_transposicao_instrumento.sql fazia
     * "ALTER TABLE musicas ADD COLUMN transposicao_instrumento ..." sem
     * "IF NOT EXISTS", e a coluna também está no baseline. Provisionar máquina
     * nova morria com "1060 Duplicate column name". Já corrigido; a trava é
     * para o próximo caso.
     *
     * Também vale para produção: migrate.php --allow-production aplica as
     * migrations desde o início contra um banco que já recebeu parte delas à
     * mão. Isso só é seguro porque todas são idempotentes — uma que não seja
     * quebra a atualização de produção no meio, sem registro no livro-razão.
     */
    public function testMigrationsSaoIdempotentes(): void
    {
        $diretorio = realpath(self::RAIZ . '/migrations');
        self::assertNotFalse($diretorio, 'Diretório migrations/ não encontrado.');

        $infratores = [];
        foreach (glob($diretorio . DIRECTORY_SEPARATOR . '*.sql') ?: [] as $arquivo) {
            $sql = (string) file_get_contents($arquivo);
            $nomeArquivo = basename($arquivo);

            foreach (MigrationRunner::splitStatements($sql) as $statement) {
                // CREATE TABLE precisa de IF NOT EXISTS.
                if (preg_match('/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\b)/i', $statement)) {
                    $infratores[] = "$nomeArquivo: CREATE TABLE sem IF NOT EXISTS -> $statement";
                    continue;
                }

                // CREATE INDEX precisa de IF NOT EXISTS.
                if (preg_match('/^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS\b)/i', $statement)) {
                    $infratores[] = "$nomeArquivo: CREATE INDEX sem IF NOT EXISTS -> $statement";
                    continue;
                }

                if (!preg_match('/^ALTER\s+TABLE\b/i', $statement)) {
                    continue;
                }

                // ADD COLUMN precisa de IF NOT EXISTS.
                if (preg_match('/\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)/i', $statement)) {
                    $infratores[] = "$nomeArquivo: ADD COLUMN sem IF NOT EXISTS -> $statement";
                    continue;
                }

                // ADD UNIQUE KEY / ADD INDEX / ADD KEY precisam de IF NOT EXISTS.
                if (preg_match('/\bADD\s+UNIQUE\s+KEY\s+(?!IF\s+NOT\s+EXISTS\b)/i', $statement)) {
                    $infratores[] = "$nomeArquivo: ADD UNIQUE KEY sem IF NOT EXISTS -> $statement";
                    continue;
                }
                if (preg_match('/\bADD\s+INDEX\s+(?!IF\s+NOT\s+EXISTS\b)/i', $statement)) {
                    $infratores[] = "$nomeArquivo: ADD INDEX sem IF NOT EXISTS -> $statement";
                    continue;
                }
                if (preg_match('/\bADD\s+KEY\s+(?!IF\s+NOT\s+EXISTS\b)/i', $statement)) {
                    $infratores[] = "$nomeArquivo: ADD KEY sem IF NOT EXISTS -> $statement";
                    continue;
                }

                // DROP TABLE / DROP COLUMN / DROP INDEX precisam de IF EXISTS.
                if (preg_match('/\bDROP\s+TABLE\s+(?!IF\s+EXISTS\b)/i', $statement)) {
                    $infratores[] = "$nomeArquivo: DROP TABLE sem IF EXISTS -> $statement";
                    continue;
                }
                if (preg_match('/\bDROP\s+COLUMN\s+(?!IF\s+EXISTS\b)/i', $statement)) {
                    $infratores[] = "$nomeArquivo: DROP COLUMN sem IF EXISTS -> $statement";
                    continue;
                }
                if (preg_match('/\bDROP\s+INDEX\s+(?!IF\s+EXISTS\b)/i', $statement)) {
                    $infratores[] = "$nomeArquivo: DROP INDEX sem IF EXISTS -> $statement";
                    continue;
                }

                // ADD CONSTRAINT (tipicamente FK) não aceita IF NOT EXISTS no
                // MariaDB 10.4. Só é idempotente pelo padrão guardado
                // SET @...:=(SELECT COUNT(*) FROM information_schema...) +
                // PREPARE/EXECUTE/DEALLOCATE — nesse padrão o texto
                // "ALTER TABLE ... ADD CONSTRAINT" vive dentro de uma string
                // atribuída por SET, nunca como statement próprio, então não
                // cai neste ramo (que só olha statements que começam com
                // ALTER TABLE). Um ADD CONSTRAINT solto, fora do padrão
                // guardado, aparece aqui como statement próprio e é acusado.
                if (preg_match('/\bADD\s+CONSTRAINT\b/i', $statement)) {
                    $infratores[] = "$nomeArquivo: ADD CONSTRAINT fora do padrão guardado (SET+PREPARE/EXECUTE) -> $statement";
                }
            }
        }

        self::assertSame(
            [],
            $infratores,
            "Migration não idempotente (roda sobre schema que já contém o que ela faz):\n  "
                . implode("\n  ", $infratores)
        );
    }
}
