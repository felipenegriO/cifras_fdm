# Runbook para atingir 80% de cobertura de branches

## 1. Objetivo

Atingir e manter, separadamente:

- **80% ou mais de cobertura de branches PHP**;
- **80% ou mais de cobertura de branches JavaScript**;
- **70% ou mais em cada arquivo crítico**;
- **80% ou mais nos branches de código novo ou alterado**.

O ponto de partida documentado media somente linhas PHP de services e repositories. A medição oficial atual usa branches PHP e JavaScript no escopo integral definido abaixo. Nenhuma porcentagem de linhas, métodos, testes aprovados ou funcionalidades documentadas pode ser usada como substituta da cobertura de branches.

## Status de execução em 2026-07-14

| Etapa | Status | Evidência atual |
|---|---|---|
| Baseline e instrumentação | concluída | Xdebug e V8/Monocart incluem fontes não executadas |
| Base PHP e integrações reais | concluída | PHPUnit com banco, filesystem, sessão e controllers reais |
| Gate PHP de 80% | concluída | 1.060/1.321 branches, 80,24% |
| Base JavaScript e fluxos reais | concluída | Playwright usa Chromium, cliques, dois contextos, IndexedDB, offline e Live |
| Gate JavaScript de 80% | concluída | 1.259/1.544 branches, 81,54% |
| Regressão final e documentação | reaberta após ampliação de escopo | recalcular PHP e JavaScript, cobrir views, entrypoints e Ensaio |

Regra de retomada: preservar os gates globais aprovados e tratar como trabalho adicional apenas os pisos por arquivo, CI e auditorias permanentes ainda não comprovados.

## 2. Resultado esperado

Ao final deste runbook, uma instalação limpa deve conseguir:

1. instalar as dependências;
2. preparar o ambiente de teste;
3. executar testes PHP e JavaScript;
4. gerar relatórios de branches incluindo arquivos não executados;
5. falhar automaticamente se PHP ou JavaScript ficar abaixo de 80%;
6. publicar evidências que permitam reproduzir o resultado;
7. executar a regressão PHPUnit e Playwright sem falhas.

## 3. Escopo oficial

### 3.1 PHP incluído

- `public/src/Services/**/*.php`
- `public/src/Repositories/**/*.php`
- `public/src/Controllers/**/*.php`
- `public/api/**/*.php`
- `public/src/backend/**/*.php`
- `public/src/Views/**/*.php`;
- `public/login.php`, `public/register.php`, `public/plano.php`, `public/reset-senha.php`, `public/definir-senha.php`, `public/select-banda.php`, `public/offline.php`, `public/music.php` e `public/roteiro.php`.

### 3.2 PHP excluído

- arquivos de configuração e bootstrap;
- templates sem decisão de negócio;
- migrações e scripts operacionais;
- dependências, arquivos gerados e caches.

Um entrypoint que contenha validação, condição, autorização, transformação ou tratamento de erro não pode ser excluído. Sua lógica deve ser extraída para uma unidade testável e incluída no relatório.

### 3.3 JavaScript incluído

- código autoral ativo em `public/src/js/**/*.js`;
- `public/service-worker.js`.

### 3.4 JavaScript excluído

- arquivos `*.min.js`;
- Bootstrap, jQuery, TinyMCE, Wavesurfer e SoundTouch;
- dependências, bundles de terceiros e código gerado;
- os arquivos de dados estáticos `musicas.js`, `playlists_salvas.js` e `roteiros_salvos.js`; a auditoria confirmou que eles só declaram coleções, sem lógica executável.

### 3.5 Regra para exclusões

Uma exclusão só é válida quando:

1. identifica caminho e motivo;
2. comprova que o arquivo não contém regra de negócio ativa;
3. é registrada no relatório da fase;
4. não remove branches já pertencentes ao denominador aprovado;
5. passa por revisão antes da conclusão da fase.

