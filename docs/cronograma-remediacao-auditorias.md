# Cronograma completo de remediação das auditorias — Cifrô

Data-base: 2026-08-03  
Horizonte: 14 semanas  
Origem: auditoria de prontidão para produção e segunda auditoria de UX/layout  
Objetivo: encerrar todos os P1, P2, UX-1 e UX-2; implementar os P3/UX-3; preparar P4/UX-4 com critérios verificáveis.

## 1. Avaliação do documento de auditoria

O relatório contém duas avaliações complementares:

- prontidão de produto, segurança, privacidade, confiabilidade e operação;
- experiência, conteúdo, acessibilidade, responsividade e layout.

O diagnóstico é coerente: o Cifrô tem proposta clara, conjunto funcional relevante e bons testes unitários/PWA, mas ainda não deve receber clientes em produção aberta. Os riscos concentram-se em quatro frentes:

1. segurança, privacidade e operação sem evidência suficiente;
2. regressão completa lenta e ambiente E2E contaminado;
3. experiência inicial sem onboarding e linguagem inconsistente;
4. layouts internos móveis não cobertos pela suíte visual.

O trabalho deve ocorrer em ordem de risco. Correções visuais não podem preceder isolamento de dados, segurança e estabilização dos testes quando disputarem a mesma capacidade.

## 2. Premissas de capacidade

Equipe de referência:

- Engenharia A: backend, segurança, banco e integrações;
- Engenharia B: frontend, PWA, UX e acessibilidade;
- Produto/UX: 50% de dedicação;
- QA: função compartilhada entre engenharia e Produto;
- apoios pontuais: DevOps, Segurança e Jurídico.

Regras de execução:

- mudanças em lotes pequenos e reversíveis;
- nenhuma mudança funcional sem teste correspondente;
- todo item concluído precisa de evidência anexada;
- P0 interrompe o cronograma;
- P1 e UX-1 bloqueiam beta;
- P2 e UX-2 bloqueiam produção aberta;
- cada semana termina com regressão do escopo alterado.

## 3. Marcos e gates

| Marco | Prazo | Condição obrigatória |
|---|---:|---|
| M0 — Baseline confiável | fim da semana 1 | backlog rastreável, banco E2E isolado e smoke reproduzível |
| M1 — Segurança mínima | fim da semana 3 | segredos tratados, debug removido, sessão/tokens endurecidos e isolamento testado |
| M2 — Operação recuperável | fim da semana 5 | backup restaurado, health/logs/alertas e runbooks exercitados |
| M3 — Core UX utilizável | fim da semana 7 | Setlists/plano mobile corrigidos, onboarding e linguagem principal padronizada |
| M4 — Offline e integrações confiáveis | fim da semana 10 | autenticação offline, snapshots versionados, Ensaio/SMTP/Stripe em sandbox |
| M5 — Qualidade de lançamento | fim da semana 12 | regressão completa <10 min, acessibilidade e carga dentro das metas |
| M6 — Beta aprovado | fim da semana 13 | sete dias sem P0/P1/UX-1 e tarefas essenciais ≥98% |
| M7 — Reauditoria | fim da semana 14 | checklist completo, rollback testado e parecer atualizado |

## 4. Cronograma semanal detalhado

## Semana 1 — Governança, isolamento E2E e baseline

Status em 2026-08-03: implementada a base técnica. O E2E agora exige banco exclusivo (`E2E_DB_NAME`), credenciais explícitas, usuários por execução e limpeza determinística; o pipeline ganhou varredura de segredos e auditoria de dependências. A medição integral e a limpeza do ambiente de demonstração dependem de um banco E2E provisionado e das credenciais externas.

### Engenharia

- Criar IDs rastreáveis para todos os achados: P1-01 a P1-04, P2-01 a P2-06, P3/P4 e UX-1/UX-2/UX-3/UX-4.
- Separar banco de testes do ambiente usado para demonstração/auditoria.
- Fazer cada suíte provisionar dados com namespace único e limpeza determinística.
- Remover dependência dos padrões `felipe@legacy.invalid` e senha `123`.
- Criar seed mínimo realista para desenvolvimento, sem nomes `__TESTE_*`, scripts literais ou contadores impossíveis.
- Registrar duração atual de PHPUnit, unitários JS, smoke, E2E, PWA e visual.
- Criar secret scan e auditoria de dependências no pipeline.

