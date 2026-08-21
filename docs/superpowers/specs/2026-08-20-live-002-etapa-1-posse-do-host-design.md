# LIVE-002 etapa 1 — Posse do host — Design

## Objetivo

Dar semântica real à posse do comando de uma live: quem é o host, por quanto tempo, como se pede o controle, e como se sai dele. Hoje qualquer pessoa autorizada toma o comando a qualquer momento, e o líder deposto é informado de que perdeu a conexão — o que é falso.

Esta é a primeira de cinco etapas do LIVE-002. As demais (presença, reconexão e estado degradado, repertório em execução, registro de sessão) têm spec própria e vêm depois.

## Diagnóstico do estado atual

Medido no código em 2026-08-20.

- [`LiveStateService::assumirHost()`](../../../public/src/Services/LiveStateService.php) sobrescreve o host **sem verificar se existe host ativo**.
- `hostAindaAtivo()` existe, com timeout de 60s, mas é consultado num único lugar — dentro de `status()`, apenas para exibir se há host. Nunca para proteger a posse.
- [`atualizar()`](../../../public/src/Services/LiveStateService.php) rejeita corretamente um `hostId` que não é mais o atual, devolvendo 403 com a mensagem "Apenas o host atual pode atualizar a live".
- [`postJson()`](../../../public/src/js/live.js) lança um `Error` que preserva só a mensagem, descartando status e corpo.
- [`atualizarHost()`](../../../public/src/js/live.js) captura qualquer erro e chama `setDisconnectedStatus()`.

**Consequência:** o host deposto vê "Live desconectada (último contato há Ns)". O servidor diz a verdade e o cliente a joga fora. O líder procura problema de rede enquanto a rede está perfeita.

Não existe `release`, `transfer` nem `presence`. `host.php` faz `json_decode` do corpo e **nunca usa o resultado** — os testes atuais já mandam `{action:'start'}` e isso é ignorado.

## Decisões tomadas

1. **Estender `live_state`** em vez de criar `live_sessions`. A tabela já tem `version`, `host_id`, `host_user_id` e `updated_at`. Criar tabela nova exigiria migrar dados e reescrever três endpoints, colocando em risco os 48 testes de `13-live-mode` sem entregar nada a mais nesta etapa. Se a etapa 5 precisar de histórico, ela cria a própria tabela.
2. **Lease 90s, renovação 30s, janela do pedido 30s.** O número que manda é o lease ficar acima dos ~60s de estrangulamento de timer em aba oculta. Abaixo disso o host oscilaria entre vivo e expirado sozinho, gerando tomadas espontâneas sem ninguém pedir nada.
3. **Lease em coluna explícita**, não derivado de `updated_at + timeout`. `updated_at` sobe em qualquer escrita por `ON UPDATE CURRENT_TIMESTAMP`; amarrar posse a ele faz uma mudança da constante reinterpretar o passado inteiro. Coluna explícita também permite devolver um instante concreto ao cliente.
4. **409 para "agora não dá", 403 para "você não pode".** `require_live_host()` já usa 403 para permissão. Reaproveitar 403 tornaria impossível ao cliente distinguir "seu perfil não hospeda" de "outra pessoa está no comando".
5. **A aprovação autoriza, não transfere.** Ver "Por que o pedido tem estado próprio".
6. **Sem feature flag.** Os três testes que codificam a tomada livre são atualizados junto com a mudança. Decidido com o responsável: eles fixam a regra que esta etapa existe para substituir.
7. **Fonte de tempo injetável no `LiveStateService`.** Sem isso, as bordas de expiração só seriam testáveis dormindo 90 segundos.
8. **Transação com `SELECT ... FOR UPDATE` em toda operação que decide posse.** O código atual lê e escreve sem trava no caminho de banco; isso é inofensivo enquanto o claim sempre sobrescreve, e deixa de ser quando a aceitação passa a depender do estado lido.
9. **Nenhuma comparação de data em SQL.** Ver "Relógios" — comparar no banco anularia a decisão 7 e faria a matriz de bordas passar verde medindo outra coisa.
10. **Hook de reset de estado da live para os testes.** Ver "Isolamento de estado nos testes". Sem ele, a regra nova transforma contaminação entre arquivos de teste em falha intermitente.

Nenhuma das três últimas estava na primeira versão deste documento. Foram achadas na auditoria, e são de execução, não de regra de negócio — o tipo de problema que não aparece lendo o desenho no papel.

## Modelo de dados

Migration aditiva sobre `live_state`:

