# Modo Ensaio

## F-022 Reprodução

O painel de ensaio é integrado à visualização da música. Aceita áudio local e áudio obtido a partir de URL do YouTube. O estado é mantido por música no browser.

## F-023 Ferramentas

- reprodução, pausa e busca temporal;
- forma de onda e progresso;
- marcações A e B;
- repetição do trecho A/B;
- alteração de pitch entre -12 e +12 semitons;
- manutenção do estado relevante em `localStorage`.

Quando SoundTouch está disponível, pitch e velocidade são tratados separadamente; existe fallback por `playbackRate`.

## F-024 YouTube

O cliente valida e extrai o ID do vídeo, consulta metadados via oEmbed e chama `/src/backend/download-yt-audio.php`. O backend tenta provedores externos, salva arquivo no diretório de upload e devolve JSON com o caminho.

Essa funcionalidade depende de serviços externos e pode falhar por indisponibilidade, mudança de contrato, CORS, direitos de acesso ou limitação do provedor.

## Componentes

| Arquivo | Responsabilidade |
|---|---|
| `rehearsal.state.js` | estado, validação e persistência |
| `rehearsal.youtube.js` | URL, ID, busca e metadados |
| `rehearsal.audio.js` | áudio, tempo e loop |
| `rehearsal.pitch.js` | processamento de pitch |
| `rehearsal.ui.js` | vínculo com a interface |
| `rehearsal.bootstrap.js` | inicialização e download |

## Testes

`rehearsal-mode.spec.js`, `rehearsal-audio-upload.spec.js`, `e2e-rehearsal-complete-flow.spec.js`, `17-download-yt.spec.js`.