### Produto/UX

- Consolidar vocabulário: “repertório” como termo principal; “setlist” apenas como explicação secundária.
- Definir tarefa de ativação: abrir/criar a primeira cifra e transpô-la.
- Aprovar inventário das telas e jornadas que entrarão na matriz visual.

### Aceite

- Nenhuma fixture aparece no ambiente de demonstração.
- Smoke executa duas vezes seguidas sem criar resíduos.
- Cada achado possui responsável, dependência, teste e evidência esperada.

## Semana 2 — Segredos, autenticação e sessão

Status em 2026-08-03: concluídas as mudanças de código. Debug de autenticação removido; redirects locais validados; scripts operacionais bloqueados via web e em produção; ambiente validado; senhas elevadas a 12 caracteres com verificador desacoplado; tokens armazenados por hash, revogados e consumidos atomicamente; sessão regenerada no login e na seleção de banda; cookies `SameSite=Strict`. A rotação efetiva dos segredos permanece como ação externa de DevOps.

### Engenharia A

- Remover `?debug=1`, `?debug=2`, `buildPasswordDebug()` e qualquer saída de hash/autenticação.
- Bloquear scripts de setup/migração em `APP_ENV=production` e remover chaves fixas.
- Migrar configuração para variáveis validadas; falhar de forma segura quando obrigatórias estiverem ausentes.
- Implementar política de senha mínima de 12 caracteres e bloqueio de senhas conhecidamente comprometidas por interface desacoplada.
- Tornar tokens de ativação/reset de uso único, com expiração, revogação após troca e armazenamento por hash.
- Regenerar sessão após login, seleção de banda e mudança de privilégio.
- Padronizar cookies como `HttpOnly`, `SameSite=Strict` e `Secure` em HTTPS.

### Apoio externo

- DevOps/Segurança: rotacionar banco, SMTP, Stripe, Google e chave de criptografia.
- Remover `prd.env` de áreas compartilhadas e confirmar secret scan do histórico.

### Aceite

- URLs de debug deixam de existir.
- Tokens reutilizados falham.
- Fixação de sessão é coberta por teste.
- Nenhum segredo válido permanece em repositório, artefatos ou workspace compartilhado.

## Semana 3 — Autorização, multi-tenant e rate limiting

Status em 2026-08-03: base de código concluída. O contexto de banda agora é validado contra o banco em cada operação protegida, o papel da sessão é atualizado pela associação persistida e associações inexistentes retornam 404. Foram removidos fallbacks de sala e administrador legado, operações por ID passaram a preservar `banda_id`, a gestão de usuários impede leitura/alteração cruzada e a importação global ficou restrita a master. Login, cadastro e recuperação usam rate limit compartilhado por ação, identidade e IP, persistente entre sessões, com backoff e log por fingerprint. PHPUnit: 331 testes e 699 asserções aprovados. A matriz E2E completa de quatro papéis e duas bandas depende do banco E2E provisionado na etapa 1.

### Engenharia A

- Centralizar banda atual e matriz de papéis.
- Revisar todas as consultas de músicas, categorias, playlists, roteiros, Live, sync e usuários.
- Filtrar leitura/escrita pelo ID do registro e `banda_id` na mesma operação SQL.
- Retornar 404 para IDs pertencentes a outra banda.
- Remover fallbacks legados que ampliem permissão.
- Aplicar ordem comum em APIs: método → autenticação → banda → papel → CSRF → payload.
- Substituir rate limit de sessão por armazenamento compartilhado, combinando ação, identidade e IP.
- Adicionar backoff e logs sem dados sensíveis.

### Testes

- Matriz de quatro papéis em todos os endpoints.
- Duas bandas, troca de IDs por URL/JSON/form e duas abas.
- Múltiplas sessões/IP para login, cadastro e recuperação.

### Aceite

- Zero leitura, escrita ou enumeração cruzada entre bandas.
- Rate limit continua ativo após nova sessão.
- Nenhum teste de autorização é ignorado.

## Semana 4 — Privacidade, contratos e tratamento de erros