Comentários de exclusão de cobertura não podem ser usados para alcançar o percentual.

## 4. Ferramentas definidas

### 4.1 PHP

- PHPUnit 9.6, já adotado pelo projeto;
- Xdebug em modo `coverage` para branches e paths;
- relatórios texto, HTML e formato processável pelo gate;
- MySQL isolado para testes de integração de repositories.

PHPDBG pode continuar sendo usado para linhas, mas não é a fonte oficial de branches deste plano.

### 4.2 JavaScript

- `node:test`, já usado em `tests/chords.test.js`;
- Playwright em Chromium real para ações de usuário, DOM, rede, IndexedDB, áudio, Wake Lock e service worker;
- Monocart Reporter para consolidar a cobertura V8 de branches por arquivo e incluir fontes não executados;
- testes estruturais adicionais somente quando exercitarem a página real; doubles não contam para a meta oficial.

### 4.3 Artefatos padronizados

- `coverage/php/`: relatórios PHP;
- `coverage/js/`: relatórios JavaScript;
- `docs/evidencias-cobertura/fase-N.md`: evidência de cada fase;
- `docs/cobertura.md`: medição consolidada mais recente.

## 5. Protocolo obrigatório de execução

### 5.1 Máquina de estados

Cada fase possui somente os estados:

`não iniciada → em execução → bloqueada ou concluída`

Uma fase só pode ser marcada como concluída quando todos os critérios de saída forem comprovados. A próxima fase não pode começar enquanto a anterior estiver bloqueada ou em execução.

### 5.2 Ciclo obrigatório de cada etapa

Para cada etapa numerada:

1. **Preparar**: confirmar pré-requisitos e estado do repositório.
2. **Executar**: realizar somente a mudança prevista na etapa.
3. **Testar**: executar a validação específica e a regressão afetada.
4. **Comparar**: confrontar resultado esperado e resultado obtido.
5. **Corrigir**: se houver falha, diagnosticar a causa raiz, corrigir e voltar ao passo 3.
6. **Documentar**: registrar comandos, resultados, mudanças, problemas e correções.
7. **Aprovar**: marcar a etapa como concluída somente após todos os critérios passarem.

Não é permitido acumular falhas para uma fase posterior.

### 5.3 Classificação e correção de problemas

| Tipo | Tratamento obrigatório |
|---|---|
| Ambiente | corrigir instalação, versão, extensão, permissão ou configuração; repetir desde a preparação |
| Teste incorreto | corrigir arrange, ação ou assertiva sem enfraquecer o comportamento esperado |
| Teste instável | remover dependência de tempo, rede, ordem ou estado compartilhado; executar repetidamente |
| Defeito no produto | criar teste de reprodução, corrigir preservando a regra documentada e executar regressão |
| Código não testável | criar seam ou extrair unidade testável com teste de caracterização antes da refatoração |
| Instrumentação incorreta | corrigir include, exclude, source map ou coletor; invalidar medições anteriores afetadas |
| Meta não atingida | localizar branches ausentes, acrescentar casos com assertivas e medir novamente |

É proibido resolver falhas reduzindo thresholds, removendo arquivos do escopo, ignorando testes, relaxando assertivas ou capturando exceções sem verificá-las.

### 5.4 Regressão proporcional

Após cada etapa, executar:

1. o teste novo ou alterado;
2. a suíte unitária da plataforma;
3. a medição de branches da plataforma;
4. a suíte do domínio afetado;
5. a regressão completa no fechamento da fase.

### 5.5 Registro obrigatório de evidência

Cada `docs/evidencias-cobertura/fase-N.md` deve conter:

