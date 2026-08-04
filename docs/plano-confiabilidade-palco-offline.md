# Plano de confiabilidade para palco, offline e sincronização

Estado: Implementado e validado localmente em 2026-07-14

## Resultado da implementação

As oito fases foram aplicadas no código. Os critérios automatizáveis são cobertos pelos projetos Playwright `cifro` e `pwa`, por PHPUnit e pelos testes JavaScript. Os portões físicos de liberação em aparelhos Android e iOS permanecem como procedimento de homologação antes da publicação, pois não podem ser comprovados apenas pelo ambiente local.

Evidências principais:

- revisão transacional e conflito: `tests/cifro/27-sync-revision.spec.js`;
- PWA, modo avião, rede lenta, duas bandas e Wake Lock: `tests/cifro/26-offline-sync.spec.js`;
- instalação, falha e recuperação do service worker: `tests/cifro/30-service-worker-coverage.spec.js`;
- permissões e isolamento: `tests/cifro/23-perfis-permissoes.spec.js`;
- fluxos de palco, Live, setlists e roteiros: `tests/cifro/28-interacoes-palco.spec.js`.

Validação final automatizada:

- PHPUnit: 66 testes e 277 asserções aprovados;
- JavaScript unitário: 6 testes aprovados;
- projeto Playwright `pwa`: 12 testes aprovados;
- projeto Playwright `cifro`: 415 testes aprovados e 1 teste ignorado; os 2 casos de webhook que inicialmente reutilizaram um servidor sem o segredo E2E foram repetidos em servidor isolado e aprovados;
- metas de primeira renderização cacheada abaixo de 500 ms e ausência de snapshot com revisão igual repetidas três vezes sem falha;
- sintaxe PHP e JavaScript validada nos arquivos alterados.

Os itens marcados abaixo representam a implementação local concluída. Os portões físicos permanecem separados porque exigem aparelhos e ambiente de homologação.

## Objetivo

Tornar o Cifrô previsível para uso no palco, com leitura imediata dos dados locais, funcionamento offline das funções de apresentação, troca offline entre bandas preparadas e uso mínimo de rede e banco de dados.

## Decisões de produto

- O IndexedDB continuará chamado `cifro`.
- Não haverá migração do banco legado `stagebox`, pois a aplicação ainda não foi lançada.
- Transposição por `+` e `-` continuará local, visual e não persistente.
- Músicas, categorias, playlists, roteiros, usuários e bandas não poderão ser cadastrados ou alterados offline.
- Preferências do dispositivo, transposição, metrônomo, apresentação e navegação por conteúdo preparado funcionarão offline.
- A troca offline será permitida apenas entre bandas já preparadas no dispositivo.
- A cifra em exibição não será substituída silenciosamente durante uma apresentação.
- O snapshot completo de dados só será solicitado quando a revisão da banda mudar.
- A primeira implementação não utilizará polling contínuo, SSE ou WebSocket para conteúdo.

## Metas operacionais

- Home cacheada renderizada em até 500 ms.
- Cifra cacheada renderizada em até 500 ms.
- Navegação entre músicas sem chamadas ao banco ou à API enquanto a revisão local ainda for válida.
- Nenhum download completo quando os dados não mudaram.
- Zero chamadas de conteúdo quando o dispositivo estiver offline.
- Nenhuma perda do cache anterior quando uma atualização do aplicativo falhar.
- Nenhuma atualização silenciosa da cifra que já está aberta.
- Troca offline entre bandas preparadas após fechar e reabrir a aplicação.
- Leitura offline preservada quando a sessão do servidor expirar.

## Arquitetura proposta

### Fonte de leitura no palco

O IndexedDB será a fonte imediata da Home, cifras, playlists, roteiros e categorias. A rede será usada para revalidar e atualizar o conteúdo, nunca para bloquear a primeira renderização quando houver snapshot local válido.

Fluxo de abertura:

1. Identificar usuário e banda local ativa.
2. Ler o snapshot da banda no IndexedDB.
3. Renderizar imediatamente.
4. Verificar, sem bloquear a interface, se uma revalidação é necessária.
5. Consultar somente a revisão da banda.
6. Encerrar se a revisão for igual.
7. Baixar e persistir um snapshot somente se a revisão for diferente.

### Revisão de conteúdo por banda

Criar a tabela:

```text
band_sync_state
- banda_id CHAR(36) PRIMARY KEY
- content_revision BIGINT UNSIGNED NOT NULL
- updated_at TIMESTAMP NOT NULL
```