Status em 2026-08-03: implementação técnica concluída. O cadastro exige aceite versionado de Termos e Privacidade, inclusive no fluxo de cadastro com Google, e registra evidência com IP protegido por HMAC. A área de Configurações permite exportar dados e excluir a conta mediante confirmação; bandas sem outros membros são eliminadas com seus dados. Foram adicionados política técnica de retenção, limpeza de tokens, contrato JSON padronizado com compatibilidade legada, `request_id`, tratamento central de exceções e mensagens públicas seguras. SMTP, Google e YouTube possuem timeouts explícitos; o webhook Stripe não realiza chamadas externas. PHPUnit: 333 testes e 709 asserções aprovados. A publicação requer aplicar a migração de privacidade pelo processo controlado de deploy e substituir os textos legais pelas versões aprovadas por Jurídico/Produto.

### Engenharia

- Implementar aceite versionado de termos e política no cadastro.
- Criar base técnica para exportação e exclusão de conta.
- Definir retenção e anonimização nos serviços e tabelas afetados.
- Criar helper de resposta JSON com `ok`, `data`, `error.code`, `error.message` e `request_id`.
- Preservar temporariamente campos legados para compatibilidade.
- Centralizar tratamento de exceção e impedir vazamento de SQL, caminhos e credenciais.
- Adicionar timeout explícito para SMTP, Stripe e YouTube.

### Apoio externo

- Jurídico/Produto: fornecer textos aprovados de termos, privacidade, retenção e cancelamento.

### Aceite

- Links legais aparecem antes da criação da conta.
- Exportação e exclusão possuem teste E2E.
- Erros internos retornam mensagem segura e `request_id` pesquisável.

## Semana 5 — Backup, observabilidade e operação

Status em 2026-08-03: implementação técnica concluída. Foram criados `/health` e `/ready`, logs JSON estruturados com `request_id`, ator e banda anonimizados, whitelist contra dados sensíveis e instrumentação de requisições, erros, login, SMTP, Stripe, sync e Live. O backup usa dump consistente, AES-256-GCM, destino obrigatório fora do projeto e retenção configurável; a restauração só aceita banco isolado com `_restore_` no nome. O monitor verifica liveness, readiness e backup em até 25 horas, podendo disparar webhook. Os runbooks cobrem banco, restauração, SMTP, Stripe, sync/Live, incidente e rollback. PHPUnit: 336 testes e 716 asserções aprovados. Para fechar o aceite operacional ainda é necessário configurar destino externo e webhook, agendar backup/monitor e executar um exercício real cronometrado de restauração e alerta.

### Engenharia/DevOps

- Criar `/health` e `/ready` sem segredos, separando aplicação e dependências.
- Implementar logs estruturados com nível, evento, `request_id`, ator anonimizado e banda.
- Proibir senha, token, cifra e dados pessoais nos logs.
- Instrumentar erros, latência, login, e-mail, webhook, sync e Live.
- Automatizar backup criptografado externo com retenção.
- Criar procedimento de restauração isolada.
- Documentar e ensaiar runbooks: banco, SMTP, Stripe, indisponibilidade, incidente e rollback.

### Aceite

- Restauração completa dentro de RPO 24 h/RTO 4 h.
- Alertas de erro, indisponibilidade e falha de backup são disparados em teste.
- Equipe consegue localizar uma falha pelo `request_id`.

## Semana 6 — Layout móvel crítico e acessibilidade básica

### Engenharia B

- Refazer o layout responsivo de Setlists como fluxo vertical em 320–430 px.
- Usar campos em largura total e cards para músicas disponíveis/adicionadas.
- Corrigir overflow de plano e configurações.
- Reduzir densidade do topnav móvel e garantir que menus não ultrapassem o viewport.
- Aumentar alvos essenciais para 44×44 px.
- Adicionar `h1` à home e corrigir hierarquia de headings.
- Associar labels ausentes em categorias e playlist.
- Corrigir `aria-modal`, foco inicial, restauração do foco e Escape em modais.

### Testes

- 320×568, 360×800, 390×844, 430×932, tablet e desktop.
- Nomes, e-mails e valores longos.
- Zoom 125%, 150% e 200%.

### Aceite

- Zero overflow horizontal nas telas internas.
- Nenhuma palavra quebrada artificialmente em Setlists.
- Controles críticos ≥44×44 px.

### Status de execução — concluída em 03/08/2026