```markdown
# Evidência da fase N

Status: não iniciada | em execução | bloqueada | concluída
Responsável:
Início:
Conclusão:
Commit ou estado de referência:

## Ambiente

| Item | Valor |
|---|---|
| Sistema | |
| PHP | |
| PHPUnit | |
| Xdebug | |
| Node.js | |
| npm | |
| c8 | |
| MySQL | |

## Escopo e arquivos alterados

## Etapas executadas

| Etapa | Comando ou ação | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|---|

## Problemas e correções

| Problema | Causa raiz | Correção | Teste de confirmação |
|---|---|---|---|

## Cobertura

| Plataforma | Branches cobertos | Branches totais | Percentual anterior | Percentual atual | Gate |
|---|---:|---:|---:|---:|---:|

## Regressão

| Suíte | Aprovados | Ignorados | Falhas | Duração |
|---|---:|---:|---:|---:|

## Pendências e riscos

## Decisão de saída

- [ ] Todos os critérios da fase foram atendidos.
- [ ] Não existem falhas transferidas para a próxima fase.
- [ ] Relatórios e documentação foram atualizados.
```

Saídas resumidas podem ser transcritas. Logs completos e relatórios gerados devem ser referenciados pelo caminho, sem serem adicionados ao Git quando forem artefatos temporários.

### 5.6 Regra de retomada por outra IA

Antes de continuar o plano, a IA deve:

1. ler este runbook integralmente;
2. ler `docs/cobertura.md`, `docs/testes.md` e a evidência mais recente;
3. verificar o estado do Git sem descartar mudanças existentes;
4. identificar a primeira etapa ainda não aprovada;
5. validar novamente o último gate concluído;
6. continuar exatamente nessa etapa;
7. atualizar a evidência antes de encerrar o trabalho.

Se a validação do último gate falhar, a fase deve voltar para `em execução` e ser corrigida antes de avançar.

## 6. Comandos-alvo

Estes comandos devem existir ao final da Fase 1. Se o nome precisar mudar por compatibilidade, a evidência deve registrar o comando equivalente e `docs/testes.md` deve ser atualizado.

```powershell
npm ci
composer install
npm run test:unit:php
npm run test:unit:js
npm run test:coverage:php
npm run test:coverage:js
npm run test:coverage
npm run test:e2e
npm run test:e2e:visual
```

O comando PHP pode usar o `composer` disponível no ambiente no lugar de `composer.phar`. A execução de cobertura PHP deve definir `XDEBUG_MODE=coverage`, solicitar path coverage e falhar quando o gate não for atingido.

## 7. Fase 0 — Baseline confiável

### Entrada

- Repositório acessível.
- Documentação atual disponível.
- Nenhuma fase anterior.

### Etapa 0.1 — Congelar o estado de referência

1. Registrar `git status --short` sem modificar ou descartar mudanças existentes.
2. Registrar versões de PHP, PHPUnit, Node.js, npm e MySQL.
3. Executar PHPUnit, teste JavaScript existente e regressão Playwright principal.
4. Registrar aprovações, falhas, ignorados e duração.

Validação:

- todas as suítes mantidas passam no estado de referência;
- qualquer falha preexistente é reproduzida isoladamente e corrigida antes da Etapa 0.2.

Critério de sucesso:

- estado de referência reproduzível e documentado.

### Etapa 0.2 — Produzir inventário de cobertura

1. Listar todos os arquivos incluídos e excluídos.
2. Classificar por domínio, criticidade e tipo de dependência.
3. Marcar arquivos críticos de segurança, autenticação, permissões, isolamento por banda, cobrança, sincronização, offline e Live.
4. Revisar manualmente as exclusões contra as regras da seção 3.5.

Validação:

- comparar inventário com `rg --files public`;
- confirmar que todo código autoral com decisões aparece no escopo.

Critério de sucesso:

- inventário completo anexado à evidência da fase.

### Etapa 0.3 — Habilitar medição real de branches PHP

1. Instalar Xdebug compatível com a distribuição PHP 8.0.30 usada pelo projeto.
2. Validar carregamento da extensão.
3. Validar `XDEBUG_MODE=coverage` em processo isolado.
4. Executar PHPUnit com path coverage em modo informativo.