```sql
ALTER TABLE live_state
  ADD COLUMN IF NOT EXISTS lease_expira_em   DATETIME     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pedido_usuario_id CHAR(36)     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pedido_nome       VARCHAR(120) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pedido_expira_em  DATETIME     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pedido_status     ENUM('pendente','aprovado','negado') DEFAULT NULL;
```

Arquivo: `migrations/20260820_live_state_posse.sql`.

As mesmas cinco colunas entram **também** no `create_tables.sql`, na definição de `live_state`. As duas coisas são obrigatórias e precisam ir juntas: o baseline serve banco novo, a migration serve banco existente. `IF NOT EXISTS` é o que permite que um banco novo aplique o baseline e depois a migration sem colidir.

Em 2026-08-20 o banco de produção foi encontrado sem `schema_migrations` e com 8 migrations pendentes, e isso derrubou o sync. Depois de aplicar esta migration, conferir com `GET /health.php?check=schema`, que responde 503 enquanto houver pendência.

### Por que o pedido tem estado próprio

Quando o host aceita, o pedinte precisa virar host — e para escrever na live é preciso um `hostId`, que é o segredo de autorização. `status.php` é lido pela banda inteira; devolver o `hostId` ali entregaria o comando a qualquer um.

Por isso a aprovação **autoriza** em vez de transferir: o host aceita, o pedido fica `aprovado`, o pedinte refaz o claim, e só então o servidor emite um `hostId` novo na resposta do claim — que só ele recebe. O segredo nunca passa por um endpoint de leitura coletiva.

## Regra de posse

Um claim do usuário U é aceito se, e somente se, uma destas for verdadeira:

| Condição | Situação |
|---|---|
| não há host | sala vazia |
| `lease_expira_em` já passou | host sumiu |
| U já é o host | renovação |
| pedido de U com status `aprovado` e não expirado | o host consentiu |
| pedido de U com status `pendente`, vencido e ainda vivo | silêncio por 30s (ver "Vida útil do pedido") |

Qualquer outro caso: **409**, acompanhado do nome de quem está no comando.

Expiração é `agora >= expira_em`.

**Todo claim aceito limpa os cinco campos de pedido** e grava `lease_expira_em = agora + 90s`. Sem essa limpeza, um pedido vencido ficaria na linha autorizando claims futuros do mesmo usuário para sempre — o pedinte assumiria uma vez por silêncio e depois poderia retomar quando quisesse, ignorando o lease de quem estivesse no comando.

## Concorrência

Hoje [`withRepoState()`](../../../public/src/Services/LiveStateService.php) faz leitura, callback e escrita **sem transação e sem trava**: o parâmetro `LOCK_EX` só tem efeito no caminho de arquivo e é ignorado no caminho de banco. Isso é inofensivo enquanto o claim sempre sobrescreve, mas deixa de ser no instante em que a aceitação passa a depender do estado lido.

Sem correção, dois claims concorrentes leem "lease expirado", **ambos passam na regra**, ambos recebem 200 com `hostId`, e só a última escrita sobrevive — o perdedor sai com um `hostId` órfão e só descobre no `update` seguinte.

**Toda operação que decide posse — claim, release, request, answer — roda dentro de uma transação com `SELECT ... FOR UPDATE` sobre a linha de `live_state` da banda.** A leitura que alimenta a decisão e a escrita que a aplica ficam na mesma transação. `status.php` continua fora disso: é leitura pura e não decide nada.

A trava é por `banda_id`, que é a chave primária da tabela, então bandas diferentes nunca se bloqueiam.

## Transições

- **Pedir controle** — cria pedido com `pedido_expira_em = agora + 30s`, status `pendente`. Pedido de outra pessoa já pendente: 409. Sem host: 400 ("não há host, assuma direto"). Mesmo pedinte repetindo: idempotente, devolve o pedido existente **sem** estender a janela.
- **Host aceita** — status vira `aprovado`. O pedinte descobre no polling e refaz o claim.
- **Host nega** — status vira `negado` e `pedido_expira_em` é reescrito para `agora + 30s`. Esse único campo faz dois trabalhos: até ele vencer, o pedinte lê "negado" e distingue negação de silêncio; e enquanto ele não vencer, um novo pedido do mesmo usuário é recusado. É o cooldown, sem coluna extra. Não há conflito com a regra de posse, que só autoriza claim sobre pedido `pendente` expirado — nunca sobre `negado`.
- **Novo pedido após negação** — permitido assim que `pedido_expira_em` vence. Um pedido `pendente` já expirado não é substituído por um novo: ele já autoriza o claim, e recriá-lo só adiaria a tomada do próprio pedinte.
- **Silêncio** — o pedido segue `pendente` mas expirado, e isso passa a autorizar o claim de U.
- **Liberar** — o host limpa `host_id` e `lease_expira_em`; pedido pendente é descartado e a sala fica livre imediatamente.
- **Host cai** — com pedido pendente, o pedinte assume pela regra de lease expirado, não pela de silêncio.