- Setlists reorganizadas para fluxo vertical móvel, campos em largura total e cards responsivos.
- Topnav, plano e configurações ajustados para telas estreitas e alvos essenciais de 44×44 px.
- Hierarquia de títulos, labels e comportamento acessível dos modais corrigidos.
- Suíte responsiva adicionada para os seis viewports, textos longos, zoom, overflow, tamanho dos controles e foco do modal.
- Validações concluídas: sintaxe JavaScript, 6 testes unitários JavaScript e 336 testes PHPUnit (716 asserções).
- Execução visual/E2E permanece condicionada ao servidor local e ao banco E2E estarem disponíveis; o servidor não iniciou no ambiente Windows desta execução.

## Semana 7 — Onboarding, conteúdo e arquitetura da informação

### Engenharia B/Produto

- Criar onboarding opcional e retomável:
  1. criar/selecionar banda;
  2. adicionar primeira cifra;
  3. abrir e transpor.
- Criar estados vazios com exemplo e CTA único.
- Padronizar “repertório” em landing, menus, telas, mensagens e documentação.
- Traduzir Undo, Redo, Italic e Source code quando exibidos ao usuário.
- Renomear botões genéricos para a consequência concreta.
- Reescrever estados offline em formato: situação → consequência → ação.
- Separar configurações comuns de “Remover dados baixados deste dispositivo”.
- Preservar pesquisa, filtro e posição ao voltar de uma cifra.
- Alertar alterações não salvas no editor.

### Aceite

- Novo usuário chega à primeira cifra em até três minutos no teste guiado.
- Nenhum CTA crítico usa apenas “Salvar”, “Adicionar”, “Atualizar” ou “Copiar”.
- Um único termo representa repertório em toda interface.

### Status de execução — concluída em 03/08/2026

- Onboarding opcional e retomável incluído na página inicial, com banda selecionada, primeira cifra e abertura/transposição.
- Estados vazios receberam orientação objetiva e CTA único para adicionar a primeira cifra.
- Interface padronizada com o termo “repertório”, incluindo landing, navegação, planos, editor e visualização da música.
- Comandos do editor traduzidos e CTAs críticos renomeados para explicitar a ação realizada.
- Mensagens offline agora apresentam situação, consequência e próxima ação, mantendo clara a preservação da versão local.
- Pesquisa, categoria e posição da lista são restauradas ao retornar à página inicial; o editor mantém confirmação para alterações não salvas.
- Configurações comuns permanecem separadas das ações avançadas de armazenamento e remoção local.
- Validações concluídas: sintaxe JavaScript, lint das views alteradas, 6 testes unitários JavaScript e 336 testes PHPUnit (716 asserções).
- O teste guiado cronometrado e a suíte E2E dependem do servidor local e do banco E2E, indisponíveis nesta execução.

## Semana 8 — Remoção completa do legado CIFRO

### Engenharia

- Renomear arquivos `cifro-*.js` para padrão `cifro-*`.
- Renomear funções PHP, variáveis globais JS, eventos, classes CSS, IDs e documentação.
- Migrar `localStorage`, `sessionStorage`, Cache API e IndexedDB sem perda de dados.
- Subir versão do IndexedDB e copiar stores `cifro_*` para `cifro_*` em transação segura.
- Manter aliases temporários por uma versão para usuários com assets antigos.
- Remover aliases após confirmação da migração.
- Criar verificação CI que bloqueie novas ocorrências de `CIFRO`, exceto fixture explícita da migração.

### Testes

- Atualização direta da versão antiga para a nova.
- Migração interrompida e retomada.
- Dados de duas bandas e dois usuários.
- Preferências, sessão local e snapshots preservados.

### Aceite

- Busca no código ativo não encontra `CIFRO`.
- Usuário existente mantém dados offline, tema, fonte e banda selecionada.

### Status de execução — em andamento em 03/08/2026

- Os sete módulos JavaScript `cifro-*` foram renomeados para `cifro-*`, e o asset de imagem legado foi renomeado.
- Referências de carregamento no código ativo, service worker e testes foram atualizadas para os novos arquivos.
- IndexedDB foi elevado para a versão 5, com stores `cifro_*` e cópia transacional dos stores legados durante o upgrade.
- `localStorage` e `sessionStorage` copiam preferências, sessão, banda e estado de apresentação para chaves `cifro*` sem apagar os dados anteriores.
- APIs JavaScript canônicas `cifro*` foram criadas com aliases temporários para assets antigos.
- Validações concluídas: sintaxe dos módulos e service worker, 6 testes unitários JavaScript e 336 testes PHPUnit (716 asserções).
- Pendente: conversão transversal de funções PHP, variáveis globais, eventos, classes, IDs, documentação e testes, além da verificação de CI.