Validação:

- o relatório contém totais de branches e paths;
- execução sem Xdebug não é aceita como baseline de branches.

Correção se falhar:

- conferir arquitetura, thread safety, versão da DLL, `php.ini` carregado e modo do Xdebug;
- repetir a etapa até o relatório apresentar branches.

### Etapa 0.4 — Gerar baseline JavaScript

1. Configurar temporariamente o coletor para incluir todos os arquivos ativos, inclusive não importados.
2. Executar o teste existente de `chords.js`.
3. Gerar relatório de branches sem threshold bloqueante.
4. Confirmar exclusões de terceiros e código legado.

Validação:

- arquivos ativos não testados aparecem com zero;
- nenhum arquivo de terceiro aparece no denominador.

### Etapa 0.5 — Consolidar o déficit

Para cada plataforma, registrar:

- branches totais;
- branches cobertos;
- percentual atual;
- branches adicionais necessários por `ceil(total × 0,80) - cobertos`;
- vinte arquivos com maior quantidade de branches não cobertos.

### Gate da Fase 0

- [x] Suítes de referência aprovadas.
- [x] Inventário revisado.
- [x] Branches PHP medidos por Xdebug.
- [x] Branches JavaScript medidos incluindo arquivos não executados.
- [x] Déficit calculado.
- [x] `docs/evidencias-cobertura/fase-0.md` concluído.
- [x] `docs/cobertura.md` atualizado.

Se qualquer item falhar, corrigir e repetir toda a medição. Somente então iniciar a Fase 1.

## 8. Fase 1 — Infraestrutura reproduzível e gates

### Entrada

- Gate da Fase 0 aprovado.

### Etapa 1.1 — Fixar dependências

1. Adicionar `monocart-reporter` como dependência de desenvolvimento.
2. Atualizar lockfile por instalação normal do gerenciador.
3. Não atualizar dependências não relacionadas.
4. Validar instalação limpa com Composer e npm.

Critério de sucesso:

- instalação limpa e testes de referência aprovados.

### Etapa 1.2 — Configurar cobertura PHP

1. Incluir todo o escopo PHP oficial.
2. Habilitar arquivos não executados e path coverage.
3. Gerar texto, HTML e artefato processável.
4. Criar verificador de threshold baseado no artefato, sem analisar texto por correspondência frágil.
5. Separar teste normal de teste com cobertura.

Validação:

- inserir temporariamente uma falha controlada do gate e confirmar exit code diferente de zero;
- remover a falha controlada e confirmar exit code zero no threshold da fase;
- conferir manualmente uma classe não executada no relatório.

### Etapa 1.3 — Configurar cobertura JavaScript

1. Manter os testes Playwright em `tests/**/*.spec.js` com a fixture de cobertura.
2. Configurar o coletor V8 com fontes não executados, includes e excludes explícitos.
3. Gerar texto, HTML e LCOV ou JSON.
4. Configurar threshold de branches no valor aprovado para a fase.

Validação:

- reduzir temporariamente o resultado abaixo do gate e confirmar falha;
- restaurar o teste e confirmar sucesso;
- conferir um arquivo não importado com zero.

### Etapa 1.4 — Padronizar comandos e artefatos

1. Criar os scripts da seção 6.
2. Separar relatórios em `coverage/php` e `coverage/js`.
3. Ignorar somente artefatos gerados.
4. Atualizar `docs/testes.md` com pré-requisitos e comandos reais.

### Etapa 1.5 — Integrar ao CI em modo informativo

1. Executar testes PHP e JavaScript em ambiente limpo.
2. Publicar os relatórios mesmo quando houver falha.
3. Registrar baseline e diferença em relação à execução anterior.
4. Repetir o job para detectar instabilidade.

Critério de estabilidade:

- três execuções consecutivas com os mesmos totais de branches e sem falhas intermitentes.

