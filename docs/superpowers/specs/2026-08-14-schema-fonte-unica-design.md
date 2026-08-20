# Schema em fonte única (DEBT-001)

**Data:** 2026-08-14
**Item de backlog:** DEBT-001 — fecha também DEBT-011 (tabela declarada em duplicidade)
**Escopo:** estreito — não inclui automação de deploy (DEBT-002)

## O problema

O schema do Cifrô é declarado em dois lugares que divergiram:

- `create_tables.sql` — 17 tabelas, consumido por `setup_e2e_db.php`;
- `scripts/setup/setup_db.php` — 12 tabelas escritas inline.

A divergência causou o incidente de 13/08: produção ficou sem
`bandas.criador_id`, `bandas.plano_expira_em`, `bandas.cancelamento_agendado_em`
e a tabela `sync_changes`. Quatro funcionalidades quebradas, das quais só uma
tinha sido percebida — "Erro ao salvar banda".

A causa não é descuido pontual. É que existiam dois lugares onde declarar uma
tabela e nada obrigava a escolher o mesmo. A tabela `auth_tokens`, criada nesta
mesma semana, nasceu só num dos dois pelo mesmo motivo.

## Decisões tomadas

**Toda alteração de banco existente nasce como migration.** O
`create_tables.sql` deixa de ser editado a cada mudança e passa a ser o retrato
do banco zerado. Foi escolhido sobre as alternativas de manter os dois em dia
(é a situação atual com mais disciplina, e disciplina foi o que falhou) e de
reaplicar o arquivo inteiro a cada deploy (`IF NOT EXISTS` não cobre alteração
de coluna já existente, e sem livro-razão não há como saber o que rodou).

**O escopo não inclui dar caminho automático a produção.** Isso é DEBT-002.

## Arquitetura

Dois artefatos com papéis que não se sobrepõem:

| Artefato | Papel | Roda contra |
|---|---|---|
| `create_tables.sql` | retrato do banco zerado; única declaração de tabelas | banco vazio |
| `migrations/*.sql` | histórico de alterações, com livro-razão e checksum | banco existente |

Os dois provisionadores passam a fazer a mesma coisa, na mesma ordem:

```
setup_db.php      (banco vazio)  ─┐
                                  ├─→ create_tables.sql → MigrationRunner(migrations/)
setup_e2e_db.php  (base de teste)─┘

migrate.php --allow-production    ──→ MigrationRunner(migrations/)   [só migrations]
```

`scripts/` não é enviado à Hostinger — o próprio README lista a pasta entre o
que não sobe. O `migrate.php` roda, portanto, da máquina local apontando para o
banco de produção, cujo `DB_HOST` é alcançável de fora. Foi assim que as
migrations de 13/08 entraram; a diferença é que passa a ser pelo comando, com
livro-razão, em vez de instrução colada à mão.

### Por que o baseline nunca toca produção

`create_tables.sql` contém instruções que quebram — ou pior, corrompem — um
banco povoado:

```
ALTER TABLE bandas ADD CONSTRAINT fk_bandas_criador      → erro se já existe
UPDATE bandas SET plano='gratuito' WHERE plano='trial'   → altera DADOS
ALTER TABLE bandas ADD COLUMN cancelamento_agendado_em   → sem IF NOT EXISTS
```

A do meio é a séria: rodar o baseline num banco com dados rebaixaria para
gratuito toda banda em trial.

Note que isso vale mesmo depois desta mudança. O baseline continuará tendo o
`ALTER` da chave estrangeira, que não é idempotente — e não precisa ser, porque
só roda contra banco vazio. Baseline e migrations têm exigências diferentes de
propósito.

### Consequência da ordem "baseline, depois migrations"

Num banco novo as migrations rodam sobre um schema que já contém o que elas
fazem. A idempotência delas (`IF NOT EXISTS`, `MODIFY`) deixa de ser boa prática
opcional e passa a ser requisito do desenho.

**Amarra de plataforma:** `ADD COLUMN IF NOT EXISTS` é extensão do MariaDB e não
existe no MySQL. Local roda MariaDB 10.4, produção 11.8. Trocar de motor
quebraria a idempotência das migrations em silêncio.

## Mudanças, arquivo por arquivo

`create_tables.sql` já contém `logo MEDIUMTEXT`, `criador_id`,
`plano_expira_em`, `cancelamento_agendado_em` e o ENUM completo de `plano` —
verificado.