## Semana 9 — Offline orientado ao servidor e autenticação local

### Engenharia B/A

- Criar serviço central `CifroConnectivity` com estados `verificando`, `servidor_disponivel` e `servidor_indisponivel`.
- Considerar online apenas resposta sem cache, dentro do timeout, com JSON e identificador válidos do Cifrô.
- Tratar avião, DNS, TLS, timeout, 5xx, portal cativo e HTML inesperado como offline.
- Remover decisões baseadas exclusivamente em `navigator.onLine`.
- Servir página autenticada local por usuário quando o servidor não responder.
- Não redirecionar para landing/login por falha de rede.
- Desabilitar apenas escritas quando offline; manter consulta, pesquisa, transposição, repertório e apresentação.
- Validar sessão somente após conexão real com servidor.
- Deslogar apenas em 401/403 ou negativa autenticada inequívoca.
- Preservar snapshots até confirmação de perda de acesso.

### Aceite

- Site abre localmente autenticado em modo avião e Wi‑Fi sem internet.
- Falha 5xx ou portal cativo não causa logout.
- Reconexão válida sincroniza; sessão realmente expirada abre login com mensagem clara.

### Status de execução — concluída em 03/08/2026

- Serviço central `CifroConnectivity` criado com os três estados previstos, timeout, `no-store` e validação da identidade JSON do servidor.
- Sincronização, modo Live, preparação offline, configurações, navegação e seleção de banda passaram a usar disponibilidade real do servidor.
- Respostas 5xx, HTML inesperado, portal cativo, timeout e falha de rede preservam a versão local e não invalidam a sessão.
- Service worker passou a atender também a raiz com a página autenticada por usuário e a usar rede primeiro com fallback local nas páginas de palco.
- Login/landing vindos de resposta real do servidor e respostas 401/403 não são mascarados pelo cache.
- Snapshots só são invalidados após 401/403 ou negativa autenticada inequívoca; falhas transitórias são ignoradas.
- Testes de conectividade adicionados para servidor válido, 5xx, portal cativo e identidade JSON inválida.
- Validações concluídas: sintaxe dos módulos, service worker e novo teste, 6 testes unitários JavaScript e 336 testes PHPUnit (716 asserções).
- Execução E2E em navegador permanece condicionada ao servidor local e banco E2E.

## Semana 10 — Snapshots, versões offline e recursos anunciados

### Engenharia

- Manter snapshot atual e anterior por usuário/banda.
- Baixar músicas, categorias, repertórios, roteiros, metadata e shell em transação lógica única.
- Promover nova versão somente após validação integral.
- Oferecer restauração da versão anterior.
- Exibir revisão, última sincronização e disponibilidade offline em linguagem comum.
- Reativar Modo Ensaio e remover dependência produtiva de `window.mockPlayer`.
- Validar upload de áudio por tamanho, MIME e extensão.
- Tratar YouTube indisponível sem bloquear a cifra.
- Versionar eventos Live e ignorar duplicados/antigos.

### Testes

- Sincronização interrompida, snapshot inválido, versão igual/diferente e rollback.
- Reinício do navegador/dispositivo e uso após vários dias.
- Live com troca de host e reconexão.
- Ensaio com arquivo inválido/grande e provedor indisponível.

### Aceite

- Nenhuma falha substitui o último snapshot válido.
- Funcionalidades prometidas na landing estão acessíveis e na regressão principal.

### Status de execução — concluída em 03/08/2026

- IndexedDB elevado à versão 6 com snapshots completos atual e anterior por usuário/banda.
- Promoção do novo snapshot ocorre na mesma transação de músicas, categorias, repertórios, roteiros e metadados.
- Snapshot atual só é substituído após validação integral; a versão anterior pode ser restaurada pela tela de configurações.
- Revisão e data da versão anterior são apresentadas ao usuário junto ao status offline.
- Modo Ensaio deixou de depender de `window.mockPlayer` em produção.
- Upload local valida limite de 50 MB, MIME e extensão antes de carregar o áudio.
- Áudio remoto é limitado a 50 MB e validado por assinatura MP3, WAV, OGG ou MP4; falha do YouTube não bloqueia a cifra.
- Eventos Live incrementam versão para mudanças de rolagem e ignoram versões duplicadas ou antigas.
- Cache do app atualizado para a versão 3.3.0.
- Validações concluídas: sintaxe JavaScript/PHP, 6 testes unitários JavaScript e 336 testes PHPUnit (716 asserções).
- Cenários E2E de interrupção, reinício e reconexão permanecem condicionados ao servidor local e banco E2E.

