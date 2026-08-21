# Estratégia de testes

## Suítes

| ID | Tipo | Local | Objetivo |
|---|---|---|---|
| T-001 | PHPUnit | `tests/php` | services, repositories, validators, segurança, privacidade, cobrança e backup |
| T-002 | Playwright setup | `tests/setup` | criar estado autenticado compartilhado |
| T-003 | Playwright principal | `tests/cifro` | páginas, APIs, segurança e jornadas do produto |
| T-004 | Playwright visual | `tests/music-layout.spec.js`, `tests/test-id165-scroll.spec.js` | layout responsivo e rolagem |
| T-005 | Playwright PWA/serial/cobertura | projetos `pwa`, `serial` e `coverage` | offline real, Ensaio, Stripe e branches instrumentados |
| T-006 | Legado fora da regressão | `tests/music/music-layout.spec.js` e cenários duplicados | compatibilidade preservada temporariamente |

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

E2E usa MySQL e servidor PHP configurado em `playwright.config.js`. O projeto `setup` persiste autenticação em `tests/.auth/`. A suíte usa um worker porque parte dos testes altera o mesmo banco. Há uma repetição automática local e no CI; resultados flaky continuam sendo dívida, não sucesso silencioso. Cobertura PHP requer Xdebug 3.5.3 em modo `coverage`; cobertura JavaScript usa Chromium real e Monocart Reporter.

Cada teste possui limite global de 90 segundos. Qualquer timeout deve ser tratado como problema de desempenho, dependência externa, estado compartilhado ou desenho do cenário antes de aumentar esse limite.

`npm run test:e2e` executa somente a regressão principal. `npm run test:e2e:full` executa, em processos isolados e sem retries, `cifro`, `serial`, `coverage`, `pwa`, `visual` e `legacy`. O isolamento renova a autenticação e o banco entre projetos, evitando que uma suíte contamine a seguinte.

## Organização

- `cifro`: comportamento funcional, API e segurança.
- `visual`: matriz de viewports canônica e regressão de rolagem.
- `setup`: autenticação única e perfis reutilizáveis.
- `serial`: fluxos reais de Ensaio, estado do Ensaio e Stripe que não podem compartilhar execução concorrente.
- `pwa`: service worker, IndexedDB, sync incremental, repertórios e jornadas críticas online/offline.
- `coverage`: matriz instrumental de branches separada da regressão funcional.
- `legacy`: segunda matriz de layout e fluxos duplicados preservados para execução manual.

`12-planos.spec.js` foi retirado da execução porque seus três cenários já existem em `20-planos.spec.js`. A segunda matriz `tests/music/music-layout.spec.js` ficou fora da regressão por duplicar a matriz canônica. O Modo Ensaio está ativo; seus fluxos reais pertencem ao projeto `serial` e os cenários duplicados permanecem no projeto `legacy`.

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
- Stripe possui cobertura E2E de sandbox; compra/cancelamento real controlado e reconciliação em produção continuam sendo gates operacionais.
- Download do YouTube depende de provedores externos e não é determinístico.
- A suíte unitária atual possui 579 testes PHP e 1482 asserções, além de 42 testes JavaScript.
- O baseline de branches está em `docs/cobertura.md`; os comandos de cobertura falham abaixo de 80%.
- Não há teste contratual automatizado que compare esta documentação com rotas e IDs de funcionalidades.

## Evidência local de 2026-08-20

- PHPUnit: 579 testes, 1482 asserções, 0 falhas.
- JavaScript unitário: 42 testes, 0 falhas.
- Playwright `cifro`: 841 testes, 0 falhas, 0 skips e 0 flakies.
- Playwright `pwa`: 58 testes, 0 falhas, sem retry.
- Playwright `serial`: 43 testes locais aprovados e 3 cenários de checkout real condicionados à configuração do Stripe.

Os resultados medidos da execução mais recente estão em [cobertura.md](cobertura.md).

O plano de evolução das métricas estruturais está em [plano para atingir 80% de cobertura de branches](plano-cobertura-branches-80.md).
## Capotraste e transposição de instrumento