Toda gravação em músicas, categorias, playlists ou roteiros incrementará `content_revision` na mesma transação que altera o conteúdo.

`/api/sync/version.php` fará uma única consulta indexada e retornará somente a revisão atual. `/api/sync/data.php` retornará o snapshot completo e a mesma revisão.

### Política de revalidação

A revisão será consultada somente:

- na primeira abertura online da aplicação;
- ao recuperar a conexão;
- ao voltar do segundo plano depois do intervalo configurado;
- ao trocar de banda;
- após cadastro online bem-sucedido;
- por ação manual do usuário.

O horário da última verificação será salvo por usuário e banda para impedir chamadas repetidas durante navegações internas. Abrir outra cifra não deverá provocar nova sincronização completa.

### Persistência atômica no navegador

Músicas, playlists, roteiros, categorias e metadata serão atualizados em uma única transação IndexedDB. A revisão local só será alterada depois que todas as stores forem gravadas.

Antes da persistência, o cliente validará:

- revisão presente e válida;
- arrays obrigatórios presentes;
- banda da resposta igual à banda solicitada;
- estrutura mínima dos registros.

Resposta inválida não poderá substituir dados locais por arrays vazios.

### Atualização em outros dispositivos

O dispositivo que executou o cadastro receberá o registro canônico e a nova revisão na resposta do POST e atualizará o IndexedDB diretamente, sem baixar novamente o snapshot completo.

Outros dispositivos perceberão a mudança na próxima revalidação. Na Home, o conteúdo poderá ser atualizado automaticamente. Na cifra aberta, a nova revisão será armazenada e será exibido um aviso de atualização disponível. A cifra atual só mudará ao reabrir a música ou mediante confirmação.

## Modelo local proposto

O banco `cifro` ganhará uma nova versão e as seguintes estruturas:

```text
cifro_bands
- user_id
- active_band_id
- bandas[]

cifro_musicas
- cache_key: user_id:banda_id
- data[]

cifro_playlists
- cache_key: user_id:banda_id
- data[]

cifro_roteiros
- cache_key: user_id:banda_id
- data[]

cifro_categorias
- cache_key: user_id:banda_id
- data[]

cifro_sync_meta
- cache_key: user_id:banda_id
- content_revision
- last_checked_at
- last_sync_at
- prepared_at
- app_version
- snapshot_valid
```

O catálogo `cifro_bands` conterá somente bandas às quais o usuário teve acesso durante uma sessão online. Cada banda indicará se possui snapshot offline válido.

## Fases de implementação

### Fase 1 — Segurança e integridade dos cadastros

Objetivo: eliminar acesso cruzado e gravações com risco de perda de dados.

- [x] Remover o uso livre de `banda_id` dos endpoints de sincronização.
- [x] Usar a banda atual da sessão após seleção autorizada.
- [x] Validar associação do usuário antes de trocar a banda da sessão.
- [x] Unificar as permissões de gestor, administrador e master nas views, controllers e APIs.
- [x] Colocar o salvamento completo de playlists em transação.
- [x] Adicionar rollback para qualquer falha de playlist.
- [x] Validar IDs de músicas, tons, nomes, datas e estrutura dos itens antes de iniciar a transação.
- [x] Adicionar controle de concorrência por `baseRevision` e resposta `409 Conflict`.

Critérios de conclusão:

- Um usuário autenticado não lê nem altera outra banda.
- Uma falha durante o salvamento não deixa playlists vazias ou parciais.
- Uma edição baseada em revisão antiga não sobrescreve silenciosamente uma edição mais nova.

### Fase 2 — Revisão única de conteúdo

Objetivo: permitir verificação barata e confiável de mudanças.

- [x] Criar `band_sync_state` no schema e scripts de setup.
- [x] Criar repository responsável por ler e incrementar a revisão.
- [x] Incrementar a revisão na mesma transação de músicas, categorias, playlists e roteiros.
- [x] Garantir que endpoints legados também incrementem a revisão ou deixem de gravar conteúdo.
- [x] Alterar o endpoint de versão para uma única leitura indexada.
- [x] Fazer o snapshot retornar `banda_id` e `content_revision`.
- [x] Atualizar contratos e testes das APIs.

Critérios de conclusão:

