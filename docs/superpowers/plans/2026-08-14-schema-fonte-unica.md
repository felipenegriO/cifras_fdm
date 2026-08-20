# Schema em fonte única (DEBT-001) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer de `create_tables.sql` a única declaração de tabelas do projeto, com toda alteração de banco existente vivendo em `migrations/`, e travar automaticamente a reincidência.

**Architecture:** Dois artefatos com papéis separados — `create_tables.sql` é o retrato do banco zerado e só roda contra banco vazio; `migrations/*.sql` é o histórico de alterações, com livro-razão e checksum. Os dois provisionadores (`setup_db.php` e `setup_e2e_db.php`) passam a ler o mesmo baseline e depois aplicar as migrations pendentes. Produção continua sendo atendida só por `migrate.php --allow-production`, que aplica migrations e nunca o baseline.

**Tech Stack:** PHP 8.0 (CLI), MariaDB 10.4 local / 11.8 produção, PHPUnit 9.6, `MigrationRunner` já existente em `public/src/Services/MigrationRunner.php`.

**Spec:** `docs/superpowers/specs/2026-08-14-schema-fonte-unica-design.md`

## Global Constraints

- **Nada pode se perder.** Nenhum script é apagado antes de o conteúdo dele estar representado no baseline **e** numa migration idempotente. Baseline cobre banco novo; migration cobre banco existente.
- **MariaDB, não MySQL.** `ADD COLUMN IF NOT EXISTS`, `ADD UNIQUE KEY IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS` são extensões do MariaDB. Verificado no 10.4 local.
- **Migrations são idempotentes por requisito de desenho**, não por boa prática: num banco novo elas rodam sobre um baseline que já contém o que elas fazem.
- **Nome de migration:** `^\d{8}_[a-z0-9_]+$`, senão o `MigrationRunner::discover()` lança exceção.
- **Migration já aplicada não pode ter o conteúdo alterado** — o checksum no livro-razão rejeita.
- **Não commitar em nome do usuário.** Os passos de commit deste plano ficam a cargo dele; o executor para e avisa.
- **Testes em português de negócio**, seguindo o padrão de `tests/php/BandaAdminTabsTest.php`.
- **PHP binário:** `C:/xampp/php/php.exe`. PHPUnit: `npm run test:unit:php`.

## Estrutura de arquivos

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `create_tables.sql` | única declaração de tabelas; retrato do banco zerado | modificar |
| `migrations/20260814_alinhar_alteracoes_pendentes.sql` | leva a bancos existentes tudo que hoje só existe no baseline | criar |
| `scripts/setup/setup_db.php` | provisiona banco vazio: baseline + migrations | modificar |
| `scripts/setup/setup_e2e_db.php` | provisiona base de teste: baseline + migrations | modificar |
| `tests/php/SchemaFonteUnicaTest.php` | as duas travas | criar |
| 8 scripts em `scripts/setup/` | conteúdo absorvido | apagar |

---

### Task 1: A trava contra `CREATE TABLE` fora do lugar

Vem primeiro de propósito: escrita antes das mudanças, ela mede o estado atual e mostra exatamente quais arquivos violam a regra. Vira o roteiro das tarefas seguintes.

**Files:**
- Create: `tests/php/SchemaFonteUnicaTest.php`

