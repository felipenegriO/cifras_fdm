# Estratégia de testes

## Suítes

| ID | Tipo | Local | Objetivo |
|---|---|---|---|
| T-001 | PHPUnit | `tests/php` | AuthService, UserRepository e Validator |
| T-002 | Playwright setup | `tests/setup` | criar estado autenticado compartilhado |
| T-003 | Playwright principal | `tests/cifro` | páginas, APIs, segurança e jornadas do produto |
| T-004 | Playwright visual | `tests/music-layout.spec.js`, `tests/test-id165-scroll.spec.js` | layout responsivo e rolagem |
| T-005 | Legado fora da regressão | suítes antigas de ensaio e `tests/music/music-layout.spec.js` | cenários desativados ou duplicados preservados temporariamente |

## Execução

```powershell
npm run test:unit
npm run test:e2e:smoke
npm run test:e2e
npm run test:e2e:visual
npm run test:e2e:full
npm run test:e2e:legacy
npm run test:coverage:php
npm run test:coverage:js
npm run test:coverage
```

E2E usa MySQL e servidor PHP configurado em `playwright.config.js`. O projeto `setup` persiste autenticação em `tests/.auth/`. A suíte usa um worker porque parte dos testes altera o mesmo banco. Repetição automática ocorre apenas em CI. Cobertura PHP requer Xdebug 3.5.3 em modo `coverage`; cobertura JavaScript usa Chromium real e Monocart Reporter.

Cada teste possui limite global de 60 segundos, sem exceções locais. Qualquer timeout deve ser tratado como problema de desempenho, dependência externa, estado compartilhado ou desenho do cenário antes de aumentar esse limite.

`npm run test:e2e` executa somente a regressão principal. `npm run test:e2e:full` reúne a suíte principal e os testes visuais mantidos. O projeto `legacy` não participa da regressão normal.

## Organização

- `cifro`: comportamento funcional, API e segurança.
- `visual`: matriz de viewports canônica e regressão de rolagem.
- `setup`: autenticação única e perfis reutilizáveis.
- `legacy`: suítes de ensaio referentes a uma interface atualmente desativada, segunda matriz de layout e fluxo monolítico; execução manual.

`12-planos.spec.js` foi retirado da execução porque seus três cenários já existem em `20-planos.spec.js`. A segunda matriz `tests/music/music-layout.spec.js` ficou fora da regressão por duplicar a matriz canônica. As suítes de ensaio foram classificadas como legado porque testam `#btnAtivarEnsaio`, elemento atualmente comentado na view.

## Regra de cobertura por mudança

| Mudança | Teste mínimo |
|---|---|
| Regra de service/repository | PHPUnit |
| Página ou fluxo de usuário | Playwright |
| API | sucesso, método inválido, sem auth, sem CSRF, permissão e validação |
| Dado por banda | isolamento entre duas bandas |
| Limite de plano | abaixo, no limite e acima |
| Conteúdo de usuário | XSS, caracteres especiais e boundary |
| Offline | online, cache existente, cache vazio e reconexão |
| Live | host, follower, básico bloqueado, troca de página, rolagem e desconexão |

## Lacunas atuais

- O projeto `pwa` executa service worker e IndexedDB reais, inclusive modo avião, rede lenta, duas bandas, atualização interrompida e sessão expirada.
- Webhook é testado como endpoint e por eventos simulados, não contra Stripe real.
- Download do YouTube depende de provedores externos e não é determinístico.
- Cobertura PHPUnit é pequena em relação aos repositories e services existentes.
- O baseline de branches está em `docs/cobertura.md`; os comandos de cobertura falham abaixo de 80%.
- Não há teste contratual automatizado que compare esta documentação com rotas e IDs de funcionalidades.

Os resultados medidos da execução mais recente estão em [cobertura.md](cobertura.md).

O plano de evolução das métricas estruturais está em [plano para atingir 80% de cobertura de branches](plano-cobertura-branches-80.md).