- Qualquer alteração de conteúdo muda a revisão exatamente uma vez.
- Nenhuma alteração de usuário, configuração pessoal ou estado Live muda a revisão de conteúdo.
- Revisão igual nunca dispara `/api/sync/data.php`.

### Fase 3 — Motor de sincronização cache-first

Objetivo: renderizar o conteúdo local sem depender da qualidade da conexão.

- [x] Separar `loadCached`, `checkVersion` e `downloadSnapshot`.
- [x] Renderizar o cache antes de iniciar qualquer fetch.
- [x] Adicionar timeout com `AbortController`.
- [x] Não usar `navigator.onLine` como prova de acesso ao servidor.
- [x] Deduplicar sincronizações concorrentes por usuário e banda.
- [x] Persistir o snapshot em uma única transação IndexedDB.
- [x] Validar o snapshot antes da gravação.
- [x] Manter o snapshot anterior em qualquer erro.
- [x] Implementar janela de revalidação em `sessionStorage` ou IndexedDB.
- [x] Atualizar o IndexedDB diretamente após POST bem-sucedido.
- [x] Manter cadastro offline bloqueado e preservar o conteúdo não salvo na tela em falhas de rede.

Critérios de conclusão:

- Wi-Fi sem acesso ao servidor não bloqueia Home ou cifra cacheada.
- Navegar por 20 músicas não solicita 20 versões nem 20 snapshots.
- Uma resposta inválida não apaga dados locais.

### Fase 4 — Service worker e pacote offline atômico

Objetivo: impedir que atualizações destruam um pacote funcional.

- [x] Separar caches de shell, runtime e metadata.
- [x] Baixar uma nova versão sem apagar a anterior.
- [x] Validar status, redirecionamento e tipo de conteúdo de cada asset.
- [x] Ativar o novo cache somente após o pacote completo.
- [x] Remover apenas caches antigos pertencentes ao Cifrô.
- [x] Aguardar todos os `cache.put()`.
- [x] Remover atualização destrutiva em `ONLINE` e `DAILY_CHECK`.
- [x] Centralizar o registro do service worker.
- [x] Usar `cache-first` para assets versionados.
- [x] Criar manifesto de assets com as mesmas URLs versionadas usadas pelas páginas.
- [x] Incluir `music-view.js`, `music-view.css`, fontes e scripts necessários no palco.
- [x] Não armazenar páginas autenticadas específicas de usuário como shell genérico.
- [x] Manter nova versão aguardando reinício ou confirmação segura.

Critérios de conclusão:

- Falha no meio da atualização mantém a versão anterior funcional.
- Primeira preparação seguida de modo avião abre Home e cifra.
- Nenhum HTML de login é aceito como asset ou shell válido.

### Fase 5 — Preparação e troca de banda offline

Objetivo: permitir navegação segura entre bandas preparadas sem servidor.

- [x] Criar e alimentar `cifro_bands` durante sessões online.
- [x] Armazenar os dados por `user_id:banda_id`.
- [x] Persistir a banda local ativa.
- [x] Mostrar data, revisão e estado de preparação de cada banda.
- [x] Permitir troca offline somente para bandas com snapshot válido.
- [x] Bloquear banda não preparada com mensagem clara.
- [x] Remover a banda PHP embutida como única fonte de verdade durante o modo offline.
- [x] Ao reconectar, selecionar a banda no servidor antes de sincronizar.
- [x] Manter leitura offline se a sessão expirou.
- [x] Invalidar acesso local removido somente depois de uma confirmação online do servidor.

O botão de preparação deverá:

1. Atualizar o catálogo de bandas.
2. Verificar a revisão da banda.
3. Baixar dados somente se necessário.
4. Preparar shell e assets.
5. Solicitar armazenamento persistente.
6. Verificar cache e IndexedDB.
7. Gravar `prepared_at` somente após sucesso integral.

Critérios de conclusão:

- Duas bandas preparadas podem ser alternadas em modo avião.
- Reiniciar o navegador mantém a banda selecionada e o acesso aos dados.
- Banda não preparada nunca aparece como disponível offline.

### Fase 6 — Confiabilidade da apresentação

Objetivo: impedir mudanças inesperadas e manter a tela ativa.