## Semana 11 — Integridade, concorrência e integrações comerciais

### Engenharia A

- Adicionar idempotência por `event_id` ao Stripe.
- Proteger criação/edição contra duplo clique e requisições repetidas.
- Adicionar revisão para conflito de edição e retorno 409.
- Usar transações em cadastro, banda, convite, roteiro e cobrança.
- Revisar constraints, registros órfãos e datas UTC.
- Validar ativação, recuperação e convite em SMTP sandbox.
- Validar checkout, renovação, cancelamento, duplicidade e ordem invertida em Stripe sandbox.
- Tornar estado da cobrança compreensível e reconciliável.

### Aceite

- Mesmo webhook processado várias vezes altera dados uma vez.
- Duas abas não sobrescrevem silenciosamente.
- Falha intermediária produz rollback integral.

### Status de execução — implementação concluída em 03/08/2026

- Webhook Stripe ganhou idempotência persistente por `event_id`, registro de resultado e resposta específica para duplicidades.
- Eventos Stripe fora de ordem são ignorados por recurso usando `event_created`; cobrança e ledger são atualizados na mesma transação.
- Migração e schema adicionam tabelas de eventos/recursos Stripe, índice de ordenação e unicidade da assinatura por banda.
- Falhas intermediárias no webhook executam rollback e geram evento operacional sem expor detalhes internos.
- Escritas de músicas, categorias, repertórios e roteiros usam revisão base e retornam 409 em conflito; a camada CSRF injeta a revisão corrente.
- Salvamento de repertório e roteiro agora bloqueia cliques repetidos enquanto a requisição está em andamento; música e criação de banda já possuíam guarda equivalente.
- Cadastro, criação de banda, revisões de conteúdo e operações compostas dos repositórios mantêm transações e rollback.
- Schema padronizado para UTC e preparado para impedir duas bandas com a mesma assinatura Stripe.
- Validações concluídas: lint PHP e 338 testes PHPUnit (721 asserções).
- Validação real de SMTP e cenários Stripe sandbox depende das credenciais e endpoints externos do ambiente de homologação.

## Semana 12 — Performance, acessibilidade completa e regressão

### Engenharia

- Paginar listas extensas e reduzir payloads.
- Adicionar índices para banda, status, data e revisão.
- Eliminar N+1 e chamadas duplicadas.
- Remover massa de cifras hardcoded do bundle ativo.
- Carregar módulos por funcionalidade e otimizar imagens/assets.
- Finalizar teclado, foco visível, leitor de tela, contraste AA e `prefers-reduced-motion`.
- Ampliar suíte visual para home, Setlists, plano, usuários, configurações e editor.
- Particionar E2E por domínio e executar com dados isolados.
- Gerar screenshot, trace e log em toda falha.

### Metas

- smoke <2 min;
- regressão completa <10 min;
- cinco execuções consecutivas sem flaky;
- APIs comuns p95 ≤500 ms;
- Live p95 ≤1 s;
- landing LCP ≤2,5 s;
- zero violações críticas/sérias de acessibilidade.

### Execução registrada

- Home renderiza músicas em lotes de 100, com carregamento progressivo e um único listener de rolagem.
- Schema e migração idempotente adicionam índices compostos por banda, classificação, visibilidade e data de atualização.
- Massa legada de cifras permanece fora do bundle ativo; testes instrumentais de cobertura foram separados da regressão funcional.
- Falhas E2E agora preservam screenshot, vídeo, trace e log de console, erros de página e requisições malsucedidas.
- Regressão de qualidade cobre home, repertórios, plano, usuários, configurações e editor, incluindo foco, semântica, overflow, alvos móveis de 44 px e movimento reduzido.
- Compatibilidade visual dos toasts restaurada para seletores legados e atuais.
- Validações concluídas: 338 testes PHPUnit/721 asserções, 6 testes JavaScript, smoke 6/6, categorias 11/11 e gate móvel corrigido.
- A regressão funcional continua serial porque os cenários compartilham sessão e banco; paralelização sem isolamento por worker invalida autenticação. O gate de menos de 10 minutos permanece pendente até cada worker possuir banco, usuário e arquivos de autenticação exclusivos.