### Gate da Fase 1

- [ ] Instalação limpa aprovada.
- [ ] Comandos locais padronizados.
- [ ] Gate PHP testado em sucesso e falha.
- [ ] Gate JavaScript testado em sucesso e falha.
- [ ] Arquivos não executados contabilizados.
- [ ] Três execuções estáveis.
- [ ] `docs/evidencias-cobertura/fase-1.md` concluído.
- [ ] `docs/testes.md` atualizado.

## 9. Fase 2 — Base de testes determinística

### Entrada

- Gate da Fase 1 aprovado.

### Etapa 2.1 — Fixtures PHP

1. Criar builders mínimos para usuário, banda, plano, música, categoria, playlist e roteiro.
2. Gerar identificadores únicos por teste.
3. Executar repository tests em banco dedicado.
4. Aplicar transação e rollback por teste.

Validação:

- executar a suíte duas vezes sem limpeza manual;
- confirmar que contagens do banco antes e depois são iguais.

### Etapa 2.2 — Seams PHP

1. Identificar acesso direto a relógio, sessão, filesystem, e-mail e chamadas externas.
2. Criar pontos de substituição pequenos, preservando comportamento público.
3. Criar teste de caracterização antes de cada extração.
4. Testar sucesso e falha de cada seam.

### Etapa 2.3 — Harness JavaScript

1. Criar fábrica de DOM por teste.
2. Restaurar globals, mocks, timers e listeners no teardown.
3. Criar doubles de `fetch`, storage, IndexedDB, áudio e APIs do navegador.
4. Proibir rede e timers reais na suíte unitária.

Validação:

- executar testes em ordem normal e ordem alterada;
- executar três vezes e comparar resultados;
- detectar globals ou handles abertos após cada arquivo.

### Etapa 2.4 — Separar regras e adaptadores

1. Selecionar uma regra PHP e uma JavaScript acopladas a infraestrutura.
2. Criar testes de caracterização.
3. Extrair regra pura ou handler testável.
4. Manter entrypoint e adaptador finos.
5. Executar teste unitário, teste do domínio e Playwright relacionado.

Critério de sucesso:

- padrão comprovado nas duas plataformas sem regressão.

### Gate da Fase 2

- [ ] Banco retorna ao estado inicial após os testes.
- [ ] Suíte JavaScript não usa rede ou tempo real.
- [ ] Três execuções consecutivas estáveis.
- [ ] Refatorações de prova cobertas antes e depois.
- [ ] Totais de branches não diminuíram por exclusão.
- [ ] `docs/evidencias-cobertura/fase-2.md` concluído.

## 10. Fase 3 — PHP até 50%

### Entrada

- Gate da Fase 2 aprovado.
- Cobertura JavaScript não pode regredir em relação ao baseline consolidado.

### Etapa 3.1 — `LiveStateService`

Cobrir host e follower, versão, página, rolagem, expiração, permissão, entrada inválida, estado ausente e falha de persistência.

Sucesso:

- branches críticos identificados no relatório estão cobertos;
- assertivas verificam estado e efeitos, não apenas ausência de exceção.

### Etapa 3.2 — `UserRepository`

Cobrir autenticação, perfis, bandas, limites de plano, resultado vazio, duplicidade, isolamento e exceções de banco.

### Etapa 3.3 — `MailService`

Cobrir configuração válida e inválida, conteúdo, sucesso, falha do transporte e exceção, sem enviar e-mail real.

### Etapa 3.4 — Repositories por domínio

Executar na ordem:

1. `LiveStateRepository`;
2. `BandaRepository`;
3. `CategoriaRepository`;
4. `MusicaRepository`;
5. `PlaylistRepository`;
6. `RoteiroRepository`;
7. `SyncRevisionRepository`.

Para cada repository, cobrir CRUD aplicável, vazio, conflito, isolamento por banda, commit, rollback e erro.

