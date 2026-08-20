<?php

final class MigrationRunner
{
    private PDO $pdo;
    private string $directory;

    public function __construct(PDO $pdo, string $directory)
    {
        $resolved = realpath($directory);
        if ($resolved === false || !is_dir($resolved)) {
            throw new InvalidArgumentException('Diretório de migrations inválido.');
        }

        $this->pdo = $pdo;
        $this->directory = $resolved;
    }

    public function status(): array
    {
        $this->ensureLedger();
        $applied = $this->appliedMigrations();
        $status = [];

        foreach (self::discover($this->directory) as $migration) {
            $recorded = $applied[$migration['id']] ?? null;
            if ($recorded !== null && !hash_equals($recorded, $migration['checksum'])) {
                throw new RuntimeException('Checksum divergente para migration já aplicada: ' . $migration['id']);
            }
            $status[] = $migration + ['applied' => $recorded !== null];
        }

        return $status;
    }

    public function applyAll(): array
    {
        $applied = [];
        foreach ($this->status() as $migration) {
            if ($migration['applied']) {
                continue;
            }
            $this->apply($migration);
            $applied[] = $migration['id'];
        }
        return $applied;
    }

    public static function discover(string $directory): array
    {
        $resolved = realpath($directory);
        if ($resolved === false || !is_dir($resolved)) {
            throw new InvalidArgumentException('Diretório de migrations inválido.');
        }

        $files = glob($resolved . DIRECTORY_SEPARATOR . '*.sql') ?: [];
        sort($files, SORT_STRING);
        $migrations = [];
        $ids = [];

        foreach ($files as $file) {
            $id = pathinfo($file, PATHINFO_FILENAME);
            if (!preg_match('/^\d{8}_[a-z0-9_]+$/', $id)) {
                throw new RuntimeException('Nome de migration inválido: ' . basename($file));
            }
            if (isset($ids[$id])) {
                throw new RuntimeException('Migration duplicada: ' . $id);
            }
            $content = file_get_contents($file);
            if ($content === false || trim($content) === '') {
                throw new RuntimeException('Migration vazia ou ilegível: ' . basename($file));
            }
            $ids[$id] = true;
            $migrations[] = [
                'id' => $id,
                'file' => $file,
                'checksum' => hash('sha256', $content),
            ];
        }

        return $migrations;
    }

    public static function splitStatements(string $sql): array
    {
        $statements = [];
        $buffer = '';
        $quote = null;
        $escaped = false;
        $length = strlen($sql);

        for ($index = 0; $index < $length; $index++) {
            $char = $sql[$index];
            if ($escaped) {
                $buffer .= $char;
                $escaped = false;
                continue;
            }
            if ($quote !== null && $char === '\\') {
                $buffer .= $char;
                $escaped = true;
                continue;
            }
            if ($quote === null && $char === '-' && ($sql[$index + 1] ?? '') === '-') {
                $next = $sql[$index + 2] ?? '';
                if ($next === '' || $next === ' ' || $next === "\t" || $next === "\n" || $next === "\r") {
                    // Comentário de linha "-- ...". O texto é descartado: ele nunca
                    // é SQL executável, e mantê-lo no buffer é justamente o defeito
                    // (um ";" dentro do comentário partia a instrução ao meio e o
                    // pedaço seguinte virava prosa tratada como comando). Um espaço
                    // substitui o comentário para não colar tokens vizinhos (ex.:
                    // "a-- x\nb" não pode virar "ab"); a quebra de linha em si não é
                    // consumida aqui, o laço principal a trata como espaço normal.
                    $buffer .= ' ';
                    $newline = strpos($sql, "\n", $index);
                    $index = ($newline === false) ? $length : $newline - 1;
                    continue;
                }
            }
            if ($quote === null && $char === '/' && ($sql[$index + 1] ?? '') === '*') {
                // Comentário de bloco "/* ... */", inclusive multilinha e com ";"
                // dentro. Mesmo raciocínio: descartado, mas substituído por um
                // espaço para não colar tokens vizinhos.
                $close = strpos($sql, '*/', $index + 2);
                if ($close === false) {
                    throw new RuntimeException('Migration contém comentário de bloco não finalizado.');
                }
                $buffer .= ' ';
                $index = $close + 1;
                continue;
            }
            if ($char === "'" || $char === '"' || $char === '`') {
                if ($quote === null) {
                    $quote = $char;
                } elseif ($quote === $char) {
                    $quote = null;
                }
                $buffer .= $char;
                continue;
            }
            if ($char === ';' && $quote === null) {
                if (trim($buffer) !== '') {
                    $statements[] = trim($buffer);
                }
                $buffer = '';
                continue;
            }
            $buffer .= $char;
        }

        if ($quote !== null) {
            throw new RuntimeException('Migration contém string não finalizada.');
        }
        if (trim($buffer) !== '') {
            $statements[] = trim($buffer);
        }

        return $statements;
    }

    private function apply(array $migration): void
    {
        $sql = file_get_contents($migration['file']);
        if ($sql === false) {
            throw new RuntimeException('Não foi possível ler migration: ' . $migration['id']);
        }

        foreach (self::splitStatements($sql) as $statement) {
            $this->pdo->exec($statement);
        }

        $statement = $this->pdo->prepare(
            'INSERT INTO schema_migrations (migration_id, checksum, applied_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        );
        $statement->execute([$migration['id'], $migration['checksum']]);
    }

    private function ensureLedger(): void
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS schema_migrations ('
            . 'migration_id VARCHAR(190) NOT NULL PRIMARY KEY,'
            . 'checksum CHAR(64) NOT NULL,'
            . 'applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
            . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
    }

    private function appliedMigrations(): array
    {
        $rows = $this->pdo->query('SELECT migration_id, checksum FROM schema_migrations')->fetchAll(PDO::FETCH_ASSOC);
        $applied = [];
        foreach ($rows as $row) {
            $applied[(string) $row['migration_id']] = (string) $row['checksum'];
        }
        return $applied;
    }
}