| Arquivo | Cobre |
|---|---|
| `tests/php/TransposicaoInstrumentoTest.php` | faixa de −12 a 12, recusa de valor fracionário e não numérico, instrumentos e rótulos |
| `tests/php/UserConfigValidatorTest.php` | as chaves `instrumento` e `transposicaoPreferencia` salvas em `usuarios.config` |
| `tests/chords.test.js` | sugestão nos dois níveis e nos dois instrumentos, empate a favor do menor módulo, faixa do violão sem negativo, custo por deslocamento |
| `tests/cifro/74-capotraste.spec.js` | vocabulário por instrumento nas configurações, capotraste proposto na tela, pôr e tirar sem alterar o tom soante, e o tom publicado no modo ao vivo |
| `tests/php/CifraClubImportProviderTest.php` | capotraste declarado dentro e fora do `<pre>`, com a fixture `cifraclub-capo-fora-do-pre.html` |
| `tests/cifro/75-import-capotraste.spec.js` | confirmação da importação com capotraste, recusa que não transpõe, e o aviso quando o tom da página não bate com o corpo |
| `tests/php/UsuarioMusicaRepositoryTest.php` | isolamento da personalização entre músicos e entre bandas, atualização de base e cascata ao excluir a música |
| `tests/cifro/76-capotraste-pessoal.spec.js` | proteção do endpoint (CSRF, banda, faixa), gravação, presença no snapshot e persistência entre visitas |
| `tests/cifro/77-capotraste-conflito.spec.js` | detecção do conflito em três pontas, cadastro valendo enquanto pendente, e resolução nos dois sentidos |

O teste `escolha feita em outro aparelho chega pelo sync incremental` cobre um bug real encontrado por instabilidade nos testes: a personalização vive fora da revisão da banda, então o caminho incremental do sync a carregava adiante do cache e uma escolha feita em outro aparelho nunca chegava. Hoje ela viaja em toda resposta de `version.php` e `changes.php`.

`tests/setup/global.setup.js` grava instrumento e preferência para os usuários de teste. Sem isso o modal de primeiro acesso abre na home e bloqueia o clique na lista de músicas em qualquer teste que use esses usuários — só o `74-capotraste.spec.js` deve exercitar o primeiro acesso, e ele apaga a preferência de propósito.

O spec de ponta a ponta altera a preferência do usuário compartilhado. Como o projeto roda com `workers: 1`, isso não colide com os demais specs, mas evite paralelizar este arquivo.

## Central de Ajuda

- `tests/php/HelpCenterServiceTest.php` valida a integridade do catálogo e glossário.
- `tests/php/BootstrapHelpersTest.php` valida a flag global e a preferência da conta.
- `tests/cifro/64-help-center.spec.js` exercita busca, todos os filtros e guias por toque no celular, drawer responsivo, APIs e persistência real em `usuarios.config`.
- `tests/cifro/65-help-center-offline.spec.js` recarrega a Central sem rede a partir do cache real do service worker.

## Google OAuth

- `tests/cifro/35-google-auth.spec.js` valida redirecionamento e persistência real em `app_error_logs` para state inválido, código ausente, cancelamento e falha na autenticação, sem persistir `state`, código ou tokens.

## Convite de banda por link

| Arquivo | Cobre |
|---|---|
| `tests/php/BandaConvitePolicyTest.php` | validade (expiração, revogação), TTL de 24h e perfil `basico`, sem banco |
| `tests/php/BandaConviteRepositoryTest.php` | geração, hash do token, revogação em lote, contagem de usos e isolamento entre bandas |
| `tests/php/BandaConviteFlowTest.php` | aceite (novo membro, já membro, convite inválido, teto do plano) e `bandaAbertaParaConvite` usado pelo fluxo Google |
| `tests/php/GoogleAuthServiceTest.php` | casos novos de entrada por convite durante o cadastro via Google |
| `tests/cifro/78-convite-banda.spec.js` (27 testes) | geração e revogação do link, permissão por perfil, CSRF, a aba Membros (botão, estado, revogar), a página pública nos quatro estados (`invalido`, `visitante`, `entrar`, `ja-membro`), aceite por POST, cadastro por e-mail com convite pendente, quem já tem conta, e os limites de plano na geração e no aceite |

O aceite do convite é a única porta que cria o vínculo — register, Google e login passam todos por `BandaConviteFlow::aceitar`, então um cenário de `78-convite-banda.spec.js` cobre os três caminhos de entrada sem triplicar a regra de negócio testada.
