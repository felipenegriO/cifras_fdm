# Cobertura de branches

Data: 2026-07-21.

| Plataforma | Cobertos | Total | Cobertura | Meta | Déficit |
|---|---:|---:|---:|---:|---:|
| PHP | 1.428 | 1.693 | 84,35% | 80% | 0 |
| JavaScript | 1.622 | 2.001 | 81,05% | 80% | 0 |

PHP é medido por Xdebug 3.5.3 durante PHPUnit e fluxos Playwright reais. JavaScript é medido pelo V8/Monocart durante ações reais em Chromium, incluindo fontes ativas não executadas e o service worker instrumentado no contexto real do worker. Em 2026-07-21 o escopo ampliado com views, entrypoints com decisão e módulos Ensaio permanece acima do gate de 80% em PHP e JavaScript.

Relatórios processáveis: `coverage/php/branch-summary.json` e `coverage/js/coverage-summary.json`.
