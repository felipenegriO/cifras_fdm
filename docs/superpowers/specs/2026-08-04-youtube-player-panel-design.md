# Player de vídeo do YouTube embutido — Design

## Contexto

Na tela de música (`public/src/Views/music.php`), a aba "Ferramentas" do painel de ajustes tem uma seção "Ensaio com YouTube e áudio" com um link "Pesquisar no YouTube" que hoje só abre a busca do YouTube numa aba nova (`target="_blank"`), e um botão "Abrir painel de ensaio" (Modo Ensaio, feature separada de prática com pitch/áudio baixado).

**Restrição técnica confirmada:** a página de busca/resultados do YouTube (`youtube.com/results`) não pode ser embutida em iframe — o YouTube bloqueia isso via `X-Frame-Options`/`frame-ancestors`, sem contorno possível do nosso lado. Só a página de **embed de um vídeo específico** (`youtube.com/embed/{videoId}`) é embutível.

## Objetivo

Permitir assistir a um vídeo específico do YouTube dentro da própria tela de música, sem trocar de aba, através de um painel lateral com três estados (aberto, minimizado, oculto), mantendo a busca em si numa aba nova (inalterada).

## Escopo

- Um vídeo por vez, associado à música atualmente aberta.
- Não inclui: busca embutida (tecnicamente inviável), múltiplos vídeos simultâneos, sincronização entre dispositivos (o estado é local ao navegador).

## Fluxo de entrada do vídeo

Na seção "Ensaio com YouTube e áudio" (dentro de `#settingsPanelTools`), abaixo do link "Pesquisar no YouTube" existente (inalterado):

- Novo campo de texto `id="youtubeVideoLinkInput"` — placeholder "Colar link do vídeo".
- Novo botão `id="btnTocarYoutubeAqui"` — "Tocar aqui".
- Ao clicar: extrai o ID do vídeo do texto colado usando `Rehearsal.youtube.extractYoutubeVideoId` (já existe em `public/src/js/rehearsal/rehearsal.youtube.js`, aceita link completo, `youtu.be/...`, `/shorts/...`, `/embed/...` ou o ID puro de 11 caracteres).
  - ID inválido: mostra erro inline abaixo do campo ("Link do YouTube inválido."), não abre o painel.
  - ID válido: abre o painel no estado **aberto**, carrega esse vídeo, salva no localStorage (ver "Persistência").

## O painel (`#youtubePlayerPanel`)

Elemento novo, fixo, fora do fluxo normal da página (`position: fixed`), com três estados controlados por uma classe no elemento raiz: `is-open` | `is-minimized` | (ausência de ambas = oculto, `display: none`).

### Estado aberto (`is-open`)

- Desktop (`min-width: 768px`): painel fixo à direita, `width: 40vw` (min `320px`, max `480px`), `height: 100vh`, do topo à base da tela, sobrepondo o conteúdo (`z-index` acima do conteúdo da música, abaixo de modais).
- Mobile (`< 768px`): painel fixo na parte inferior, `width: 100vw`, `height: 60vh`.
- Barra superior (`.yt-panel__header`): título do vídeo (texto truncado com `text-overflow: ellipsis`, obtido via `Rehearsal.youtube.fetchYoutubeMeta` — já existe, usa oEmbed), botão minimizar (`−`), botão fechar/ocultar (`×`).
- Corpo: `<iframe>` `src="https://www.youtube.com/embed/{videoId}"`, `width="100%" height="100%"`, `allow="autoplay; encrypted-media; picture-in-picture"`, `allowfullscreen`.
- Fechar a aba/navegar para outra música: o iframe é destruído (removido do DOM) — vídeo para de tocar. Trocar de estado (aberto → minimizado) **não** recria o iframe (só redimensiona/reposiciona via CSS), preservando a reprodução em andamento.

### Estado minimizado (`is-minimized`)

- Miniatura flutuante fixa, canto inferior direito da tela: `width: 220px; height: 124px` (proporção 16:9) mais uma barra fina no topo da miniatura com botão de restaurar e botão de fechar.
- O mesmo `<iframe>` (não recriado) é reposicionado para dentro dessa miniatura via CSS — o vídeo continua tocando.
- Clique em qualquer ponto da miniatura (fora dos botões) restaura para o estado aberto.

### Estado oculto

- `display: none` no painel — o iframe É destruído/removido do DOM (parar reprodução; simples e sem custo de manter um vídeo tocando invisível em segundo plano).
- Uma linha nova aparece na seção "Ensaio com YouTube e áudio" da aba Ferramentas, **só quando há um vídeo associado à música atual** (salvo no localStorage): botão `id="btnMostrarYoutube"` — "Mostrar vídeo: {título}". Clicar reabre o painel no estado aberto, recriando o iframe do mesmo vídeo (retoma do início — o YouTube embed não tem uma API própria de retomar posição sem a IFrame Player API, fora de escopo aqui).

## Persistência (localStorage)

Chave por música: `cifroYoutubePanel:{musicaId}` → `{ "videoId": "...", "title": "...", "state": "open" | "minimized" | "hidden" }`.

- Salva a cada mudança de estado ou de vídeo.
- Ao abrir a tela de música: se existir uma entrada para essa música, restaura o painel no estado salvo (exceto se o estado salvo for "hidden" — nesse caso não recria o iframe automaticamente; só mostra o botão "Mostrar vídeo" na aba Ferramentas, para não autoplaystar vídeo sem ação do usuário ao carregar a página).
- Trocar de música (navegar para outra tela de música): o painel da música anterior é descartado (iframe destruído); a nova música carrega (ou não) seu próprio estado salvo.

## Acessibilidade e comportamento

- Painel com `role="complementary"` e `aria-label="Player de vídeo do YouTube"`.
- Botões minimizar/restaurar/fechar com `aria-label` descritivo.
- Não há captura de foco/trap de teclado (o painel não é um modal — o resto da página continua interativa).

## Testes

Como é um componente de UI com dependência de rede (iframe do YouTube) e `localStorage`, a cobertura automatizada fica em:
- Testes unitários (Node, sem DOM real de navegador) para a lógica pura: parse de `localStorage` (leitura/gravação da chave `cifroYoutubePanel:{id}`), transição de estados (aberto → minimizado → oculto → aberto) como uma máquina de estado isolada de qualquer manipulação de DOM.
- Verificação manual no navegador (Browser pane) do fluxo completo: colar link, abrir painel, minimizar, ocultar, reabrir via Ferramentas — documentada no plano de implementação, não automatizada em CI.
