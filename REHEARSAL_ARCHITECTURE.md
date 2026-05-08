# Arquitetura Modo Ensaio

## Estrutura de Arquivos

```
/src/
├── js/
│   └── rehearsal/
│       ├── rehearsal.state.js       # localStorage abstraction + normalization
│       ├── rehearsal.youtube.js     # YouTube URL parsing + metadata fetch
│       ├── rehearsal.pitch.js       # SoundTouch integration + WebAudio player
│       ├── rehearsal.audio.js       # WaveSurfer wrapper + Regions plugin
│       ├── rehearsal.ui.js          # DOM binding + event handlers
│       └── rehearsal.bootstrap.js   # Main coordinator + lifecycle
├── css/
│   └── rehearsal.css                # Panel styles + responsive layout
└── backend/
    └── download-yt-audio.php        # YouTube download endpoint

/rehearsal-audio/                    # Converted MP3 files storage

```

## Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   [Toggle Ensaio]   [YouTube URL]    [Audio Upload]
        │                │                   │
        ├────────────────▶├───────────────┐  │
        │                │               │  │
    rehearsal.ui         │     YouTube   │  │
     .initUI()          │     metadata   │  │
        │                │       fetch   │  │
        │                ▼               │  │
        │         [download-yt-audio.php]  │
        │                │               │  │
        │                ▼               ▼  ▼
        │         [Audio Blob] ◄─────────────┘
        │                │
        ├────────────────▼──────────────┐
        │                               │
        │      rehearsal.pitch         │
        │      .createPitchPlayer()    │
        │        (WebAudio +           │
        │         SoundTouch)          │
        │                               │
        └───────────┬────────┬──────────┘
                    │        │
               [Player]  [Playback]
                    │        │
                    ▼        ▼
        ┌───────────────────────────────┐
        │   rehearsal.audio             │
        │   .createWaveform()           │
        │   (WaveSurfer + Regions)      │
        └───────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │    rehearsal.state            │
        │    .saveState()               │
        │    (localStorage)             │
        └───────────────────────────────┘
```

## Módulos & Responsabilidades

### `rehearsal.state.js`
**Responsável**: Persistência e validação de estado

**Exports**:
- `loadState(musicId)` → objeto normalizado
- `saveState(musicId, state)` → void
- `normalizeState(raw)` → objeto validado

**localStorage key**: `rehearsal:<musicId>`

---

### `rehearsal.youtube.js`
**Responsável**: Extração e validação de URLs YouTube, busca de metadados

**Exports**:
- `extractYoutubeVideoId(input)` → string (11 chars) | null
- `getThumbnailUrl(videoId)` → string (URL imagem)
- `fetchYoutubeMeta(videoId)` → Promise<{title, thumbnailUrl}> | null
- `buildSearchUrl(title)` → string (URL pesquisa)

**Handles**:
- youtube.com/watch?v=ID
- youtu.be/ID
- youtube.com/shorts/ID
- youtube.com/embed/ID
- ID direto (11 chars)

---

### `rehearsal.pitch.js`
**Responsável**: Controle de pitch via SoundTouch + fallback WebAudio nativo

**Exports**:
- `createPitchPlayer(options)` → player object

**Player API**:
- `loadFile(fileOrBlob)` → Promise
- `play()`, `pause()`, `toggle()` → void
- `seek(seconds)` → void
- `setPitchSemitones(n)` → void (-12..+12)
- `getPitchSemitones()` → number
- `getCurrentTime()` → number
- `getDuration()` → number
- `isPlaying()` → boolean

**Callbacks**:
- `onTimeUpdate(currentTime)` - atualização contínua de posição
- `onEnded()` - fim do áudio
- `onStatus(message)` - status textual

---

### `rehearsal.audio.js`
**Responsável**: Wrapper WaveSurfer + Regions plugin

**Exports**:
- `createWaveform(options)` → waveform object

**Waveform API**:
- `loadBlob(fileOrBlob)` → Promise
- `setRegion(start, end)` → void
- `clearRegion()` → void
- `setTime(seconds)` → void
- `getDuration()` → number
- `isReady()` → boolean
- `wavesurfer` (instância raw acessível)

**Callbacks**:
- `onSeek(seconds)` - usuario clicou no waveform
- `onRegionChange(start, end)` - region A/B alterado

---

### `rehearsal.ui.js`
**Responsável**: Binding DOM + event listeners + state visual

**Exports**:
- `initUI(handlers)` → {panel, inputYoutubeUrl, inputAudio, controls}
- `setLoopActive(isActive)` → void
- `setPlayState(isPlaying)` → void
- `setPitchLabel(semitones)` → void
- `setYoutubePreview(meta)` → void
- `setAudioFileName(name)` → void
- `showMessage(text, type)` → void
- `setControlsEnabled(enabled)` → void

**IDs esperados no HTML**:
```
#btnAtivarEnsaio      (toggle painel)
#modo-ensaio          (painel container)
#btnAbrirYoutube      (search button)
#inputYoutubeUrl      (URL input)
#btnVincularYoutube   (bind button)
#ytThumb              (thumbnail img)
#ytPreview            (preview container)
#ytTitle              (title span)
#inputAudio           (file input)
#waveform             (container)
#btnInicio            (transport: start)
#btnMinus1, #btnPlayPause, #btnPlus1, #btnLoop
#btnSetA, #btnSetB, #btnClearAB
#btnPitchDown, #btnPitchUp, #btnPitchReset
#pitchLabel           (display label)
#rehearsalMessage     (error/success message)
#audioFileName        (file info)
```

---

### `rehearsal.bootstrap.js`
**Responsável**: Inicialização + coordenação de módulos + lifecycle

**Flow**:
1. Detecta musicId de query string
2. Carrega estado do localStorage
3. Inicializa UI
4. Cria instâncias WaveSurfer + SoundTouch player
5. Bind event handlers (play, pitch, A/B, etc)
6. Inicia auto-save interval (2s)

**Salva estado em**:
- Toggle on/off painel
- Mudar A/B
- Toggle loop
- Alterar pitch
- A cada 2s (lastPositionSeconds)
- beforeunload

---

## Fluxo de "YouTube → MP3"

```
User: "Vincular YouTube"
      ▼