### Etapa 3.5 — Lacunas existentes

Completar branches de `AuthService`, `Validator` e `Database` e revisar testes que executam código sem assertivas relevantes.

### Validação de cada etapa da Fase 3

1. executar o arquivo de teste isolado;
2. executar PHPUnit completo;
3. executar cobertura PHP;
4. conferir branches do componente no HTML;
5. executar Playwright do domínio afetado;
6. corrigir qualquer falha e repetir os cinco itens;
7. registrar a variação na evidência.

### Gate da Fase 3

- [ ] PHP com pelo menos 50% de branches no escopo completo.
- [ ] JavaScript sem regressão.
- [ ] Nenhuma alteração persistida no banco ou filesystem.
- [ ] PHPUnit e Playwright dos domínios afetados aprovados.
- [ ] Três execuções PHP consecutivas estáveis.
- [ ] `docs/evidencias-cobertura/fase-3.md` concluído.
- [ ] Threshold PHP de 50% ativado no CI.

## 11. Fase 4 — JavaScript até 50%

### Entrada

- Gate da Fase 3 aprovado.
- PHP deve permanecer em pelo menos 50%.

### Etapa 4.1 — Regras puras e utilitários

Cobrir `chords.js`, `cifro-csrf.js`, `cifro-theme.js`, `cifro-presentation.js`, `cifro-confirm.js` e `cifro-toast.js`.

### Etapa 4.2 — Estado e contratos

Cobrir `cifro-sync.js`, `live.js`, parsing, normalização, sucesso HTTP, resposta vazia, resposta inválida, erro, timeout e cancelamento.

### Etapa 4.3 — Formulários e edição

Cobrir `categorias.js`, `editor.js`, `roteiros.js`, `playlists.js`, `playlists_salvas.js` e seus eventos, validações e falhas.

### Etapa 4.4 — Música e palco

Cobrir `music-view.js`, `musicas.js` e `script.js`, incluindo DOM ausente, valores-limite, teclas, rolagem e APIs indisponíveis.

### Matriz mínima por decisão

Para cada `if`, operador lógico, ternário, fallback ou tratamento de erro aplicável, testar:

- caminho verdadeiro;
- caminho falso;
- valor mínimo;
- valor máximo ou limite;
- `null`, vazio ou ausente quando aceito;
- sucesso assíncrono;
- rejeição ou exceção.

### Validação de cada etapa da Fase 4

1. executar o arquivo de teste isolado;
2. executar todos os testes JavaScript;
3. executar cobertura JavaScript;
4. conferir branches do arquivo no HTML;
5. executar Playwright do fluxo afetado;
6. repetir o teste três vezes quando usar eventos, timers ou promises;
7. corrigir qualquer falha e repetir todos os itens.

### Gate da Fase 4

- [ ] JavaScript com pelo menos 50% de branches no escopo completo.
- [ ] PHP permanece em pelo menos 50%.
- [ ] Nenhum teste usa servidor PHP, rede ou tempo real sem necessidade explícita.
- [ ] Playwright dos fluxos afetados aprovado.
- [ ] Três execuções JavaScript consecutivas estáveis.
- [ ] `docs/evidencias-cobertura/fase-4.md` concluído.
- [ ] Threshold JavaScript de 50% ativado no CI.

## 12. Fase 5 — Integrações, offline e 70%

### Entrada

- Gate da Fase 4 aprovado.
- PHP e JavaScript em pelo menos 50%.

### Etapa 5.1 — Controllers e handlers PHP

Para cada endpoint ativo, cobrir método aceito e rejeitado, autenticação, CSRF, permissão, validação, sucesso, conflito e exceção interna.

### Etapa 5.2 — Regras transacionais PHP

Cobrir commit, rollback, deadlock ou erro simulado, conflito de revisão, concorrência, isolamento entre bandas e limites de plano abaixo, no limite e acima.

