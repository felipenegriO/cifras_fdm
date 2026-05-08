# Guia Hostinger - Modo Ensaio (Websites)

## ✅ Boas Notícias!

A conversão YouTube → MP3 agora **funciona em Hostinger** sem precisar instalar `yt-dlp`. Usa APIs públicas de conversão online.

## 🚀 Setup Hostinger (Websites)

### Passo 1: Criar pasta de cache
1. Via FileManager (Hostinger):
   - Acesse `/public_html/` (ou seu document root)
   - Crie pasta: `rehearsal-audio/`
   - Permissões: `755`

### Passo 2: Nada mais necessário!
O resto é automático. Os scripts já estão integrados.

---

## 📱 Como Usar

### **Fluxo 1: Conversão Automática (Tentar primeiro)**
1. Abrir `/music.php?id=1`
2. Clicar "♥ Ensaio"
3. Colar link do YouTube (ex: `https://youtu.be/dQw4w9WgXcQ`)
4. Clicar "Vincular"
5. **Aguardar 30-60s** → Audio loads automaticamente

✅ **Se funcionar**: Pronto! Desfrute do Modo Ensaio.

### **Fluxo 2: Conversão Manual (Se automática falhar)**
Se a mensagem disser *"Conversão automática indisponível"*:

1. Abrir um conversor online:
   - 🌐 **[y2mate.com](https://y2mate.com/)**
   - 🌐 **[convertio.co](https://convertio.co/)**
   - 🌐 **[onlineconverter.com](https://onlineconverter.com/)**

2. Colar link do YouTube
3. Converter para MP3
4. Fazer download do arquivo
5. **Voltar ao Modo Ensaio**
6. Clicar "Carregar Áudio"
7. Selecionar o MP3 baixado
8. ✅ Pronto!

### **Fluxo 3: Upload Local Direto (Mais rápido)**
Se já tiver um MP3:
1. Abrir Modo Ensaio
2. Clique em "Carregar Áudio"
3. Selecionar arquivo
4. ✅ Waveform renderizado em segundos

---

## ⚙️ Arquitetura (Hostinger-Compatible)

```
Usuário clica "Vincular YouTube"
         ↓
Extrai video ID (11 chars)
         ↓
Busca metadados (oEmbed Google API) ← Sempre funciona
         ↓
Tenta converter via APIs públicas:
   1️⃣  y2mate.com API
   2️⃣  ezdownloader.com API
   3️⃣  getfbstuff.com API
         ↓
   ✅ Se sucesso → Downloaded MP3 para /rehearsal-audio/
   ❌ Se falha → Avisa usuário para converter manualmente
         ↓
Carrega arquivo local no WaveSurfer
```

---

## 🔧 Troubleshooting

### Problema: "Convert indisponível" sempre
**Causa**: APIs públicas podem estar bloqueadas ou lentas

**Solução**:
- ✅ Use Fluxo 2 (manual on y2mate.com)
- ✅ Upload MP3 direto (Fluxo 3)
- 💡 Tente novamente em outro horário

### Problema: Pasta "rehearsal-audio" não criada
**Causa**: Permissões insuficientes

**Solução**:
1. Via Hostinger File Manager: 
   - Crie pasta manualmente
   - Clic direito → Permissions → 755

### Problema: Arquivo baixado é muito pequeno
**Causa**: API retornou erro disfarçado

**Solução**:
- Verifique URL do YouTube é válida
- Tente converter manualmente

### Problema: MP3 local carrega mas sem som
**Causa**: Arquivo corrompido ou formato inválido

**Solução**:
- Use conversor online respeitável (y2mate.com)
- Teste arquivo no seu celular primeiro

---

## 📊 Comparação Fluxos

| Fluxo | Tempo | Dificuldade | Taxa Sucesso |
|-------|-------|------------|--------------|
| 1️⃣ Automático | 30-60s | Muito fácil | 60-80% |
| 2️⃣ Manual Online | 2-3 min | Fácil | 99% |
| 3️⃣ Upload Local | 5-10s | Fácil | 100% |

**Recomendação**: Tente Fluxo 1; se falhe, use Fluxo 2. Fluxo 3 é fallback rápido.

---

## 💾 Armazenamento

- **Pasta**: `/public_html/rehearsal-audio/` (seu servidor Hostinger)
- **Quota**: Máximo ~500MB recomendado (limpar antigos se necessário)
- **Acesso**: Privado (dentro do app), não listado publicamente

---

## 🌐 URLs Conversores (Offline Recomendado)

Se internet for lenta, download a app:
- **y2mate**: https://y2mate.com/
- **4K Video Downloader**: https://www.4kdownloaderapps.com/ (app local melhor)
- **VLC Media Player**: Pode converter (menu → Media → Convert)

---

## ✅ Checklist Setup

- [ ] Pasta `/rehearsal-audio/` criada (755)
- [ ] Acessar `/music.php?id=1` funciona
- [ ] Botão "♥ Ensaio" visível
- [ ] Testar com MP3 local (upload)
- [ ] _(Opcional)_ Testar conversão YouTube automática
- [ ] _(Opcional)_ Salvar link conversor em favoritos

---

## 📝 Notas

- Conversão automática é **"best-effort"**: APIs públicas podem cair
- **Fallback sempre disponível**: Conversor online + upload
- Estado Modo Ensaio é persistido em **localStorage** (browser)
- Cada música tem seu próprio state: `rehearsal:123`, `rehearsal:456`, etc.

---

## 🚨 Suporte

Qualquer erro no console (`F12` → Console)?
- Compartilhe mensagem exata
- Verifique URL de vídeo é válida
- Tente em outro navegador (Chrome → Firefox)