[rehearsal.youtube.extractYoutubeVideoId]
      ▼
POST /src/backend/download-yt-audio.php
      ▼
[yt-dlp --extract-audio --audio-format mp3]
      ▼
Arquivo salvo em /rehearsal-audio/
      ▼
Response JSON com audioPath
      ▼
fetch(audioPath) → Blob
      ▼
player.loadFile(blob)
      ▼
waveform.loadBlob(blob)
      ▼
UI atualiza: estado salvo, waveform renderizado
```

---

## Fluxo de "Upload Local"

```
User: File input change
      ▼
File object
      ▼
player.loadFile(file)
      ▼
waveform.loadBlob(file)
      ▼
UI atualiza: estado salvo
```

---

## Fluxo de "Play com Loop A/B"

```
play()
  ▼
player.play() [inicia playback]
  ▼
Update loop a cada frame:
  ├─ currentTime aumenta
  ├─ Se loopEnabled && A != null && B != null:
  │   └─ Se currentTime > B → player.seek(A)
  ▼
onTimeUpdate callback:
  └─ waveform.setTime(currentTime)
     [WaveSurfer cursor se move]
  ▼
pause quando ui.btnPlayPause clicado
  ▼
state.lastPositionSeconds = currentTime
```

---

## Fluxo de "Pitch Change"

```
btnPitchUp clicado
  ▼
currentPitch += 1
  ▼
player.setPitchSemitones(newPitch)
  ▼
Se usando SoundTouch:
  └─ soundTouch.pitch = 2^(semitones/12)
     + reinicia playback do mesmo currentTime
  
Se fallback:
  └─ nativeSource.playbackRate.value = 2^(semitones/12)
     + reinicia playback
  ▼
UI update:
  └─ label.textContent = "+2 semitons"
  ▼
state.pitchSemitones = newPitch
state.saveState()
```

---

## Armazenamento Estado

```javascript
// localStorage['rehearsal:123'] =
{
  "youtubeVideoId": "dQw4w9WgXcQ",
  "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
  "youtubeTitle": "Rick Astley - Never Gonna Give You Up",
  "audioFileName": "video_dQw4w9WgXcQ_Rick_Astley.mp3",
  "pitchSemitones": 2,
  "loopEnabled": true,
  "region": {
    "A": 12.456,
    "B": 45.678
  },
  "lastPositionSeconds": 28.123
}
```

**Validação**:
- `youtubeVideoId`, `youtubeUrl`, `youtubeTitle`, `audioFileName`: string | ""
- `pitchSemitones`: -12..+12
- `loopEnabled`: boolean
- `region.A`, `region.B`: null | 0..Infinity
- `lastPositionSeconds`: 0..Infinity

---

## Considerações de Performance

1. **WaveSurfer + SoundTouch**: ~5MB memória (decodificado)
2. **SoundTouch processamento**: ~10-15ms por frame (desktop)
3. **Auto-save**: Throttle de 2s para não sobrecarregar localStorage
4. **Caching Service Worker**: Scripts rehearsal e CSS ficam cache-first após primeiro carregamento

---

## Compatibilidade Navegadores

| Navegador | Versão | Status |
|-----------|--------|--------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full (sem SoundTouch, fallback nativo) |
| Edge | 90+ | ✅ Full |
| Mobile Chrome | 90+ | ✅ Full |
| Mobile Safari | 14+ | ✅ Full |

---

## Tratamento de Erros

| Erro | Manejo |
|------|--------|
| WaveSurfer CDN indisponível | Console warning; painel não renderiza waveform |
| SoundTouch CDN indisponível | Usa fallback WebAudio nativo (pitch pode ser menos suave) |
| yt-dlp não instalado | Endpoint retorna erro 503; usuário carrega MP3 manualmente |
| localStorage cheio | console.warn; estado não persiste |
| Arquivo áudio inválido | showMessage("Failed to load audio"); controles desabilitados |
| YouTube URL inválida | showMessage("Invalid YouTube URL"); campo fica vazio |