### Quem pode chamar o quê

- **`release.php` só o host atual.** Quem não é host recebe **409** — a sala tem dono e não é ele. Sala sem host recebe 200 e não faz nada: liberar o que já está livre é sucesso, não erro.
- **`answer.php` só o host atual**, e só com pedido `pendente` e não vencido. Quem não é host recebe 409. Host sem pedido pendente, ou com pedido já vencido, recebe **409** — a janela passou e o pedinte já pode ter assumido; responder depois não pode desfazer isso.

### Vida útil do pedido

`pedido_expira_em` marca o fim da janela de ação. O que acontece depois depende do status, e **todo efeito é limitado no tempo** — nenhum pedido produz autorização perpétua:

| Status | Enquanto não vence | Depois de vencer |
|---|---|---|
| `pendente` | o pedinte aguarda resposta | autoriza o claim do dono por **60s**, e então morre |
| `aprovado` | autoriza o claim do dono | morre |
| `negado` | cooldown do dono | morre |

Os 60s de sobrevida do `pendente` vencido existem porque, sem eles, um pedido esquecido autorizaria seu dono a tomar o comando horas depois. A confirmação no cliente ajuda, mas autorização com prazo é regra de servidor, não de tela.

"Morto" é **derivado, não armazenado** — não há sexta coluna. Um pedido está morto quando `agora >= pedido_expira_em + 60s` para `pendente`, e quando `agora >= pedido_expira_em` para `aprovado` e `negado`.

### Pedido de terceiro sobre pedido existente

"Um pedido por vez" vale para qualquer status, não só `pendente`:

| Estado da linha | Outro usuário pede |
|---|---|
| pedido **vivo**, qualquer status | **409** |
| pedido **morto** | aceito, substitui a linha |

Sem isso, Y pediria durante o cooldown de X e apagaria a linha — destruindo o cooldown de X e a informação de que X foi negado. E, no caso do `pendente` vencido, Y furaria a fila tomando o direito que X já tinha conquistado pelo silêncio.

## Componentes

| Endpoint | Operação | Resposta |
|---|---|---|
| `host.php` *(existente)* | claim | 200 com `hostId`, ou 409 com `hostNome` |
| `release.php` *(novo)* | host libera | 200; **409** se quem chama não é o host |
| `request.php` *(novo)* | pedir controle | 200 com `expiraEm`; **409** se há pedido vivo; **400** se não há host |
| `answer.php` *(novo)* | aceitar ou negar | 200; **409** se quem chama não é o host, ou se não há pedido pendente e vivo |

Todos com `require_auth_json` + `require_csrf` + `require_live_host` + isolamento por banda, e todos sob o rate limit descrito em "Limites, segurança e erros".

`status.php` ganha campos sem perder nenhum:

```json
{
  "hostNome": "Léo",
  "leaseExpiraEm": "2026-08-20T22:31:00Z",
  "serverTime":    "2026-08-20T22:30:12Z",
  "pedido": { "nome": "Ana", "status": "pendente",
              "expiraEm": "2026-08-20T22:30:42Z", "souEu": false }
}
```

`souEu` é calculado no servidor a partir da sessão, para não devolver `usuario_id` de terceiros num endpoint coletivo.

`update.php` renova `lease_expira_em` no `keepAlive` e devolve o bloco `pedido`, de modo que o host descobre o pedido no polling que já faz. O 403 de host inválido ganha `"code": "nao_e_mais_host"`.

### Cliente

1. `postJson()` anexa `status` e `code` ao erro que lança.
2. `atualizarHost()` trata `code === 'nao_e_mais_host'` saindo do modo host e dizendo a verdade; todo o resto continua caindo em `setDisconnectedStatus()`.
3. `keepAliveMs` vai a 30s. Três estados novos de UI: recusa com "Fulano está no comando" e botão **Pedir controle**; aviso ao host com **Aceitar** / **Negar**; e confirmação do pedinte quando a janela vence — *"ninguém respondeu, assumir mesmo assim?"*. Essa confirmação impede que um pedido esquecido vire tomada acidental muito depois.

## Relógios

Toda resposta carrega `serverTime` junto das expirações. O cliente nunca compara com o relógio local: calcula o restante como diferença entre dois instantes vindos ambos do servidor.

