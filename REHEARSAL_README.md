# Modo Ensaio - Guia de Implementação

## ✅ Entregáveis Completados

### 1. **Arquivos JavaScript do Modulo**
Todos criados em `/src/js/rehearsal/`:
- `rehearsal.state.js` - Gerenciamento de estado localStorage (persistência)
- `rehearsal.youtube.js` - Parsing de URLs do YouTube e obtenção de metadados
- `rehearsal.pitch.js` - Integração SoundTouch e controle de pitch com semitons (-12 a +12)
- `rehearsal.audio.js` - Wrapper WaveSurfer v7 com suporte a Regions (A/B)
- `rehearsal.ui.js` - Inicialização de UI, event binding, atualização visual
- `rehearsal.bootstrap.js` - Entrypoint com coordenação de módulos e handlers

### 2. **Stylesheet**
- `/src/css/rehearsal.css` - Estilos responsivos para painel, controles, mensagens

### 3. **Backend PHP**
- `/src/backend/download-yt-audio.php` - Endpoint POST para converter YouTube → MP3
  - Suporta: ID de vídeo (11 chars) ou URLs completas
  - Requer `yt-dlp` no servidor
  - Retorna JSON com caminho do arquivo MP3

### 4. **Integração music.php**
- CSS rehearsal incluído no head
- Botão "Ensaio" adicionado ao menu de controles
- HTML do painel injetado abaixo da cifra
- Scripts (WaveSurfer, SoundTouch, módulos rehearsal) carregados no final

### 5. **Service Worker**
- `/service-worker.js` atualizado para cachear arquivos rehearsal

---

## 🚀 Como Usar

### **Iníciar Modo Ensaio**
1. Abrir `/music.php?id=1` (qualquer música)
2. Clicar botão "♥ Ensaio" no topo direito
3. Painel apareça abaixo da cifra

### **Fluxo Típico**

#### **Opção A: YouTube**
1. Clicar "Pesquisar no YouTube" → abre pesquisa
2. Copiar link do vídeo (ex: `https://youtu.be/dQw4w9WgXcQ`)
3. Colar no campo "inputYoutubeUrl"
4. Clicar "Vincular"
5. Aguardar download/conversão → "Audio loaded!" e waveform renderizado

#### **Opção B: Upload Local**
1. Selecionar arquivo (`.mp3`, `.wav`, `.ogg`)
2. Waveform renderizado automaticamente

### **Controles de Playback**
- **⏮ Início**: Vai para 0s
- **−1s**: Retrocede 1 segundo
- **▶ Play/Pause**: Toggle
- **+1s**: Avança 1 segundo
- **🔄 Loop**: Habilita repetiçāo (se houver A/B selecionado)

### **A/B Looping**
1. Clicar "Marcar A" no tempo desejado
2. Clicar "Marcar B" no fim do trecho
3. Clicar "🔄 Loop" para ativar repetição do trecho
4. Ao sair do fim (B), volta automaticamente para A

### **Pitch (Transposição)**
- **− / +**: Ajusta em semitons (-12..+12)
- **Reset**: Volta para 0
- Label mostra: "+2 semitons" (ex)
- Usa SoundTouch se disponível; fallback para pitch nativo (sem sincronização perfeita)

### **Persistência**
- Estado salvo em `localStorage` com chave `rehearsal:<musicId>`
- Ao reabrir: restaura URL YouTube, A/B, pitch, posição, loop
- **Nota**: Arquivo de áudio NÃO é persistido (usuário recarrega)

---

## 📋 Detalhes Técnicos

### **Estado localStorage (JSON)**
```json
{
  "youtubeVideoId": "dQw4w9WgXcQ",
  "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
  "youtubeTitle": "Rick Astley - Never Gonna Give You Up",
  "audioFileName": "audio.mp3",
  "pitchSemitones": 2,
  "loopEnabled": true,
  "region": { "A": 12.5, "B": 45.3 },
  "lastPositionSeconds": 28.1
}
```

### **Requisições API**
```http
POST /src/backend/download-yt-audio.php
Content-Type: application/json

{
  "videoId": "dQw4w9WgXcQ"
}
```

**Resposta:**
```json
{
  "success": true,
  "audioPath": "/rehearsal-audio/video_dQw4w9WgXcQ_Rich_Astley_Never_Gonna_Give_You_Up.mp3",
  "fileName": "video_dQw4w9WgXcQ_Rich_Astley_Never_Gonna_Give_You_Up.mp3",
  "videoId": "dQw4w9WgXcQ"
}
```

---

## 🔧 Dependências Externas

### **CDN (carregadas automaticamente)**
- **WaveSurfer v7**: `https://cdn.jsdelivr.net/npm/wavesurfer.js@7`
- **WaveSurfer Regions**: `https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/plugins/regions.js`
- **SoundTouchJS**: `https://cdn.jsdelivr.net/npm/soundtouchjs@1.2.8`

### **Backend (servidor)**
- **yt-dlp** (optional): Para download automático de vídeos YouTube
  - Instalação Ubuntu/Debian: `sudo apt install yt-dlp`
  - Instalação macOS: `brew install yt-dlp`
  - Se não tiver `yt-dlp`, usuário carrega MP3 manualmente

---

## ⚠️ Limitações & Notas

1. **Pitch + Audio Sync**: SoundTouch pode ter pequenas defasagens. MVP oferece a funcionalidade; versão futura pode sincronizar melhor via Web Audio API.

2. **Offline**: WaveSurfer + SoundTouch baixados de CDN → precisam de internet na primeira vez (cacheados após). Arquivo de áudio deve estar local ou baixado.

3. **Compatibilidade**: Testado em Chrome 90+, Firefox 88+, Safari 14+ (WebAudio API suportado)

4. **Tamanho**: Arquivos rehearsal são ~5-10KB cada, SoundTouch ~50KB.

5. **Armazenamento localStorage**: Limite típico ~5-10MB por aplicação (apenas estado é salvo, não áudio)

---

## 🧪 Testes Básicos

1. **Abrir music.php?id=1** → Página carrega
2. **Clicar Ensaio** → Painel aparece
3. **Upload MP3** → Waveform renderizado
4. **Play** → Som toca
5. **Set A, Set B** → Região marcada no waveform
6. **Loop ativo** → Toca de A até B, volta ao A
7. **Pitch +2** → Som mais agudo
8. **Reload página** → Estado restaurado (menos arquivo de áudio)

---

## 📝 Próximos Passos (Opcional)

- [ ] Integrar yt-dlp em container Docker (se usar)
- [ ] Cache de áudios convertidos em pasta `rehearsal-audio/`
- [ ] UI para limpar cache de áudios antigos
- [ ] Histório de pitchchanges por música
- [ ] Sincronizar A/B com cifra (highlight linhas)
- [ ] Testes E2E com Playwright

---

## 📞 Suporte

Para dúvidas sobre integração:
1. Verificar console do navegador (`F12`) para erros
2. Confirmar WaveSurfer + SoundTouch carregando (Network tab CDN)
3. Verificar localStorage: `localStorage.getItem('rehearsal:1')`
4. Testar arquivo MP3 local antes de YouTube