### Etapa 5.3 — Offline JavaScript

Cobrir `offline-tools.js`, `cifro-sync.js` e `service-worker.js` para instalação, ativação, cache existente, cache vazio, atualização, falha parcial, modo offline e recuperação.

### Etapa 5.4 — Concorrência JavaScript

Cobrir respostas lentas, abortadas, duplicadas e fora de ordem; timers; reconexão; mudança de visibilidade; Wake Lock ausente; storage cheio e IndexedDB com erro.

### Etapa 5.5 — Confirmação E2E

Relacionar branches críticos aos cenários Playwright de segurança, sincronização, offline, Live, planos e múltiplas bandas. Criar cenário E2E apenas quando o branch depender de integração real; regras isoláveis permanecem unitárias.

### Validação da fase

1. executar suites unitárias PHP e JavaScript;
2. executar ambas as coberturas;
3. executar Playwright principal e visual;
4. repetir cenários assíncronos três vezes;
5. confirmar ausência de resíduos no banco, filesystem, caches e globals;
6. corrigir e reiniciar a validação completa se qualquer item falhar.

### Gate da Fase 5

- [ ] PHP com pelo menos 70% de branches.
- [ ] JavaScript com pelo menos 70% de branches.
- [ ] Fluxos críticos cobertos no nível adequado.
- [ ] PHPUnit, testes JavaScript e Playwright aprovados.
- [ ] Três execuções completas consecutivas estáveis.
- [ ] `docs/evidencias-cobertura/fase-5.md` concluído.
- [ ] Thresholds de 70% ativados no CI.

## 13. Fase 6 — Fechamento em 80%

### Entrada

- Gate da Fase 5 aprovado.
- PHP e JavaScript em pelo menos 70%.

### Etapa 6.1 — Recalcular o déficit

1. gerar relatórios limpos;
2. recalcular branches necessários para 80%;
3. ordenar arquivos por branches ausentes, risco e frequência;
4. priorizar segurança, isolamento, cobrança, sincronização, offline e Live.

### Etapa 6.2 — Fechar branches PHP

Para cada branch selecionado:

1. confirmar que é alcançável;
2. criar teste com assertiva de resultado ou efeito;
3. executar teste isolado e cobertura completa;
4. corrigir falhas;
5. registrar branches antes e depois.

Branch comprovadamente inalcançável deve ser removido por refatoração segura, com teste de caracterização e regressão, não ignorado.

### Etapa 6.3 — Fechar branches JavaScript

Aplicar o mesmo ciclo, incluindo restauração de DOM, globals, timers e mocks. Branch dependente exclusivamente de navegador deve ter teste em ambiente de navegador ou extração segura da decisão.

### Etapa 6.4 — Piso de arquivos críticos

1. listar arquivos críticos abaixo de 70%;
2. cobrir os branches de maior risco;
3. medir novamente;
4. não usar a média global para ocultar arquivo crítico abaixo do piso.

### Etapa 6.5 — Auditoria contra manipulação da métrica

Revisar:

- includes e excludes;
- arquivos sem assertivas;
- testes que apenas importam módulos;
- branches removidos do denominador;
- condicionais alteradas sem teste de caracterização;
- comentários de ignore;
- mocks que impedem a regra testada de executar.

### Etapa 6.6 — Regressão final

Executar, nesta ordem:

1. instalação limpa;
2. PHPUnit;
3. testes JavaScript;
4. cobertura PHP;
5. cobertura JavaScript;
6. Playwright principal;
7. Playwright visual;
8. repetir a sequência completa mais duas vezes.

Se qualquer execução falhar ou mudar o denominador sem explicação, corrigir e reiniciar as três execuções desde o item 1.

### Gate da Fase 6

