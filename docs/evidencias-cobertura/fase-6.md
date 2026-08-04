# Evidência da fase 6

Status: concluída para a meta global de 80%

Data: 2026-07-14

## Escopo executado

- PHP: services, repositories, controllers, APIs e backend ativos.
- JavaScript: fontes autorais ativas e `service-worker.js`.
- Testes reais: MySQL, filesystem, sessão, Chromium, cliques, formulários, IndexedDB, offline, Live com dois contextos e service worker via CDP.

## Etapas e resultados

| Etapa | Resultado | Status |
|---|---|---|
| Gate PHP | 1.060/1.321 branches, 80,24% | concluída |
| Gate JavaScript | 1.259/1.544 branches, 81,54% | concluída |
| PHPUnit | 66 testes, 277 assertivas, 0 falhas, 2,818 s | concluída |
| JavaScript unitário | 6 testes, 0 falhas, 0,126 s | concluída |
| Playwright completo | 433 aprovados, 1 ignorado, 0 falhas, 4 min 35 s | concluída |
| Estabilidade JavaScript | três regressões completas consecutivas sem falha e denominador estável em 1.544 | concluída |

## Problemas e correções

| Problema | Correção | Confirmação |
|---|---|---|
| Música visual dependia de registro que podia ser removido por outra suíte | passou a usar a prévia real do editor em `sessionStorage` | teste visual aprovado em menos de 1 s |
| Testes responsivos aguardavam controles fora da viewport | ativação do painel correto e eventos reais nos controles ocultos por breakpoint | casos revisados passaram entre 1 e 7 s |
| Cifra composta apenas por espaços podia ser salva | validação passou a remover tags, espaços e entidades antes de aceitar conteúdo | cenário de editor rejeita cifra vazia |
| Cobertura do service worker não era coletada pela página | Chromium real adicional com CDP anexado ao target `service_worker` | instalação, cache, mensagens e offline aprovados |
| Live perdia estado por diferença de timezone | timestamps persistidos e normalizados em UTC | líder e seguidor reais aprovados |

## Artefatos

- `coverage/php/branch-summary.json`
- `coverage/js/coverage-summary.json`
- `coverage/js/index.html`
- `playwright-report/coverage.html`

## Decisão de saída

- [x] PHP global com no mínimo 80% de branches.
- [x] JavaScript global com no mínimo 80% de branches.
- [x] Arquivos não executados permanecem no denominador.
- [x] PHPUnit, testes JavaScript e Playwright sem falhas.
- [x] Nenhum teste individual ultrapassa um minuto.
- [x] Relatórios e documentação atualizados.

Pisos por arquivo crítico, publicação no CI e a auditoria permanente permanecem como controles adicionais do runbook e não alteram a aprovação dos dois gates globais solicitados.