**`create_tables.sql`**
- remove a segunda declaração, idêntica, de `user_legal_acceptances` (DEBT-011);
- dobra `google_sub` e seu índice único para dentro do `CREATE TABLE usuarios`,
  onde deveriam estar — hoje são a única coluna do schema que existe só como
  `ALTER` avulso;
- remove os demais `ALTER` e o `UPDATE` do fim do arquivo, que passam a viver na
  migration descrita abaixo.

Permanece com um `ALTER TABLE` no fim, e isso está correto: `bandas` é criada
antes de `usuarios`, então `fk_bandas_criador` só pode ser adicionada depois que
as duas existem. É ordem de dependência, não sujeira.

**Nova migration — `20260814_alinhar_alteracoes_pendentes.sql`**

Levantamento instrução por instrução, porque a suposição de que "já estava
coberto" foi o que causou o incidente de 13/08:

| Instrução | Já no `CREATE`? | Migration existente |
|---|---|---|
| `usuarios` `google_sub` + `uq_google_sub` | não | não |
| `bandas MODIFY plano` ENUM | sim | não |
| `bandas ADD cancelamento_agendado_em` | sim | sim (`20260813`) |
| `usuarios MODIFY email VARCHAR(180)` | sim | não |
| `bandas MODIFY logo MEDIUMTEXT` | sim | não |
| `UPDATE bandas SET plano='gratuito' WHERE plano='trial'` | — | não |

Só uma das cinco alterações de estrutura estava coberta. As quatro restantes,
mais o `UPDATE`, entram nesta migration — junto com tudo o que a auditoria dos
scripts órfãos (seção adiante) apontou como existente só no baseline:
`musicas.source_url`, os cinco índices de performance e as quatro tabelas que os
scripts avulsos criavam.

Isso elimina a necessidade de inspecionar produção antes de apagar qualquer
script: a migration cobre os dois casos, tenha a base a alteração ou não.

**`scripts/setup/setup_db.php`**
- apaga as 12 tabelas inline; passa a ler `create_tables.sql`;
- divide com `MigrationRunner::splitStatements()`;
- some com os três `require migrate_*.php`. Conferido um a um:
  `migrate_usuario_banda_externo` é idêntico à migration
  `20260810_usuario_banda_externo`; a coluna de `migrate_banda_criador` está em
  `20260813_alinhar_schema_producao` (a chave estrangeira fica de fora de
  propósito, como aquela migration documenta); `migrate_banda_logo` passa a
  estar na migration nova.

**`scripts/setup/setup_e2e_db.php`**
- troca `preg_split('/;\s*(?:\r?\n|$)/')` por `splitStatements()`. O `preg_split`
  quebra em qualquer `;` seguido de quebra de linha, inclusive dentro de string
  SQL — não morde hoje, mas espera um valor default com ponto e vírgula;
- passa a rodar o `MigrationRunner` depois do baseline, para os dois caminhos
  ficarem idênticos.

## Auditoria dos scripts a apagar — nada pode se perder

Requisito explícito: nenhum script sai antes de o conteúdo dele estar
representado no baseline **e** numa migration idempotente. O baseline cobre
banco novo; a migration cobre banco que já existe. Faltar o segundo é
exatamente como `criador_id` se perdeu em produção.

| Script | O que faz | No baseline | Migration |
|---|---|---|---|
| `migrate_categorias` | `CREATE TABLE categorias` + backfill de `musicas.classificacao` | tabela sim, backfill não | nova |
| `migrate_privacy` | `CREATE TABLE user_legal_acceptances` | sim | nova |
| `migrate_stripe_events` | `CREATE TABLE stripe_webhook_events`, `stripe_webhook_resources` | sim | nova |
| `migrate_performance_indexes` | `musicas.source_url` + 5 índices | sim | nova |
| `migrate_planos` | `bandas MODIFY plano` + `UPDATE` trial | sim | nova |
| `migrate_banda_logo` | `bandas MODIFY logo MEDIUMTEXT` | sim | nova |
| `migrate_banda_criador` | `bandas.criador_id` + FK + backfill do criador | coluna sim, backfill não | coluna em `20260813`; backfill na nova (FK fora, de propósito) |
| `migrate_usuario_banda_externo` | `usuario_banda MODIFY perfil` | sim | `20260810` |

`migrate_performance_indexes` foi o achado que justifica a auditoria: além do
`source_url`, ele cria cinco índices de performance que existem **só no
baseline**, sem migration nenhuma. Apagá-lo sem substituto deixaria qualquer
base já existente sem eles — degradação silenciosa, do tipo que não gera erro,
só lentidão no palco.

