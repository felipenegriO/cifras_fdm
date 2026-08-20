# Offline, PWA e sincronização

## F-025 PWA

O service worker usa três caches com responsabilidades distintas: `cifro-static-*` para código, CSS, fontes e imagens versionados; `cifro-pages-*` para shells HTML autenticados; e `cifro-meta` para contexto, preparação e manifestos locais. Dados de domínio não são armazenados nesses caches.

O shell mantém uma página genérica `music.php`; qualquer cifra da banda abre por essa página e obtém seu conteúdo do snapshot completo no IndexedDB. Não existe download de um HTML diferente por música. Respostas redirecionadas, HTML de login e conteúdo com tipo incorreto são rejeitados. APIs e endpoints de escrita nunca são interceptados.

O registro e a atualização do service worker são centralizados em `cifro-sw-register.js`, carregado em páginas públicas e autenticadas. A versão do worker inclui a impressão digital do código, das views, do JavaScript e do CSS; qualquer mudança de interface invalida os caches anteriores. Landing e login também procuram uma nova versão; antes de enviar as credenciais, o login aguarda a ativação da atualização encontrada. Assim, um worker antigo não consegue devolver uma landing em cache depois que a sessão já foi criada. As mensagens suportadas incluem `SET_CONTEXT`, `CLEAR_CONTEXT`, `PREPARE_OFFLINE`, `VERIFY_OFFLINE` e `SKIP_WAITING`. `VERIFY_OFFLINE` confere diretamente assets, páginas essenciais e contexto, sem confiar apenas na revisão gravada.

O shell autenticado inclui uma splash de dissolução orgânica baseada na identidade visual do Cifrô. Ela só executa quando `display-mode: standalone` ou `navigator.standalone` identifica a instalação, uma vez por sessão de abertura. Navegador comum não anima nem exibe o overlay. A preferência `prefers-reduced-motion` desativa o efeito, existe fail-safe de quatro segundos e CSS, JavaScript e logo fazem parte do pacote offline.

## F-026 Dados offline

O IndexedDB `cifro`, versão 6, armazena os dados de domínio e separa cada registro por `user_id:banda_id`:

- `cifro_bandas`;
- `cifro_musicas`;
- `cifro_playlists`;
- `cifro_roteiros`;
- `cifro_categorias`;
- `cifro_sync_meta`;
- `cifro_snapshot_current`;
- `cifro_snapshot_previous`.

A leitura é cache-first. O snapshot local é renderizado antes da rede. A revisão da banda é consultada após a janela de 30 segundos, na reconexão, no retorno do segundo plano, na troca de banda ou por ação manual. Quando `content_revision` mudou, o cliente tenta `/api/sync/changes.php`; se a revisão não puder ser atendida, baixa o snapshot completo por `/api/sync/data.php`.

Músicas, playlists, roteiros, categorias e metadata são persistidos em uma única transação IndexedDB. Banda, revisão, arrays e estrutura mínima dos registros são validados antes da gravação. Erros, timeout ou respostas inválidas mantêm o snapshot anterior.

POSTs de conteúdo enviam `baseRevision`. Respostas bem-sucedidas atualizam diretamente a store afetada e a revisão local. Conflitos retornam HTTP 409 e não sobrescrevem alterações mais novas.

## Preparação e bandas

A preparação é automática no carregamento, retorno à aba, reconexão e depois de mudanças de revisão. O sistema audita IndexedDB e Cache Storage, repara recursos ausentes quando há servidor e solicita armazenamento persistente. O botão de sincronização permanece como diagnóstico e nova tentativa. A seleção offline aceita somente bandas cujo snapshot e shell foram verificados fisicamente. Ao reconectar, a seleção é confirmada no servidor antes de nova sincronização.

O conteúdo preparado continua legível se a sessão HTTP expirar. Fechar o navegador ou o PWA não cria prazo para o acesso local: ao reabrir sem internet, o shell autenticado usa o usuário e a banda já preparados no dispositivo, sem exibir login ou landing. Isso permanece válido enquanto o navegador conservar o service worker, o Cache Storage e o IndexedDB. A sessão do servidor continua obrigatória para sincronizar ou alterar dados quando a conexão voltar.

## Regras

- Cadastros e alterações exigem conexão.
- Transposição `+` e `-` é visual, local e não persistente.
- A cifra aberta é atualizada em memória quando uma revisão remota é sincronizada, sem exigir recarregamento.
- Live usa rede somente quando o usuário entra como líder ou seguidor.
- Sem conexão não há chamadas de conteúdo.

## Testes

O projeto Playwright `pwa` habilita service worker real e cobre pacote limpo, modo avião, Home, cifra nunca visitada, duas bandas, reinício, sessão expirada, Wi-Fi lento, remoção parcial e reconstrução do Cache Storage, snapshot inválido, revisão igual/diferente, acesso cruzado, atualização remota em tela, atualização de instalação antiga durante o login e Wake Lock. `66-offline-persistent-login.spec.js` remove todos os cookies, fecha a página e reabre o aplicativo offline para garantir que o acesso local não dependa da sessão PHP. `67-pwa-splash.spec.js` cobre navegador comum, instalação, execução única, movimento reduzido, celular, tablet e novo lançamento offline.