## Semana 13 — Beta fechado e validação

### Operação/Produto/Engenharia

- Liberar para até cinco bandas convidadas por feature flag.
- Acompanhar cadastro, primeira cifra, sync, Live, e-mail, cobrança, erros e latência.
- Registrar dúvidas de suporte como defeitos de conteúdo ou fluxo.
- Executar compra/cancelamento controlados e reconciliação.
- Repetir restore e rollback.
- Corrigir imediatamente qualquer P0/P1/UX-1.

### Aceite

- Sete dias sem P0/P1/UX-1.
- Sucesso das tarefas essenciais ≥98%.
- Sessões sem erro ≥99,5%.
- Nenhuma dúvida recorrente impede a tarefa principal.

### Execução registrada

- Feature flag `BETA_CLOSED_ENABLED` criada, desativada por padrão e limitada por código a no máximo cinco IDs em `BETA_INVITED_BAND_IDS`.
- Páginas e APIs bloqueiam bandas não convidadas com resposta explícita; seleção de outra banda continua disponível e criação de novas bandas fica desativada durante o beta.
- Telemetria operacional registra cadastro concluído, primeira cifra, criação/edição de música, snapshot sincronizado, atualização Live, e-mail, Stripe, falhas e duração das requisições sem armazenar identificadores em claro.
- Tela de indisponibilidade do beta adicionada e configuração documentada em `.env.example`.
- Validações concluídas: 341 testes PHPUnit/727 asserções, 6 testes JavaScript e smoke 6/6.
- Permanecem externas: escolher as até cinco bandas, ativar a flag no ambiente, observar sete dias, executar compra/cancelamento Stripe controlados e confirmar os gates de sucesso e sessões sem erro.

## Semana 14 — Reauditoria e decisão de lançamento

- Reexecutar as duas auditorias integralmente.
- Comparar notas, achados resolvidos, residuais e novos.
- Verificar HTTPS, domínio, cookies, headers e monitoramento reais.
- Executar pentest seguro e auditoria WCAG independente.
- Validar termos, privacidade, exclusão, suporte e cancelamento.
- Anexar evidência a cada item do checklist.
- Atualizar parecer final e plano de rollback.

### Gate final

- nenhum P0, P1, P2, UX-0, UX-1 ou UX-2 aberto;
- nenhuma funcionalidade anunciada desativada ou simulada;
- regressão, PWA, visual, segurança e acessibilidade verdes;
- restore, alertas e rollback comprovados;
- aprovação formal de Engenharia, Produto, Operações, Segurança e Jurídico.

## 5. Trilha da importação de cifras

## Semana 7 — Importação por conteúdo colado

- Adicionar “Importar cifra” ao cadastro/edição.
- Receber texto colado e identificar nome, artista, tom, capo, afinação, letra, acordes e seções.
- Preservar alinhamento monoespaçado.
- Sanitizar HTML e bloquear scripts, eventos, URLs e estilos perigosos.
- Exibir preview editável, destacar ambiguidades e exigir confirmação.
- Registrar URL original apenas como referência opcional.
- Exigir declaração de direito de uso.

Aceite: cifras simples/complexas, tablaturas, caracteres especiais e payload malicioso possuem testes e nunca são salvos sem preview.

## Dependência externa — Importação autorizada por URL

- Criar contrato de provedor externo desacoplado e inativo.
- Proteger URL contra SSRF e limitar domínio, timeout, tamanho e redirects.
- Não realizar scraping do Cifra Club.
- Ativar somente após API, licença ou autorização formal da Studio Sol.
- Após autorização, criar fixtures contratuais, atribuição e rastreabilidade de origem.

## 6. Matriz de cobertura dos achados