- [x] Criar estado visível `Pronto para palco`.
- [x] Exibir banda, revisão, última sincronização, versão do app e integridade do pacote.
- [x] Criar modo palco que adie atualização do aplicativo e da cifra atual.
- [x] Corrigir as chaves de tamanho, velocidade e Wake Lock.
- [x] Aplicar preferências em todas as telas relevantes.
- [x] Respeitar `keepAwake`.
- [x] Recuperar Wake Lock após `visibilitychange`.
- [x] Informar quando Wake Lock não estiver disponível.
- [x] Exibir atualização de cifra disponível sem aplicá-la automaticamente.
- [x] Manter transposição visual e não persistente.

Critérios de conclusão:

- A tela permanece ativa enquanto o modo palco estiver habilitado e suportado.
- Uma atualização remota não muda a cifra durante a execução.
- As preferências selecionadas são aplicadas após fechar e reabrir o app.

### Fase 7 — Redução de rede e peso

Objetivo: reduzir tráfego, requisições e trabalho do navegador.

- [x] Remover sincronização completa de Home, música, roteiro e editores quando a revisão for igual.
- [x] Não consultar Live quando nenhum modo Live estiver ativo, salvo requisito explícito de indicador.
- [x] Enviar atualização do host somente quando página ou rolagem mudar.
- [x] Manter heartbeat separado e menos frequente.
- [x] Parar polling Live em segundo plano.
- [x] Aumentar o intervalo do seguidor quando não houver mudanças.
- [x] Manter somente uma distribuição do Bootstrap.
- [x] Carregar módulos de ensaio sob demanda.
- [x] Carregar recursos Live sob demanda quando viável.
- [x] Mover scripts inline grandes para arquivos externos cacheáveis.
- [x] Configurar compressão e cache HTTP longo para assets versionados.
- [x] Remover código legado duplicado depois da cobertura automatizada.

Orçamento esperado sem mudanças de conteúdo:

- uma resposta pequena de revisão na abertura elegível;
- nenhuma chamada ao snapshot;
- nenhuma chamada de conteúdo ao navegar entre cifras;
- nenhuma chamada quando offline.

### Fase 8 — Testes, documentação e liberação

Objetivo: comprovar o comportamento em condições reais de palco.

- [x] Criar projeto Playwright com service worker habilitado.
- [x] Testar preparação limpa seguida de modo avião.
- [x] Testar Home, cifra, setlist e roteiro offline.
- [x] Testar troca offline entre duas bandas.
- [x] Testar Wi-Fi conectado com servidor inacessível.
- [x] Testar interrupção durante atualização do cache.
- [x] Testar URLs de assets com `?v=`.
- [x] Testar revisão igual sem chamada ao snapshot.
- [x] Testar revisão diferente com exatamente um snapshot.
- [x] Testar rollback de playlists.
- [x] Testar bloqueio de acesso cruzado entre bandas.
- [x] Testar snapshot inválido e transação IndexedDB.
- [x] Testar sessão expirada durante leitura offline.
- [x] Testar atualização remota com cifra já aberta.
- [x] Testar Wake Lock e retorno do segundo plano.
- [x] Atualizar arquitetura, APIs, modelo de dados, domínio offline e rastreabilidade.

Portões para liberação:

- testes unitários e E2E aprovados;
- suíte offline real aprovada;
- teste em modo avião após reinício do dispositivo;
- teste com duas bandas preparadas;
- teste de atualização interrompida;
- teste em Android, iOS e computador;
- pacote alternativo de emergência mantido até a primeira versão estável em produção.

## Arquivos e áreas principais

- `public/src/js/cifro-sync.js`: leitura local, revisão e snapshot.
- `public/service-worker.js`: shell, assets e atualização atômica.
- `public/src/js/offline-tools.js`: preparação e diagnóstico.
- `public/src/js/cifro-presentation.js`: modo palco e Wake Lock.
- `public/src/js/live.js`: redução de polling e atualizações.
- `public/api/sync/version.php`: revisão leve.
- `public/api/sync/data.php`: snapshot validado.
- `public/src/Repositories/*`: transações e incremento da revisão.
- `public/src/backend/editor/*`: respostas canônicas e concorrência.
- `public/src/backend/bandas/selecionar.php`: reconciliação da banda local.
- `public/create_tables.sql`: estado de sincronização e índices.
- `tests/cifro`: contratos, segurança e fluxos.
- `playwright.config.js`: projeto específico de PWA e offline.

## Fora do escopo

- Cadastro ou fila de gravações offline.
- Persistência da transposição visual como alteração da música.
- Atualização instantânea obrigatória por WebSocket.
- Migração do IndexedDB legado `stagebox`.
- Alteração das regras comerciais dos planos.
