# Conteúdo de pré-lançamento no Instagram — Cifrô

**Data:** 2026-08-11
**Status:** design aprovado, pronto para plano de implementação

## Objetivo

Preparar o público do Instagram para o lançamento do Cifrô. A meta desta fase é
**awareness e crescimento de seguidores** — não capturar leads. Nenhuma peça pede
cadastro; o CTA é seguir o perfil.

**Público:** músicos de igreja (ministros de louvor, equipes de louvor) e bandas
cover que tocam em bares e eventos. A dor central é a mesma nos dois grupos: o
repertório muda em cima da hora e a equipe se vira com papel, print e app com
propaganda.

## Entrega

1. Um Reel hero de ~29s, formato 9:16, produzido a partir de captura real do app.
2. Um plano de conteúdo de quatro semanas (peças, legendas, hashtags) em documento.

Fora de escopo nesta fase: narração gravada, filmagem de pessoas, publicação no
Instagram. Tudo isso fica com o usuário.

## Conceito do Reel hero

**"O vocalista mudou a música" — dor → alívio.**

O Modo Live é o diferencial que nenhum concorrente tem e é visualmente óbvio em
dois segundos: duas telas mudando juntas. O vídeo gasta 12 dos 29 segundos nesse
momento e sacrifica profundidade nas outras funcionalidades de propósito.

### Decisões de formato

- **Mudo por design.** Texto na tela e trilha, sem narração. Funciona no feed com
  o som desligado e não depende de gravação de voz.
- **Exportado sem áudio.** A trilha é escolhida dentro do app do Instagram, entre
  os áudios em alta — isso favorece o alcance e evita questão de licenciamento.
- **Nenhuma marca de terceiro.** A cena do "app com propaganda" usa uma tela
  genérica, sem marca, construída para o vídeo. Reconhecível sem apontar para
  ninguém.

### Roteiro cena a cena

| Tempo | Cena | Texto na tela |
|---|---|---|
| 0:00–0:02 | Dois celulares lado a lado, mesma cifra aberta. Silêncio até o beat. | "Quando muda a ordem do repertório" |
| 0:02–0:04 | Folha impressa riscada à mão | "a folha impressa já era" |
| 0:04–0:06 | Print de cifra em conversa de grupo | "o print do grupo não tá no seu tom" |
| 0:06–0:08 | Cifra genérica com banner de propaganda cobrindo o refrão | "e o app tem propaganda no meio do refrão" |
| 0:08–0:14 | Host abre o roteiro e toca na próxima música; a tela da direita vira sozinha. Segura 2s no momento da troca. | "o host troca. todo mundo acompanha." |
| 0:14–0:17 | Toque no controle de tom, acordes mudam ao vivo | "e cada um no seu tom" |
| 0:17–0:20 | Rolagem automática descendo a cifra | — |
| 0:20–0:22 | Roteiro sendo montado, arrastando músicas | "o roteiro pronto antes do show" |
| 0:22–0:24 | Modo Ensaio, loop A/B ativo | "ensaia o trecho difícil em loop" |
| 0:24–0:26 | Modo avião ligado, cifra continua na tela | "e funciona sem internet" |
| 0:26–0:29 | Logo Cifrô | "Em breve." / "segue aqui pra acompanhar" |

## Arquitetura de produção

### Página de palco (stage)

Um arquivo HTML de 1080×1920 serve de palco da gravação. Ele contém:

- **Camada de cena:** dois `iframe` posicionados como celulares, apontando para o
  Cifrô local. O da esquerda é o host, o da direita é o membro.
- **Camada de mock:** as telas das cenas de dor (folha, print, app com
  propaganda), construídas em HTML estático e exibidas na sua vez.
- **Camada de legenda:** os textos de tela, sobrepostos.
- **Timeline:** um script que orquestra as trocas de cena nos tempos da tabela
  acima.

O Playwright grava essa página única em 1080×1920. Não há composição em
pós-produção.

### Duas sessões no mesmo navegador

O Modo Live exige dois usuários autenticados ao mesmo tempo, mas um contexto de
navegador tem um único jar de cookies e a sessão do PHP é por cookie.

**Solução:** os dois `iframe` apontam para origens diferentes do mesmo servidor —
`http://localhost:8090` e `http://127.0.0.1:8090`. São domínios de cookie
distintos, então cada iframe mantém sua própria sessão PHP. Um servidor, dois
usuários, sincronização Live real entre eles.

### Ambiente e dados

O `.env` do repositório aponta para o **banco de produção** (`srv1576.hstgr.io`,
`APP_ENV=production`, `cifro.online`). Gravar contra ele colocaria dados reais de
usuários num vídeo público.

**Regra:** a gravação roda exclusivamente contra um banco local de demonstração,
derivado de `scripts/setup/setup_e2e_db.php`, com uma banda fictícia, dois
usuários fictícios e um roteiro curado.

**Conteúdo das cifras:** nada de letra de música protegida por direito autoral na
tela. O repertório de demonstração usa composições próprias, domínio público ou
cifras exibidas em trechos onde só os acordes aparecem.

### Exportação

O Playwright grava em `.webm`/VP8. O Instagram espera `.mp4`/H.264. O ffmpeg que
acompanha o Playwright só traz o encoder VP8.

**Resolvido:** ffmpeg 9.0 completo instalado via winget (`Gyan.FFmpeg`), com
`libx264` e `aac` disponíveis. A entrega final é `.mp4` H.264 em 1080×1920, sem
faixa de áudio.

## Plano de conteúdo — quatro semanas

Ritmo de três peças por semana. O Reel hero abre a semana 2, depois que o perfil
já tem alguma coisa no grid.

**Semana 1 — existir e ter cara de gente.** Post de apresentação (quem é você e
por que está construindo isso), carrossel com a dor do repertório de última hora,
enquete nos stories sobre como a banda organiza o repertório hoje.

**Semana 2 — o Reel hero.** O vídeo desta spec, mais um carrossel destrinchando o
Modo Live em quadros estáticos e um story com bastidor do desenvolvimento.

**Semana 3 — as outras funcionalidades.** Reel curto do Modo Ensaio (loop A/B e
pitch), Reel curto do funcionamento offline, carrossel sobre transposição de tom.

**Semana 4 — aproximar do lançamento.** Depoimento ou bastidor de uso real,
carrossel "o que vem por aí", story de contagem regressiva sem data fechada
("chegando").

Legendas e hashtags de cada peça entram no plano de implementação, não aqui.

## Riscos

- **Vazamento de dados de produção na gravação.** Mitigado pela regra de banco
  local de demonstração. É o risco mais grave da spec.
- **Direito autoral de letras.** Mitigado pela escolha do repertório de
  demonstração.
- ~~**Conversão para mp4.**~~ Resolvido: ffmpeg 9.0 instalado.
- **Sincronização Live instável na gravação.** Se o polling do Live introduzir
  atraso perceptível, o momento de 2s pode não render. Plano B: gravar o momento
  isolado e ajustar o tempo da timeline.