- [ ] PHP com no mínimo 80% de branches.
- [ ] JavaScript com no mínimo 80% de branches.
- [ ] Cada arquivo crítico com no mínimo 70%.
- [ ] Código novo ou alterado com no mínimo 80%.
- [ ] Auditoria de escopo aprovada.
- [ ] Três regressões completas consecutivas aprovadas.
- [ ] `docs/evidencias-cobertura/fase-6.md` concluído.
- [ ] `docs/cobertura.md`, `docs/testes.md` e `docs/rastreabilidade.md` atualizados.
- [ ] Gates finais de 80% ativados no CI.

## 14. Fase 7 — Manutenção contínua

### Entrada

- Gate da Fase 6 aprovado.

### Etapa 7.1 — Proteção de mudanças

1. bloquear CI abaixo de 80% em qualquer plataforma;
2. bloquear redução da cobertura consolidada;
3. exigir 80% nos branches alterados;
4. publicar relatório por arquivo em toda mudança.

### Etapa 7.2 — Tratamento de regressão

Quando a cobertura cair:

1. identificar arquivo e branches responsáveis;
2. classificar mudança de denominador ou perda de execução;
3. criar ou corrigir testes;
4. executar cobertura e regressão;
5. documentar a causa;
6. liberar somente após restaurar todos os gates.

### Etapa 7.3 — Revisão periódica

Trimestralmente:

1. revisar exclusões e código legado;
2. revisar testes lentos ou instáveis;
3. confirmar versões e compatibilidade das ferramentas;
4. remover doubles que não representam mais contratos reais;
5. atualizar baseline, comandos e documentação;
6. executar a regressão completa três vezes.

### Gate permanente

- [ ] PHP permanece em pelo menos 80%.
- [ ] JavaScript permanece em pelo menos 80%.
- [ ] Arquivos críticos permanecem em pelo menos 70%.
- [ ] Nenhuma redução ou exclusão sem justificativa.
- [ ] Evidência da revisão periódica registrada.

## 15. Progressão imutável dos gates

| Marco aprovado | PHP | JavaScript | Próxima fase permitida |
|---|---:|---:|---|
| Fase 0 | baseline | baseline | Fase 1 |
| Fase 1 | baseline estável | baseline estável | Fase 2 |
| Fase 2 | sem regressão | sem regressão | Fase 3 |
| Fase 3 | 50% | sem regressão | Fase 4 |
| Fase 4 | 50% | 50% | Fase 5 |
| Fase 5 | 70% | 70% | Fase 6 |
| Fase 6 | 80% | 80% | Fase 7 |
| Fase 7 | ≥ 80% | ≥ 80% | manutenção |

O gate nunca pode ser reduzido. Durante uma fase, o mínimo efetivo é o maior valor entre o gate anterior e o melhor percentual consolidado já aprovado.

## 16. Definição final de pronto

- [ ] Escopo completo, estável e auditável.
- [ ] Relatórios incluem arquivos não executados.
- [ ] PHP e JavaScript atingem separadamente 80% de branches.
- [ ] Arquivos críticos atingem 70%.
- [ ] Código novo ou alterado atinge 80%.
- [ ] Gates falham corretamente abaixo dos limites.
- [ ] Testes são determinísticos e reproduzíveis.
- [ ] Três regressões completas consecutivas passam.
- [ ] Nenhuma regra de negócio foi alterada para melhorar cobertura.
- [ ] Nenhuma falha foi transferida entre fases.
- [ ] Todas as fases possuem evidência suficiente para retomada por outra pessoa ou IA.

## 17. Referências técnicas

- [Cobertura de código no PHPUnit 9.6](https://docs.phpunit.de/en/9.6/code-coverage-analysis.html)
- [Configuração do PHPUnit 9.6](https://docs.phpunit.de/en/9.6/configuration.html)
- [Documentação do Xdebug](https://xdebug.org/docs/code_coverage)
- [Documentação do c8](https://github.com/bcoe/c8)
- [Test runner do Node.js](https://nodejs.org/api/test.html)
