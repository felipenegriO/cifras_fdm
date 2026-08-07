# Abas de seleção de fonte — Painel de Ensaio

Data: 2026-08-04

## Contexto

O painel de ensaio (`#modo-ensaio` em `public/src/Views/music.php`) hoje expõe simultaneamente todas as opções de entrada de fonte (campo de URL do YouTube + input de arquivo de áudio) junto com os controles de ensaio (play, pitch, A/B). O usuário precisa rolar/escanear para entender o fluxo e não há uma sequência clara de "primeiro selecione a fonte, depois use os controles".

## Objetivo

Reorganizar o painel em estados sequenciais: o usuário primeiro escolhe a fonte (via aba), confirma num modal, aguarda o carregamento, e só então vê os controles de ensaio — sem mudar o comportamento técnico subjacente.

## Fluxo

```
Abrir painel
     ↓
[Estado: abas]  ─── clica "YouTube" ──→  [Modal YouTube]
                                              ↓ colar link + Vincular
                                         [Estado: carregando]
                                              ↓ download pronto
                                         [Estado: controles ativos]
                │
                └── clica "Áudio" ────→  [Modal Áudio]
                                              ↓ escolher arquivo + Carregar
                                         [Estado: controles ativos]

Fechar painel → reabrir → [Estado: abas]  (fonte descartada, igual ao hoje)
```

Se já existe fonte carregada na sessão ao abrir o painel, vai diretamente para "controles ativos" sem passar pelas abas.

## Estados do `#modo-ensaio`

Controlados por classe CSS no elemento raiz do painel:

| Classe | O que aparece |
|---|---|
| `.rehearsal--tabs` | Duas abas grandes: "🎬 YouTube" e "🎵 Áudio local" |
| `.rehearsal--loading` | Spinner/mensagem de progresso (`#rehearsalMessage` já existente) |
| `.rehearsal--active` | Controles de ensaio (`#rehearsalControls`, `#rehearsalAB`, `#rehearsalPitch`, waveform) |

O HTML de todas as seções permanece no DOM — só a visibilidade muda via CSS por classe de estado.

## Modal de seleção de fonte

Overlay sobre o painel (não sobre a página), fechado por padrão. Controlado por classe `.rehearsal-modal--open`.

**Aba YouTube:**
- Campo de texto: "Colar link do YouTube"
- Botão "Vincular": valida com `Rehearsal.youtube.extractYoutubeVideoId` (já existe). Erro → mensagem inline no modal, não fecha. Sucesso → fecha modal, transita para `.rehearsal--loading`, inicia download (mesmo fluxo do `btnVincularYoutube` atual).
- Botão "×": fecha modal, volta para `.rehearsal--tabs`, sem ação.

**Aba Áudio:**
- `input type="file" accept="audio/*"`: ao selecionar arquivo já confirma (sem botão extra necessário, igual ao `inputAudio` atual).
- Botão "×": fecha modal, volta para `.rehearsal--tabs`.

## Transições de estado

`rehearsal.bootstrap.js` — ao ativar o painel:
- Verifica se já existe fonte carregada → se sim, seta `.rehearsal--active` direto.
- Se não → seta `.rehearsal--tabs`.

`rehearsal.ui.js` — adiciona lógica de transição:
- Clique nas abas → abre modal correspondente.
- Confirmação de fonte → fecha modal + transita para `.rehearsal--loading` (YouTube) ou `.rehearsal--active` (áudio, que é imediato).
- Download concluído → transita para `.rehearsal--active`.
- Erro de download → volta para `.rehearsal--tabs` + exibe mensagem de erro (já existe via `#rehearsalMessage`).
- Fechar painel → estado é resetado para `.rehearsal--tabs` na próxima abertura.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `public/src/Views/music.php` | Estrutura HTML do `#modo-ensaio`: adicionar wrapper de abas e modal interno; mover seções existentes para classes de estado |
| `public/src/js/rehearsal/rehearsal.ui.js` | Lógica de transição entre estados e abertura/fechamento do modal interno |
| `public/src/js/rehearsal/rehearsal.bootstrap.js` | Verificação de fonte existente ao ativar o painel |
| `public/src/css/rehearsal.css` | Estilos das abas, modal interno e visibilidade por estado |

## Fora de escopo

- Troca de fonte sem fechar o painel (para trocar, fecha e reabre).
- Preview de thumbnail/título do YouTube antes de confirmar (futuro).
- Persistência da fonte entre sessões (já existe via localStorage, não muda).
