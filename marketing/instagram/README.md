# Reel de pré-lançamento do Cifrô

Produz um vídeo 1080×1920 de 29s a partir de **capturas reais do app**, para o
Instagram. Nada aqui é encenado: o Modo Live troca a tela do membro porque o host
navegou de verdade, e a cena offline corta a rede e deixa o service worker
responder.

---

## ⚠️ Antes de rodar qualquer coisa

**A gravação só pode falar com o banco de demonstração local `cifro_demo`, em
`127.0.0.1`.** O `.env` do repositório aponta para o banco de **produção**
(`srv1576.hstgr.io`). Se a gravação rodar contra ele, dados reais de usuários
aparecem num vídeo público.

Três defesas, nesta ordem:

1. O `.env.local` do projeto aponta para MySQL local e tem precedência sobre o
   `.env` (ver `public/config/env.php`).
2. O `seed-demo.php` aborta se `DB_HOST` não for `localhost`, `127.0.0.1` ou `::1`.
3. O `record.mjs` passa `DB_NAME=cifro_demo` explicitamente ao subir o servidor.

Se em algum momento você vir um nome de usuário ou uma música que não seja do
repertório de demonstração, **pare e investigue**.

---

## Como gerar o vídeo do zero

```bash
npm run demo:seed
```
Cria e popula `cifro_demo`: a Banda Demo, dois usuários (`host@demo.local` e
`membro@demo.local`, senha `CifroDemo#2026!`), 6 músicas autorais e a playlist
`Culto de Domingo`.

```bash
npm run demo:build
```
Grava os 870 quadros e codifica o mp4. **Leva dezenas de minutos.** Equivale a
`npm run demo:record && npm run demo:encode`.

Saída: **`marketing/instagram/out/reel.mp4`** — H.264, 1080×1920, 30 fps,
`yuv420p`, **sem faixa de áudio**.

---

## O áudio é escolhido no Instagram, não aqui

O vídeo sai mudo de propósito. Suba no app do Instagram e escolha uma trilha
entre os **áudios em alta** — isso favorece o alcance e resolve licenciamento.
O vídeo foi desenhado para funcionar com o som desligado: tudo que importa está
escrito na tela.

---

## Checklist antes de publicar

Assista o `reel.mp4` inteiro uma vez e confirme:

- [ ] Nenhum dado real de usuário aparece — só a Banda Demo e o repertório autoral
- [ ] Nenhuma marca de terceiro em nenhum quadro
- [ ] As legendas ficam dentro das zonas seguras: nada essencial acima de y=220,
      abaixo de y=1500, nem à direita de x=960 (é onde a UI do Reels entra)
- [ ] O momento da troca no Modo Live (~10s) é legível e óbvio
- [ ] Nenhuma cena afirma algo que a tela não mostra

---

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `seed-demo.php` | Cria e popula o banco de demonstração |
| `stage/stage.html` | Estrutura do palco 1080×1920 |
| `stage/stage.css` | Todas as decisões visuais |
| `stage/timeline.js` | O que aparece no quadro N — editar o roteiro é editar o array `SCENES` |
| `record.mjs` | Dirige o app e fotografa os 870 quadros |
| `encode.mjs` | PNGs → mp4 |
| `assets/ensaio-demo.wav` | Áudio autoral gerado por ffmpeg, usado na cena de ensaio |
| `copy/plano-4-semanas.md` | As 12 peças do plano de conteúdo, com legendas e hashtags |
| `out/` | Quadros e vídeo (fora do git) |

O roteiro cena a cena e as decisões de produção estão em
`docs/superpowers/plans/2026-08-11-instagram-reel-hero.md`.

---

## Coisas que já mordem

- **`ensaio.php` e `editorplaylist.php` não existem.** O painel de ensaio é um
  modal dentro de `music.php`, aberto por `#btnAtivarEnsaio`. O roteiro é
  `roteiro.php?id=N`.
- **O Modo Live só publica estado em `music.php?id=N`.** Em `roteiro.php`,
  `currentPageState()` devolve `podePublicar: false` (`public/src/js/live.js:170`).
  O gatilho é navegar entre músicas, não clicar numa lista.
- **O setlist do app é a tabela `playlists`** (`itens` = `[{id, tom}]`), não
  `roteiros`, que é texto livre em HTML.
- **O WaveSurfer não pinta canvas em Chromium headless** — o `#waveform` fica com
  um `<div>` vazio. Por isso a cena de ensaio enquadra o transporte, os
  marcadores A/B e o pitch, deixando a waveform fora do quadro.
- **As cifras precisam ser longas.** Se couberem inteiras na tela, a cena de
  rolagem não rola e sobra espaço morto no celular.