**Interfaces:**
- Consumes: nada.
- Produces: `SchemaFonteUnicaTest`, com os helpers privados `arquivosDoProjeto(): array` (caminhos relativos, com `/` como separador) e `conteudo(string $relativo): string`. As tarefas seguintes não dependem deles; só a Task 6 acrescenta métodos a esta classe.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/php/SchemaFonteUnicaTest.php`:

```php
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

    /**
     * Dívida conhecida no momento em que esta trava foi escrita.
     *
     * A trava nasce antes da limpeza, para medir o estado real. Enquanto estes
     * quatro existirem ela se abstém — mas SÓ para eles: infrator novo derruba
     * o teste na hora. Sem isso o teste ficaria inerte por quatro tarefas, que
     * é como uma trava desligada é esquecida ligada.
     *
     * A Task 5 esvazia esta lista. Se você está lendo isto e a lista tem
     * itens, a Task 5 não terminou.
     */
    private const DIVIDA_CONHECIDA = [
        'scripts/setup/migrate_categorias.php',
        'scripts/setup/migrate_privacy.php',
        'scripts/setup/migrate_stripe_events.php',
        'scripts/setup/setup_db.php',
    ];

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

        $novos = array_values(array_diff($infratores, self::DIVIDA_CONHECIDA));
        self::assertSame(
            [],
            $novos,
            "CREATE TABLE em lugar novo, fora de create_tables.sql e migrations/:\n  "
                . implode("\n  ", $novos)
        );

        $restantes = array_values(array_intersect($infratores, self::DIVIDA_CONHECIDA));
        if ($restantes !== []) {
            self::markTestIncomplete(
                "Dívida conhecida ainda no lugar (a Task 5 do plano remove):\n  "
                    . implode("\n  ", $restantes)
                    . "\nQuando esvaziar, apague a constante DIVIDA_CONHECIDA e este bloco."
            );
        }
    }
}
```

- [ ] **Step 2: Rodar e confirmar que ele acusa exatamente a dívida conhecida**

Run: `npm run test:unit:php -- --filter testTabelaSoPodeSerDeclaradaNoBaselineOuNumaMigration`

Expected: `I` (incomplete), com a mensagem listando os quatro arquivos da `DIVIDA_CONHECIDA` e nenhum outro. A suíte não fica vermelha.

Se der **FAIL** em vez de incompleto, apareceu um infrator que a spec não mapeou: **pare** e escale — o plano precisa ser revisto antes de seguir.

Se der **PASS** limpo, o varredor não está achando os arquivos: confira o filtro de diretórios de `arquivosDoProjeto()`.

- [ ] **Step 3: Provar que a trava morde contra infrator novo**

O `markTestIncomplete` protege a dívida conhecida; ele não pode estar protegendo tudo. Crie um arquivo temporário:

```bash
printf '<?php\n// CREATE TABLE teste_da_trava (id INT);\n$sql = "CREATE TABLE teste_da_trava (id INT)";\n' > public/src/Services/TravaTemp.php
npm run test:unit:php -- --filter testTabelaSoPodeSerDeclaradaNoBaselineOuNumaMigration
```

Expected: **FAIL**, apontando `public/src/Services/TravaTemp.php`. Se passar ou ficar incompleto, a trava está inerte e precisa ser corrigida antes de seguir.

```bash
rm public/src/Services/TravaTemp.php
```

Rode de novo e confirme que voltou a `I` (incomplete).

- [ ] **Step 4: Deixar para o usuário commitar**

Não commite. Apenas informe o arquivo criado:

```
tests/php/SchemaFonteUnicaTest.php
```

---

### Task 2: A migration que leva tudo aos bancos existentes

Precisa vir antes de qualquer remoção: é ela que garante o "nada pode se perder".

**Files:**
- Create: `migrations/20260814_alinhar_alteracoes_pendentes.sql`

**Interfaces:**
- Consumes: nada.
- Produces: a migration de id `20260814_alinhar_alteracoes_pendentes`, aplicada pelo `MigrationRunner`. As Tasks 3, 4 e 5 dependem dela existir para poderem apagar scripts e limpar o baseline.

- [ ] **Step 1: Escrever a migration**

Crie `migrations/20260814_alinhar_alteracoes_pendentes.sql`:

```sql
-- Leva a bancos já existentes tudo que hoje vive só no create_tables.sql.
--
-- Motivo: o baseline e os scripts avulsos de scripts/setup/ acumularam
-- correções que nunca viraram migration. Quem provisionou banco novo recebeu;
-- quem já tinha banco, não. Foi assim que produção ficou sem criador_id.
--
-- Antes de apagar os scripts avulsos, o conteúdo deles precisa estar aqui —
-- senão a remoção perde a correção para todo banco existente.
--
-- Tudo é aditivo e idempotente (MariaDB): reaplicar não estraga nada. O UPDATE
-- do final é idempotente pela própria cláusula WHERE.