| Achado | Semanas |
|---|---|
| P1-01 segredos | 1–2 |
| P1-02 recuperação operacional | 5 e 13 |
| P1-03 privacidade/jurídico | 4 e 14 |
| P1-04 regressão lenta | 1 e 12 |
| P2-01 debug auth | 2 |
| P2-02 rate limit | 3 |
| P2-03 Modo Ensaio | 10 |
| P2-04 Stripe/SMTP/YouTube | 10–11 |
| P2-05 senha fraca | 2 |
| P2-06 carga/concorrência | 11–12 |
| P3-01 linguagem | 7 |
| P3-02 onboarding | 7 |
| P3-03 estados vazios | 7 |
| P3-04 contratos JSON | 4 |
| P3-05 CSP | 3–4 |
| P3-06 autocomplete | 6–7 |
| P3-07 acessibilidade | 6 e 12 |
| P4 telemetria/importação/histórico/ajuda | 7, 11–13 e trilha de importação |
| UX-1-01 Setlists mobile | 6 |
| UX-1-02 fixtures visíveis | 1 |
| UX-1-03 plano mobile | 6 |
| UX-2-01 onboarding | 7 |
| UX-2-02 terminologia | 7 |
| UX-2-03 alvos pequenos | 6 |
| UX-2-04 hierarquia home | 6–7 |
| UX-2-05 offline técnico | 7, 9–10 |
| UX-2-06 botões genéricos | 7 |
| UX-2-07 labels | 6 |
| UX-2-08 pagamento | 11 |
| Remoção da sigla legada | 8 |
| Login e conectividade offline | 9 |
| Versões offline atual/anterior | 10 |
| Importação por conteúdo colado | 7/trilha específica |

## 7. Itens executáveis pela IA e dependências humanas

### A IA pode implementar diretamente

- código, migrations, testes, CI e documentação;
- segurança da aplicação, isolamento, contratos e validações;
- layouts, onboarding, acessibilidade e conteúdo provisório;
- conectividade/offline, snapshots, Live e Ensaio;
- parser de conteúdo colado e interface de provedor inativo;
- performance, observabilidade interna e scripts de backup/restore;
- relatórios de evidência e reauditoria técnica.

### Exigem ação ou aprovação humana

- rotacionar segredos nos provedores;
- configurar infraestrutura, DNS, certificados, alertas e armazenamento externo;
- aprovar termos, privacidade e política de retenção;
- obter autorização/licença do Cifra Club;
- executar pagamentos reais e aprovar decisões comerciais;
- recrutar usuários e validar tarefas com pessoas reais;
- autorizar beta e produção.

## 8. Definição de concluído por item

Um item só pode ser encerrado quando:

1. comportamento implementado e revisado;
2. testes unitários/integrados/E2E proporcionais ao risco;
3. acessibilidade e responsividade verificadas quando houver UI;
4. logs e erros não expõem dados sensíveis;
5. documentação atualizada;
6. critério de aceite reproduzido;
7. evidência anexada;
8. regressão impactada verde;
9. rollback conhecido;
10. nenhum achado novo de severidade igual ou maior introduzido.

## 9. Fechamento técnico executado em 4 de agosto de 2026

As fases de melhoria de código previstas neste cronograma foram implementadas. O fechamento técnico incluiu:

- banco E2E local recriável e isolado, com schema e dados determinísticos;
- autenticação, ativação e recuperação de senha com tokens armazenados por hash;
- modo offline orientado pela disponibilidade real do servidor, mantendo sessão e dados locais quando o servidor não responde;
- snapshots atual e anterior por usuário e banda, troca entre bandas preparadas e contexto confirmado pelo service worker;
- separação entre cache estático da aplicação e páginas/dados contextualizados por usuário e banda;
- página offline independente do backend, garantindo instalação válida do service worker;
- editor com estado de inicialização determinístico, importação por conteúdo colado, origem e confirmação de direitos;
- contrato de importação externa desacoplado e provedor do Cifra Club desativado até existir autorização formal;
- remoção integral da sigla legada, inclusive aliases ocultos, nomes de testes e documentação;
- estabilização de palco, apresentação, layouts responsivos, acessibilidade, segurança e testes de cobertura.

### Evidências automatizadas finais

| Gate | Resultado |
|---|---:|
| PHPUnit | 343 testes e 730 asserções aprovados |
| JavaScript unitário | 6 de 6 aprovados |
| E2E completo | 632 aprovados, 2 ignorados por condição explícita, 0 falhas |
| E2E de cobertura | 98 de 98 aprovados |
| Qualidade, layout e acessibilidade | 19 de 19 aprovados |
| Modo apresentação | 31 de 31 aprovados |
| Busca pela sigla legada no código, testes e documentos | 0 ocorrências |

Os itens classificados na seção 7 como dependências humanas continuam fora do fechamento técnico e precisam de aprovação, credenciais ou execução externa antes da liberação comercial definitiva.