**Regra obrigatória: todo instante é calculado e comparado em PHP, em UTC. Nenhuma comparação de data acontece em SQL.**

Proibido, portanto: `WHERE lease_expira_em > NOW()`, `TIMESTAMPDIFF`, `DATE_ADD` e equivalentes para decidir posse. As colunas são lidas como string, convertidas e comparadas contra a fonte de tempo injetada.

Duas razões, e a segunda é a que dói:

1. As colunas novas são `DATETIME`, que não guarda fuso, e `updated_at` é `TIMESTAMP`, que converte por fuso da sessão. Misturar os dois com comparação no banco depende da configuração do servidor. Em produção `NOW()` e `UTC_TIMESTAMP()` coincidem hoje — mas isso é configuração daquele servidor, não garantia do desenho.
2. Comparar em SQL **anula a fonte de tempo injetável** da decisão 7. O MySQL usaria o relógio dele, e toda a matriz de bordas — claim 1s antes, 1s depois, silêncio de 30s, cooldown — passaria verde medindo outra coisa. Testes que passam medindo errado são piores que testes ausentes.

A gravação usa o mesmo caminho: o serviço formata a partir da fonte de tempo injetada, e o banco só armazena.

## Limites, segurança e erros

- `hostId` continua vindo de `random_bytes(16)` e é emitido apenas na resposta do claim.
- Aprovação é nominal: um terceiro com aprovação alheia recebe 409.
- Rate limit com o `cifro_rate_limit()` que já existe no bootstrap, identidade por usuário **e** banda. Estouro devolve **429**, distinto dos 403 e 409 acima.

  Os limites precisam caber no uso legítimo mais intenso, que é a própria suíte: os specs de live somam cerca de oito claims do mesmo administrador em sequência rápida. Um teto de 10 por 60s estouraria de forma intermitente e apareceria como teste "flaky", que é o modo de falhar mais caro de diagnosticar. Por isso: **`live.claim` e `live.request` a 30 por 60s, `live.answer` a 60 por 60s.**

  O objetivo aqui é conter laço automatizado, não policiar uso humano — um músico não clica trinta vezes por minuto. O `cifro_rate_limit()` guarda contagem em arquivo temporário compartilhado entre execuções, então o hook de reset descrito em "Isolamento de estado nos testes" também zera esses contadores.
- Isolamento por banda em toda operação; `salaId` continua sendo a banda da sessão.
- Perfil externo nunca hospeda: 403 em claim, request e answer.
- `pedido_nome` é uma cópia do nome no instante do pedido, não uma referência. Se a pessoa mudar o nome durante a janela de 30s, o aviso mostra o antigo. Aceito: a alternativa seria um JOIN em `usuarios` a cada polling da banda inteira, e o prejuízo é um nome desatualizado por meio minuto.
- O bloco `pedido` do `status.php` é visível a todos os membros, **inclusive perfil externo**. É deliberado: quem acompanha a live enxerga que há uma troca de comando em curso. Nenhum `usuario_id` é exposto — só o nome e o status.

## Efeito colateral declarado

Reassumir emite um `hostId` novo. A mesma pessoa em dois aparelhos terá o primeiro invalidado pelo segundo, e o primeiro ouvirá "você não é mais o host". É deliberado — uma sessão de comando por pessoa — mas é mudança observável de comportamento.

## Testes

### PHPUnit — regras, com relógio controlado

Posse: sala vazia; renovação pelo mesmo usuário; 409 para outro com lease ativo; 200 para outro com lease expirado; claim 1s antes e 1s depois da expiração; dois claims simultâneos com exatamente um vencedor; externo recebe 403 e nunca 409; isolamento entre bandas.

Pedido: pedido com host ativo; **pedido sem host recebe 400**; segundo pedido de outra pessoa recebe 409; **pedido repetido pelo mesmo usuário é idempotente e não estende a janela**; aceite seguido de claim do pedinte; aceite seguido de claim de terceiro recebe 409; negação seguida de claim recebe 409; silêncio de 30s autoriza o claim; liberação descarta pedido pendente; queda do host faz o pedinte assumir pela regra de lease; aprovação vencida não vira autorização eterna; host antigo recebe `code: nao_e_mais_host` no `update`.

Cooldown: **novo pedido durante os 30s de uma negação recebe 409**; **o mesmo pedido é aceito 1s depois de o cooldown vencer**; um pedido `pendente` já expirado não é substituído por um novo.