-- ── de migrate_privacy.php ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_legal_acceptances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id CHAR(36) NOT NULL,
  terms_version VARCHAR(40) NOT NULL,
  privacy_version VARCHAR(40) NOT NULL,
  accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash CHAR(64) DEFAULT NULL,
  PRIMARY KEY (id),
  INDEX idx_legal_acceptance_user (usuario_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── de migrate_stripe_events.php ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  event_created BIGINT UNSIGNED NOT NULL,
  status ENUM('processing','processed','ignored','failed') NOT NULL DEFAULT 'processing',
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stripe_events_resource_created (resource_id, event_created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stripe_webhook_resources (
  resource_id VARCHAR(255) PRIMARY KEY,
  last_event_created BIGINT UNSIGNED NOT NULL,
  last_event_id VARCHAR(255) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── de migrate_categorias.php ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id            INT          NOT NULL AUTO_INCREMENT,
  banda_id      CHAR(36)     NOT NULL,
  nome          VARCHAR(100) NOT NULL,
  atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_banda_nome (banda_id, nome),
  FOREIGN KEY (banda_id) REFERENCES bandas(id) ON DELETE CASCADE,
  INDEX idx_categorias_banda (banda_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── de create_tables.sql: vínculo com conta Google ───────────────────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) DEFAULT NULL;
ALTER TABLE usuarios ADD UNIQUE KEY IF NOT EXISTS uq_google_sub (google_sub);

-- ── de migrate_banda_logo.php ────────────────────────────────────────────────
-- Logo em base64 estoura TEXT (64 KB); MEDIUMTEXT segura 16 MB.
ALTER TABLE bandas MODIFY COLUMN logo MEDIUMTEXT DEFAULT NULL;

-- ── de create_tables.sql: membro de banda sem e-mail ─────────────────────────
-- Gestor pode cadastrar músico sem e-mail; MariaDB aceita vários NULL na
-- UNIQUE KEY, então uq_email continua válido.
ALTER TABLE usuarios MODIFY COLUMN email VARCHAR(180) DEFAULT NULL;

-- ── de migrate_performance_indexes.php ───────────────────────────────────────
-- Endereço de origem da cifra importada por link.
ALTER TABLE musicas ADD COLUMN IF NOT EXISTS source_url VARCHAR(2048) DEFAULT NULL;

-- Os cinco índices existiam SÓ no baseline: banco já provisionado nunca os
-- recebeu. A falta não gera erro, só lentidão — o pior tipo de perda, porque
-- ninguém percebe.
CREATE INDEX IF NOT EXISTS idx_usuario_banda_banda_perfil ON usuario_banda (banda_id, perfil);
CREATE INDEX IF NOT EXISTS idx_musicas_banda_atualizado ON musicas (banda_id, atualizado_em);
CREATE INDEX IF NOT EXISTS idx_musicas_banda_classificacao ON musicas (banda_id, classificacao);
CREATE INDEX IF NOT EXISTS idx_playlists_banda_visibilidade ON playlists (banda_id, visivel_ate, atualizado_em);
CREATE INDEX IF NOT EXISTS idx_roteiros_banda_visibilidade ON roteiros (banda_id, visivel_ate, atualizado_em);

-- ── de migrate_planos.php e do fim do create_tables.sql ──────────────────────
ALTER TABLE bandas MODIFY COLUMN plano ENUM('trial','gratuito','mensal','semestral','anual','bloqueado','ativo','basico','banda') NOT NULL DEFAULT 'gratuito';

-- O plano 'trial' foi descontinuado. Idempotente pela cláusula WHERE: depois
-- da primeira execução não sobra linha para atualizar.
UPDATE bandas SET plano = 'gratuito', trial_expira_em = NULL WHERE plano = 'trial';
```

As quatro definições de tabela acima foram copiadas do `create_tables.sql` e conferidas linha a linha — não as escreva de memória. Se você alterou o baseline antes de chegar aqui, reconfira:

```bash
grep -A10 "CREATE TABLE IF NOT EXISTS categorias" create_tables.sql
grep -A10 "CREATE TABLE IF NOT EXISTS stripe_webhook_events" create_tables.sql
grep -A6 "CREATE TABLE IF NOT EXISTS stripe_webhook_resources" create_tables.sql
grep -A11 "CREATE TABLE IF NOT EXISTS user_legal_acceptances" create_tables.sql
```

Uma divergência aqui é pior que inofensiva: num banco que **não** tem a tabela, é esta versão que será criada, e ela ficaria diferente da de todo mundo — divergência de schema nova, criada pela correção da divergência de schema.

- [ ] **Step 2: Verificar que o `MigrationRunner` aceita o nome**

Run:

```bash
C:/xampp/php/php.exe -r "require 'public/src/Services/MigrationRunner.php'; foreach (MigrationRunner::discover('migrations') as \$m) echo \$m['id'], PHP_EOL;"
```

Expected: lista as cinco migrations, terminando em `20260814_alinhar_alteracoes_pendentes`. Se lançar "Nome de migration inválido", o arquivo está fora do padrão `^\d{8}_[a-z0-9_]+$`.

- [ ] **Step 3: Provar a idempotência aplicando duas vezes**

A migration precisa rodar sobre um banco que **já tem** tudo — é essa a situação de um banco existente e é onde ela quebraria.

Run:

```bash
npm run test:e2e:db:setup
C:/xampp/php/php.exe scripts/setup/migrate.php
C:/xampp/php/php.exe scripts/setup/migrate.php
```

Expected: a primeira execução imprime `applied 20260814_alinhar_alteracoes_pendentes`; a segunda imprime `up-to-date`. Nenhum erro em nenhuma das duas.

Se `migrate.php` reclamar de variáveis de ambiente, ele está lendo `DB_NAME` (produção). Para apontar ao banco de teste, rode com `APP_ENV=test` e `DB_NAME` igual ao `E2E_DB_NAME`:

```bash
APP_ENV=test DB_NAME=$(grep E2E_DB_NAME .env.local | cut -d= -f2) C:/xampp/php/php.exe scripts/setup/migrate.php
```

- [ ] **Step 4: Provar que ela também funciona no caso real — banco SEM as alterações**

Idempotência num banco que já tem tudo não prova que a migration faz o trabalho. Derrube uma alteração de propósito e veja-a voltar:

```bash
APP_ENV=test C:/xampp/php/php.exe tests/helpers/db-query.php <<< '{"sql":"DROP INDEX idx_musicas_banda_classificacao ON musicas","params":[]}'
APP_ENV=test C:/xampp/php/php.exe tests/helpers/db-query.php <<< '{"sql":"DELETE FROM schema_migrations WHERE migration_id = ?","params":["20260814_alinhar_alteracoes_pendentes"]}'
```

Rode a migration de novo e confirme que o índice voltou:

```bash
APP_ENV=test C:/xampp/php/php.exe tests/helpers/db-query.php <<< '{"sql":"SHOW INDEX FROM musicas WHERE Key_name = ?","params":["idx_musicas_banda_classificacao"]}'
```

Expected: `rows` não vazio. Sem esta verificação, a migration poderia estar cheia de instruções que nunca fazem nada e ninguém notaria.

- [ ] **Step 5: Commit (usuário)**

```bash
git add migrations/20260814_alinhar_alteracoes_pendentes.sql
```

---

### Task 3: `setup_db.php` passa a ler o baseline

**Files:**
- Modify: `scripts/setup/setup_db.php`

**Interfaces:**
- Consumes: a migration da Task 2 (é ela que cobre os `migrate_*.php` removidos aqui).
- Produces: `setup_db.php` sem nenhum `CREATE TABLE`, o que muda o resultado da trava da Task 1.

- [ ] **Step 1: Substituir o SQL inline pela leitura do baseline**

Em `scripts/setup/setup_db.php`, apague o bloco `$sql = "…"` inteiro (da linha com `$sql = "` até a que fecha com `";`) e o laço `foreach ($statements as $stmt)` que o consome, junto com os três `require` de `migrate_*.php`. No lugar:

```php
require_once __DIR__ . '/../../public/src/Services/MigrationRunner.php';

// O schema tem um lugar só: create_tables.sql. Este script LÊ o baseline em
// vez de reescrevê-lo — foi a reescrita que deixou produção com 12 das 17
// tabelas e causou o incidente de 13/08.
//
// splitStatements() em vez de explode(';'): ele respeita aspas, e um ponto e
// vírgula dentro de um valor default partiria o comando ao meio.
$schemaPath = __DIR__ . '/../../create_tables.sql';
if (!is_file($schemaPath)) {
    fwrite(STDERR, "Schema não encontrado em {$schemaPath}.\n");
    exit(1);
}

$statements = MigrationRunner::splitStatements((string) file_get_contents($schemaPath));
$ok = 0;

// Falha no primeiro erro, de propósito. Este script só roda contra banco
// vazio; ali, qualquer erro significa schema quebrado, e seguir em frente é
// exatamente como a divergência se escondeu por meses.
foreach ($statements as $stmt) {
    if (stripos($stmt, 'SET ') === 0) continue;
    try {
        $pdo->exec($stmt);
        $ok++;
    } catch (Throwable $e) {
        fwrite(STDERR, "\n✗ Falhou: " . substr($stmt, 0, 120) . "\n  " . $e->getMessage() . "\n");
        exit(1);
    }
}

echo "✓ {$ok} instruções aplicadas do baseline\n";

// Alterações para bancos que já existem. Num banco novo elas rodam sobre um
// schema que já as contém — por isso precisam ser idempotentes.
$aplicadas = (new MigrationRunner($pdo, __DIR__ . '/../../migrations'))->applyAll();
foreach ($aplicadas as $id) echo "✓ migration {$id}\n";
```

- [ ] **Step 2: Rodar contra um banco vazio de verdade**

```bash
npm run test:e2e:db:setup
```

Isso derruba e recria o banco de teste, dando um alvo limpo. Agora aponte o `setup_db.php` para ele criando um banco descartável:

```bash
APP_ENV=test C:/xampp/php/php.exe -r "
\$pdo = new PDO('mysql:host=127.0.0.1;charset=utf8mb4', 'root', '');
\$pdo->exec('DROP DATABASE IF EXISTS cifro_setup_check');
\$pdo->exec('CREATE DATABASE cifro_setup_check CHARACTER SET utf8mb4');
echo 'pronto', PHP_EOL;
"
```

Rode o `setup_db.php` com `DB_NAME=cifro_setup_check` e `APP_ENV=test` (o `guard.php` bloqueia `production`):

```bash
APP_ENV=test DB_NAME=cifro_setup_check C:/xampp/php/php.exe scripts/setup/setup_db.php
```

Expected: nenhum `✗`, e a listagem final com as 17 tabelas mais `schema_migrations`.

- [ ] **Step 3: Comparar o resultado com o do provisionador de teste**

As duas rotas precisam produzir o mesmo schema. Se divergirem, a unificação não aconteceu:

```bash
APP_ENV=test C:/xampp/php/php.exe -r "
\$e2e = trim(shell_exec('mysql -uroot -N -e \"SHOW TABLES\" ' . getenv('E2E_DB_NAME')));
\$novo = trim(shell_exec('mysql -uroot -N -e \"SHOW TABLES\" cifro_setup_check'));
echo \$e2e === \$novo ? \"IGUAIS\" : \"DIVERGEM:\n--- e2e\n\$e2e\n--- setup\n\$novo\";
echo PHP_EOL;
"
```

Expected: `IGUAIS`. Se o `mysql` CLI não estiver no PATH, use `C:/xampp/mysql/bin/mysql`.

Limpe o banco descartável:

```bash
C:/xampp/php/php.exe -r "(new PDO('mysql:host=127.0.0.1', 'root', ''))->exec('DROP DATABASE cifro_setup_check');"
```

- [ ] **Step 4: Commit (usuário)**

```bash
git add scripts/setup/setup_db.php
```

---

### Task 4: `setup_e2e_db.php` usa o mesmo divisor e aplica migrations

**Files:**
- Modify: `scripts/setup/setup_e2e_db.php`

**Interfaces:**
- Consumes: `MigrationRunner::splitStatements()` e `MigrationRunner::applyAll()`.
- Produces: base de teste provisionada pela mesma sequência da produção, com `schema_migrations` preenchida.

- [ ] **Step 1: Trocar o `preg_split` e acrescentar as migrations**

Em `scripts/setup/setup_e2e_db.php`, substitua o bloco que vai de `$schema = file_get_contents($schemaPath);` até o fim do `foreach` por:

```php
require_once __DIR__ . '/../../public/src/Services/MigrationRunner.php';

// splitStatements() em vez de preg_split('/;\s*(?:\r?\n|$)/'): o regex quebrava
// em qualquer ponto e vírgula seguido de quebra de linha, inclusive dentro de
// uma string SQL. Não mordia hoje, mas esperava o primeiro valor default com
// ponto e vírgula.
$schema = (string) file_get_contents($schemaPath);
foreach (MigrationRunner::splitStatements($schema) as $statement) {
    if (stripos($statement, 'SET ') === 0) continue;
    // Sem tolerância a erro: o banco acabou de ser criado do zero, então
    // qualquer falha aqui é schema quebrado, não estado preexistente.
    $pdo->exec($statement);
}

// Mesma sequência da produção: baseline e depois migrations. Sem isto, a base
// de teste seria a única do projeto que nunca exercita uma migration — e uma
// migration quebrada só apareceria no deploy.
(new MigrationRunner($pdo, __DIR__ . '/../../migrations'))->applyAll();
```

- [ ] **Step 2: Provisionar e conferir o livro-razão**

```bash
npm run test:e2e:db:setup
```

Expected: `Banco E2E local pronto: <nome>`, sem exceção.

```bash
APP_ENV=test C:/xampp/php/php.exe tests/helpers/db-query.php <<< '{"sql":"SELECT migration_id FROM schema_migrations ORDER BY migration_id","params":[]}'
```

Expected: as cinco migrations, incluindo `20260814_alinhar_alteracoes_pendentes`.

- [ ] **Step 3: Rodar a suíte E2E completa**

É a verificação mais direta de que o baseline unificado produz o mesmo schema de antes: a suíte inteira depende deste banco.

Run: `npx playwright test --project=cifro --reporter=list`

Expected: mesmo resultado da linha de base conhecida — 745 passando. Falhas conhecidas por ordem de execução (`64-help-center:57`, `71-csrf-renovacao:28`) não contam; qualquer falha nova relacionada a coluna ou tabela ausente é regressão desta tarefa.

- [ ] **Step 4: Commit (usuário)**

```bash
git add scripts/setup/setup_e2e_db.php
```

---

### Task 5: Limpar o baseline e apagar os scripts absorvidos

**Files:**
- Modify: `create_tables.sql`
- Delete: `scripts/setup/migrate_categorias.php`, `scripts/setup/migrate_privacy.php`, `scripts/setup/migrate_stripe_events.php`, `scripts/setup/migrate_performance_indexes.php`, `scripts/setup/migrate_planos.php`, `scripts/setup/migrate_banda_logo.php`, `scripts/setup/migrate_banda_criador.php`, `scripts/setup/migrate_usuario_banda_externo.php`

**Interfaces:**
- Consumes: a migration da Task 2, que é onde o conteúdo destes scripts passou a viver.
- Produces: baseline sem instruções de dados e sem `ALTER` de recuperação; a trava da Task 1 passa a verde.

**`privacy_cleanup.php` NÃO entra nesta lista.** Não é migração: é rotina de retenção que apaga tokens de recuperação de senha vencidos. Não declara tabela alguma e não aciona a trava. Apagá-lo perderia uma rotina de privacidade.

- [ ] **Step 1: Conferir, uma a uma, que cada remoção tem substituto**

Antes de apagar qualquer coisa. Para cada script, o conteúdo precisa aparecer na migration nova ou numa anterior:

```bash
for s in categorias privacy stripe_events performance_indexes planos banda_logo banda_criador usuario_banda_externo; do
  echo "── migrate_$s"
  grep -oE "(CREATE TABLE( IF NOT EXISTS)? [a-z_]+|ALTER TABLE [a-z_]+ [A-Z]+ [A-Z]+ [a-z_]+|CREATE INDEX \`?[a-z_]+)" "scripts/setup/migrate_$s.php" 2>/dev/null | sort -u
done
```

Confira cada item contra `migrations/*.sql`. Se algum não aparecer em migration nenhuma, **pare e acrescente à migration da Task 2** antes de continuar — mas atenção: se ela já foi aplicada em algum banco, o checksum vai rejeitar a alteração. Nesse caso crie `migrations/20260814_alinhar_alteracoes_pendentes_2.sql`.

- [ ] **Step 2: Limpar o fim do `create_tables.sql`**

Apague deste arquivo:

- a **segunda** declaração de `user_legal_acceptances` (duplicada, idêntica à primeira — é o DEBT-011);
- as duas linhas `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_sub …` e `ALTER TABLE usuarios ADD UNIQUE KEY IF NOT EXISTS uq_google_sub …`;
- o bloco final inteiro a partir do comentário `-- ── Migração de planos: executar em bases já existentes`, que contém o `UPDATE`, o `MODIFY plano`, o `ADD COLUMN cancelamento_agendado_em` e o `MODIFY email`.

E acrescente `google_sub` dentro do `CREATE TABLE usuarios`, logo depois de `config JSON DEFAULT NULL,`:

```sql
  google_sub VARCHAR(255) DEFAULT NULL,
```

e, junto de `UNIQUE KEY uq_email (email)`:

```sql
  UNIQUE KEY uq_google_sub (google_sub),
```

**Não apague** o `ALTER TABLE bandas ADD CONSTRAINT fk_bandas_criador`. `bandas` é criada antes de `usuarios`, então a chave estrangeira só pode ser adicionada depois que as duas existem — é ordem de dependência, não sobra.

- [ ] **Step 3: Apagar os oito scripts**

```bash
git rm scripts/setup/migrate_categorias.php scripts/setup/migrate_privacy.php \
       scripts/setup/migrate_stripe_events.php scripts/setup/migrate_performance_indexes.php \
       scripts/setup/migrate_planos.php scripts/setup/migrate_banda_logo.php \
       scripts/setup/migrate_banda_criador.php scripts/setup/migrate_usuario_banda_externo.php
```

- [ ] **Step 4: Reprovisionar e conferir que nada sumiu**

O baseline mudou; a base de teste precisa nascer de novo e continuar completa.

```bash
npm run test:e2e:db:setup
```

Confirme que as colunas e índices que estavam nos scripts apagados continuam existindo:

```bash
APP_ENV=test C:/xampp/php/php.exe tests/helpers/db-query.php <<< '{"sql":"SHOW COLUMNS FROM usuarios LIKE ?","params":["google_sub"]}'
APP_ENV=test C:/xampp/php/php.exe tests/helpers/db-query.php <<< '{"sql":"SHOW COLUMNS FROM musicas LIKE ?","params":["source_url"]}'
APP_ENV=test C:/xampp/php/php.exe tests/helpers/db-query.php <<< '{"sql":"SHOW INDEX FROM playlists WHERE Key_name = ?","params":["idx_playlists_banda_visibilidade"]}'
```

Expected: `rows` não vazio nos três.

- [ ] **Step 5: Desarmar a abstenção da trava e vê-la ficar verde de verdade**

A dívida acabou de ser paga, então a lista de exceções precisa sumir junto — senão fica uma trava com furos permanentes, que é pior que trava nenhuma.

Em `tests/php/SchemaFonteUnicaTest.php`, apague a constante `DIVIDA_CONHECIDA` inteira (e o bloco de comentário acima dela) e, no método de teste, substitua o final por:

```php
        self::assertSame(
            [],
            $infratores,
            "CREATE TABLE fora de create_tables.sql e migrations/:\n  "
                . implode("\n  ", $infratores)
        );
    }
```

removendo as linhas de `$novos`, do `assertSame` de `$novos`, de `$restantes` e do `markTestIncomplete`.

Run: `npm run test:unit:php -- --filter SchemaFonteUnicaTest`

Expected: PASS, sem `I` de incompleto. Se aparecer `I`, sobrou `markTestIncomplete` no arquivo. Se der FAIL, sobrou `CREATE TABLE` em algum script que deveria ter sido apagado.

- [ ] **Step 6: Commit (usuário)**

```bash
git add create_tables.sql scripts/setup/
```

---

### Task 6: A trava contra dados no baseline

Separada da Task 5 porque protege coisa diferente: a Task 1 impede declaração duplicada, esta impede o baseline mexer em dados.

**Files:**
- Modify: `tests/php/SchemaFonteUnicaTest.php`

**Interfaces:**
- Consumes: os helpers `conteudo()` e a constante `RAIZ` da Task 1.
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: Escrever o teste**

Acrescente a `tests/php/SchemaFonteUnicaTest.php`, antes do fecha-chaves da classe:

```php
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

        $encontrados = [];
        foreach (['UPDATE', 'INSERT', 'DELETE', 'TRUNCATE'] as $comando) {
            if (preg_match('/\b' . $comando . '\b\s+(?!.*ON\s+DELETE)/i', (string) $sql)) {
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
```

- [ ] **Step 2: Rodar e ver passar**

Run: `npm run test:unit:php -- --filter SchemaFonteUnicaTest`

Expected: PASS nos dois testes — o `UPDATE` saiu na Task 5.

- [ ] **Step 3: Provar que a trava morde**

Um teste que nunca foi visto falhando não é trava. Acrescente temporariamente ao fim do `create_tables.sql`:

```sql
UPDATE bandas SET plano = 'gratuito' WHERE plano = 'trial';
```

Run: `npm run test:unit:php -- --filter testBaselineNaoAlteraDados`

Expected: FAIL, com a mensagem apontando `UPDATE`.

Confira também que a cláusula `ON DELETE CASCADE`, que está em várias chaves estrangeiras do arquivo, **não** dispara falso positivo — se o teste acusar `DELETE` mesmo depois de você remover o `UPDATE`, o regex precisa de ajuste.

Remova a linha e rode de novo:

Expected: PASS.

- [ ] **Step 4: Rodar a suíte unitária inteira**

Run: `npm run test:unit:php`

Expected: 496 testes passando mais os dois novos — 498. Nenhuma regressão.

- [ ] **Step 5: Commit (usuário)**

```bash
git add tests/php/SchemaFonteUnicaTest.php
```

---

### Task 7: Registrar no backlog e na documentação

**Files:**
- Modify: `backlog.md`
- Modify: `README.md` (seção "Setup local")

**Interfaces:**
- Consumes: nada.
- Produces: nada.

- [ ] **Step 1: Marcar DEBT-001 e DEBT-011 como resolvidos**

Em `backlog.md`, na seção "Resolvido em 2026-08-13" (ou crie "Resolvido em 2026-08-14"), acrescente:

```markdown
- **schema em fonte única (DEBT-001, e com ele DEBT-011)** — `create_tables.sql`
  passou a ser a única declaração de tabelas do projeto; `setup_db.php`, que
  mantinha uma segunda cópia com 12 das 17 tabelas, passou a lê-lo. A base de
  teste e o provisionamento de banco novo seguem a mesma sequência: baseline e
  depois migrations. Produção continua atendida só por
  `migrate.php --allow-production`, porque o baseline tem instruções que
  quebram — ou corrompem — banco povoado.

  Oito scripts avulsos de `scripts/setup/` foram absorvidos por uma migration
  única e apagados. A auditoria antes da remoção achou o que teria se perdido:
  `migrate_performance_indexes` criava cinco índices que existiam só no
  baseline, sem migration nenhuma — bancos já provisionados nunca os receberam,
  e a falta não gera erro, só lentidão.

  Duas travas em `tests/php/SchemaFonteUnicaTest.php` impedem a reincidência:
  `CREATE TABLE` fora de `create_tables.sql` e `migrations/` quebra a suíte, e
  instrução de dados no baseline também.
```

Remova as linhas de DEBT-001 e DEBT-011 da tabela "Ordem recomendada" da dívida técnica e renumere a coluna `Ordem`.

- [ ] **Step 2: Documentar o fluxo de provisionamento**

O alvo é o `README.md` da raiz, na seção "Setup local" — `docs/README.md` é só índice.

Duas correções de rota antes do texto novo:

1. O passo 3 do "Setup local" manda executar `public/create_tables.sql`. O arquivo está na **raiz**, não em `public/`. Corrija o caminho.
2. A seção "Deploy (Hostinger)" lista `scripts/` entre o que **não sobe**. Logo o `migrate.php` não existe no servidor — e foi por isso que as migrations de 13/08 foram aplicadas por conexão remota. Isso não é defeito: o `DB_HOST` da Hostinger é alcançável de fora, então o `migrate.php` roda **na máquina local, apontando para o banco de produção**. É esse o fluxo a documentar, e não subir `scripts/`.

Substitua o passo 3 do "Setup local" e acrescente a tabela de decisão:

```markdown
### Como o schema chega a cada banco

| Situação | Comando | O que roda |
|---|---|---|
| Subir base de teste | `npm run test:e2e:db:setup` | baseline + migrations |
| Máquina nova, banco vazio | `scripts/setup/setup_db.php` | baseline + migrations |
| Produção | `scripts/setup/migrate.php --allow-production` | **só migrations** |

`create_tables.sql` é o retrato do banco zerado e a única declaração de tabelas
do projeto. **Nunca rode o baseline contra banco com dados**: ele contém um
`ALTER TABLE … ADD CONSTRAINT` que não é idempotente.

`scripts/` não é enviado à Hostinger, então o `migrate.php` roda **da máquina
local apontando para o banco de produção** — o `DB_HOST` é alcançável de fora.
Confira antes o que está pendente, e só então aplique:

```bash
php scripts/setup/migrate.php --status
```

Aplicar exige duas confirmações independentes, de propósito:
`--allow-production` na linha de comando **e** `MIGRATIONS_ALLOW_PRODUCTION=true`
no ambiente.

Toda alteração de banco existente nasce em `migrations/`, com nome no formato
`AAAAMMDD_descricao_curta.sql`. Como num banco novo as migrations rodam sobre um
baseline que já as contém, elas precisam ser idempotentes: use
`IF NOT EXISTS` e `MODIFY`. São extensões do MariaDB — o projeto não roda em
MySQL.
```

- [ ] **Step 3: Commit (usuário)**

```bash
git add backlog.md docs/README.md
```

---

## Verificação final

Depois da Task 7, rode a bateria completa e compare com a linha de base:

```bash
npm run test:unit:php
```
Expected: 498 passando.

```bash
npm run test:e2e:db:setup && npx playwright test --project=cifro --reporter=list
```
Expected: 745 passando, com as falhas conhecidas por ordem de execução.

```bash
npx playwright test --project=pwa --reporter=list
```
Expected: 54 passando. O projeto `pwa` fica vermelho em torno de uma rodada a cada três por corridas conhecidas (DEBT-003) — falha ali não é regressão desta mudança, mas confirme que a falha é uma das conhecidas e não erro de coluna ou tabela ausente.
