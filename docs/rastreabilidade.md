# Matriz de rastreabilidade

| Funcionalidades | Testes principais | Situação |
|---|---|---|
| F-001 a F-005 | `01-public`, `10-seguranca`, `14-senha-reset`, `19-landing-page`, `24-onboarding` | Cobertura E2E ampla |
| F-006 a F-010 | `05-config`, `06-usuarios`, `07-bandas`, `15-select-banda`, `16-config-api`, `21`, `22`, `23` | Cobertura E2E ampla |
| F-011 a F-014 | `02-home-cifras`, `03-music-view`, `04-editor-musicas`, `18-edge-cases`, layout e scroll | Cobertura ampla; parser sem suíte unitária dedicada |
| F-015 a F-018 | `04-editor-musicas`, `08-roteiro`, `22-multiband-flow` | Cobertura parcial de UI dos editores |
| F-019 a F-021 | `09-sync-api`, `13-live-mode`, `22`, `23` | Cobertura de API; sincronização visual multi-browser é limitada |
| F-022 a F-024 | suítes `rehearsal*`, `e2e-rehearsal*`, `17-download-yt` | Boa cobertura local; dependência externa instável |
| F-025 e F-026 | `08-roteiro`, `09-sync-api`, `26-offline-sync`, `30-service-worker-coverage` | Cobertura PWA real |
| F-027 e F-028 | `12-planos`, `20-planos`, `21`, `22`, `24` | Cobertura de regras e webhook simulado |
| F-029 | `10-seguranca`, `18-edge-cases`, `23-perfis-permissoes` | Cobertura ampla de HTTP e papéis |
| F-030 | `25-categorias` | CRUD, exibição e invalidação do cache cobertos |

## Critério para declarar 100%

“100% documentado” significa que toda funcionalidade pública ou interna relevante aparece no catálogo e possui fonte de código, regra e teste/lacuna associados. Não significa 100% de cobertura de linhas ou ausência de defeitos.

Ao adicionar rota, tabela, ação de API ou fluxo de interface, inclua um novo `F-XXX` ou associe-o explicitamente a um ID existente.

Consulte [cobertura.md](cobertura.md) para os percentuais e falhas da última execução.