Limpeza: **claim aceito zera os campos de pedido** — e quem assumiu por silêncio não consegue retomar uma segunda vez sem pedir de novo. É a borda que mais me preocupa, porque sua ausência seria invisível até alguém explorar.

Vida útil do pedido: `pendente` vencido autoriza o dono; **o mesmo pedido deixa de autorizar 60s depois de vencer**; `aprovado` vencido não autoriza; pedido de terceiro sobre pedido **vivo** recebe 409 em cada um dos três status; pedido de terceiro sobre pedido **morto** é aceito e substitui a linha.

Autoria das operações: `release` por quem não é host recebe 409; `release` em sala sem host recebe 200 e não faz nada; `answer` por quem não é host recebe 409; `answer` sem pedido pendente recebe 409; `answer` sobre pedido já vencido recebe 409.

Concorrência: dois claims simultâneos sobre lease expirado produzem **exatamente um `hostId` válido**, e o perdedor recebe 409 — não 200 com `hostId` órfão. O teste precisa exercitar o caminho de banco com transação, não o de arquivo.

Tempo: `serverTime` presente em toda resposta; `update` com `hostId` inválido não renova lease. E um teste que **falha se alguma decisão de posse for tomada por comparação de data em SQL**: com a fonte de tempo adiantada em 120s e o relógio do banco parado, o lease precisa constar como expirado. Se alguém trocar a comparação para `NOW()`, este teste acusa.

Rate limit: estouro de `live.claim`, `live.request` e `live.answer` devolve 429 — e 429 não é confundido com 409 nem com 403. O reset do hook de teste zera os contadores.

### Playwright — integração real

Dois contextos, dois usuários da mesma banda, HTTP real com CSRF:

- A assume, B é recusado e vê o nome de A;
- B pede controle e A vê o aviso no polling que já faz;
- A aceita, B vira host, e A ouve "você não é mais o host" — não "Live desconectada";
- A nega e B continua fora;
- A ignora, B recebe a confirmação após a janela, e cancelar não assume;
- A libera e B assume direto;
- externo acompanha e não hospeda;
- erro de rede genérico continua exibindo "Live desconectada".

O último é a regressão mais sensível: é o comportamento que esta etapa divide em dois.

Expiração no E2E usa um hook de tempo em `public/api/testing/`, no mesmo molde de `clone-session.php`, protegido por `APP_ENV !== 'test' → 404`.

### Isolamento de estado nos testes

Esta é a parte que a primeira versão deste spec errou, e o erro merece ficar registrado.

Eu havia afirmado que os testes existentes passariam sem alteração. **Não passariam.** Os arquivos rodam em ordem alfabética com `workers: 1`, e [`23-perfis-permissoes.spec.js:281`](../../../tests/cifro/23-perfis-permissoes.spec.js) faz o perfil **básico** assumir o host — segurando o lease por 90s. Logo depois, [`28-interacoes-palco.spec.js:132`](../../../tests/cifro/28-interacoes-palco.spec.js) faz o **administrador** clicar em "Virar Host" esperando 200, e sob a regra nova receberia 409.

Com `retries: 1`, isso apareceria como "flaky" em vez de falha limpa — o modo de falhar mais caro que existe. Hoje não acontece porque a tomada é livre; passa a acontecer no instante em que ela deixa de ser.

A causa não é o teste: é **contaminação de estado entre arquivos**, que existe porque `live_state` é uma linha por banda e nada a reinicia entre cenários.

**Correção:** um hook de reset em `public/api/testing/`, no mesmo molde de `clone-session.php` e com a mesma guarda `APP_ENV !== 'test' → 404`, que zera a linha de `live_state` da banda e os contadores de rate limit. Os specs que tocam a live o chamam num `beforeEach`.

Isso **acrescenta** isolamento sem alterar nenhuma asserção existente. Ainda assim é modificação em arquivos de teste que não estavam previstos, e está declarado aqui por isso.

### Regressão

Com o isolamento acima, os 48 testes de `13-live-mode`, mais `28-interacoes-palco` e `33-presentation-mode`, passam sem alteração de asserção — a renovação pelo mesmo usuário cobre o resto.

Três testes são atualizados deliberadamente, por codificarem a tomada livre que esta etapa substitui: `23-perfis-permissoes.spec.js:281`, `63-critical-real-user-journeys.spec.js:152` e `63-critical-real-user-journeys.spec.js:214`.

## Fora de escopo

Presença de participantes, reconexão com backoff, repertório em execução e próxima música, registro de sessão. Cada um é etapa própria do LIVE-002.

Áudio/vídeo, chat, edição colaborativa e peer-to-peer seguem fora do LIVE-002 inteiro.