### A auditoria precisou ser auditada

A primeira versão desta tabela dava `migrate_categorias` e `migrate_banda_criador`
por cobertos. Não estavam. Eu tinha varrido os scripts procurando **estrutura** —
`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX` — e os dois também mexem em
**dados**:

- `migrate_banda_criador` preenche `bandas.criador_id` a partir do administrador
  vinculado. A coluna vinha de `20260813`; o valor, de lugar nenhum.
- `migrate_categorias` converte a coluna de texto livre `musicas.classificacao`
  em linhas de `categorias`.

Os dois entraram na migration nova. O detalhe que dói: o `UPDATE bandas` do
primeiro **apareceu na saída da minha varredura** e eu segui adiante mesmo assim,
porque estava lendo a lista à procura de tabelas. Uma varredura que devolve o
achado certo não serve de nada se a pergunta na cabeça de quem lê for a errada.

### O que ficou de fora por decisão de produto

`migrate_categorias` também semeava cinco categorias fixas — "Louvor Animado",
"Marianas", "Oracionais", "Adoração", "Missa" — em toda banda. **Não entra.**
Não é schema nem preservação de dado: é opinião de um contexto específico. Os
nomes não existem em nenhum outro lugar do código, e incluí-la escreveria dado
opinativo em toda banda de produção, inclusive nas que hoje não têm categoria
alguma.

Isso deixa uma pergunta de produto em aberto, registrada no backlog: banda nova
nasce sem categoria nenhuma hoje, e nada no app recria essas cinco. Se elas
fazem falta, o lugar é a criação de banda, não uma migration.

**`privacy_cleanup.php` não é um destes e permanece.** Não é migração: é rotina
de retenção, apaga tokens de recuperação de senha vencidos há mais de sete dias.
Não declara tabela alguma, então nem sequer aciona a trava. Sai da lista de
remoção — apagá-lo perderia uma rotina de privacidade, não uma duplicação.

Todas as instruções da migration nova são idempotentes, verificado no MariaDB
10.4 local: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
`ADD UNIQUE KEY IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` e `MODIFY`. O
`UPDATE` é idempotente pela própria cláusula `WHERE plano = 'trial'`.

## Tratamento de erro

Hoje o `setup_db.php` imprime `✗` e segue; o `setup_e2e_db.php` engole os erros
1060 e 1061 (coluna e chave duplicadas). Ambos rodam contra banco vazio, onde
qualquer erro significa schema quebrado — e continuar é exatamente como a
divergência se esconde. Passam a falhar no primeiro erro.

`migrate.php` já falha alto: PDO em modo exceção, e o `MigrationRunner` recusa
migration já aplicada cujo conteúdo mudou.

## Testes

Duas travas, ambas sem banco:

1. **Nenhum `CREATE TABLE` fora do lugar.** Valem `create_tables.sql` e
   `migrations/*.sql`. Exceções explícitas: `MigrationRunner`, que declara o
   próprio livro-razão, e `tests/`, que cria tabelas de fixture. É a trava que
   teria impedido `auth_tokens` de nascer só num lado.

2. **Nenhum `UPDATE`, `INSERT` ou `DELETE` no `create_tables.sql`.** Baseline
   declara estrutura, não mexe em dados. Teria pego o `UPDATE` do trial.

Cada trava precisa falhar antes de passar: introduzir a violação, ver vermelho,
remover. Uma trava que nunca foi vista falhando não é trava.

**Regressão:** a suíte E2E depende de `setup_e2e_db.php` para existir. Se o
banco de teste subir errado, a suíte inteira acusa. É a verificação mais direta
de que o baseline unificado produz o mesmo schema de antes.

## O erro que este documento quase cometeu

A primeira versão desta spec afirmava que os `ALTER` do fim do
`create_tables.sql` estavam "cobertos por migration". Conferindo um a um, só um
dos quatro estava. Seguir a spec como escrita teria apagado três correções sem
substituto — que é exatamente a forma do incidente de 13/08, onde `criador_id`
existia no baseline e não em produção.

Fica registrado porque a lição não é sobre estes quatro `ALTER`: é que
"provavelmente já está coberto" não é verificação. O levantamento leva um
minuto e é a diferença entre fechar a dívida e reproduzi-la.

## Fora de escopo

- automação de deploy (DEBT-002);
- squash de migrations antigas no baseline;
- as 265 bandas órfãs no banco de teste (DEBT-007).
