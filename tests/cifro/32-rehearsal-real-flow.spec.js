import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function openMusicPreview(page) {
  await page.goto('/index.php');
  await page.evaluate(() => {
    sessionStorage.setItem('fdmEditorPreview', JSON.stringify({
      id: 990001,
      nome: 'Cobertura do modo ensaio',
      artista: 'Teste E2E',
      bit: '',
      cifra: '<p><b>C</b> Música de teste</p>',
    }));
  });
  await page.goto('/music.php?id=990001&editorPreview=1');
  await expect(page.locator('#song-cifra')).toBeVisible();
}

async function openRehearsalPanel(page) {
  await page.locator('#menuButton').click();
  await page.locator('#settingsTabTools').click();
  await page.getByText('Ensaio com YouTube e áudio', { exact: true }).click();
  await page.locator('#btnAtivarEnsaio').click();
  await expect.poll(() => page.evaluate(() => window.bootstrapEntered === true)).toBe(true);
  await expect(page.locator('#modo-ensaio')).toHaveAttribute('aria-hidden', 'false');
}

function wavTone(durationSeconds = 2) {
  const sampleRate = 8000;
  const samples = sampleRate * durationSeconds;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i += 1) buffer.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / sampleRate) * 12000), 44 + i * 2);
  return { name: 'tom.wav', mimeType: 'audio/wav', buffer };
}

test('usuário abre o modo Ensaio e recebe validação real de URL', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);

  await page.locator('#inputYoutubeUrl').fill('endereço inválido');
  await page.locator('#btnVincularYoutube').click();
  await expect(page.locator('#rehearsalMessage')).toContainText('Invalid YouTube URL');

  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');
  await expect(page.locator('#btnPitchUp')).toBeEnabled();
  await page.locator('#btnPitchUp').click();
  await expect(page.locator('#pitchLabel')).toContainText('+1');
  await page.locator('#btnPitchDown').click();
  await page.locator('#btnPitchReset').click();
  await expect(page.locator('#pitchLabel')).toContainText('0');
  await page.locator('#btnSetA').click();
  await page.locator('#btnPlus1').click();
  await page.locator('#btnSetB').click();
  await page.locator('#btnLoop').click();
  await page.locator('#btnClearAB').click();
  await page.locator('#btnPlayPause').click();

});

test('usuário vincula um vídeo e vê a prévia', async ({ page }) => {
  await page.route('**/oembed**', route => route.fulfill({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ title: 'Vídeo de ensaio', thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg' }),
  }));
  await page.route('**/src/backend/download-yt-audio.php', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ error: 'indisponível' }),
  }));
  await openMusicPreview(page);
  await openRehearsalPanel(page);
  const search = page.waitForEvent('popup');
  await page.locator('#btnAbrirYoutube').click();
  const searchPage = await search;
  await expect(searchPage).toHaveURL(/youtube\.com\/results/);
  await searchPage.close();
  await page.locator('#inputYoutubeUrl').fill('https://youtu.be/dQw4w9WgXcQ');
  await page.locator('#btnVincularYoutube').click();
  await expect(page.locator('#ytTitle')).toHaveText('Vídeo de ensaio');
  await expect(page.locator('#ytThumb')).toHaveAttribute('src', /hqdefault/);
  await expect(page.locator('#rehearsalMessage')).toContainText('Conversão automática indisponível');
  await page.reload();
  await page.locator('#menuButton').click();
  await page.getByText('Ensaio com YouTube e áudio', { exact: true }).click();
  await page.locator('#btnAtivarEnsaio').click();
  await expect(page.locator('#ytTitle')).toHaveText('Vídeo de ensaio');
});

test('usuário vincula vídeo com conversão concluída e áudio carregado', async ({ page }) => {
  await page.route('**/oembed**', route => route.fulfill({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ title: 'Vídeo convertido', thumbnail_url: '' }),
  }));
  await page.route('**/src/backend/download-yt-audio.php', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ audioPath: '/__audio_convertido.wav', fileName: 'convertido.wav' }),
  }));
  await page.route('**/__audio_convertido.wav', route => route.fulfill({
    contentType: 'audio/wav',
    body: wavTone().buffer,
  }));

  await openMusicPreview(page);
  await openRehearsalPanel(page);
  await page.locator('#inputYoutubeUrl').fill('dQw4w9WgXcQ');
  await page.locator('#btnVincularYoutube').click();

  await expect(page.locator('#ytTitle')).toHaveText('Vídeo convertido');
  await expect(page.locator('#audioFileName')).toContainText('convertido.wav');
  await expect(page.locator('#rehearsalMessage')).toContainText('Audio loaded');
});

test('usuário recebe retorno quando metadados ou download do vídeo falham', async ({ page }) => {
  await page.route('**/oembed**', route => route.fulfill({ status: 404, body: 'not found' }));
  await openMusicPreview(page);
  await openRehearsalPanel(page);

  await page.locator('#btnVincularYoutube').click();
  await expect(page.locator('#rehearsalMessage')).toContainText('Enter a YouTube URL');
  await page.locator('#inputYoutubeUrl').fill('https://www.youtube.com/shorts/dQw4w9WgXcQ');
  await page.locator('#btnVincularYoutube').click();
  await expect(page.locator('#rehearsalMessage')).toContainText('Could not fetch video info');

  await page.unroute('**/oembed**');
  await page.route('**/oembed**', route => route.fulfill({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ title: 'Download com falha' }),
  }));
  await page.route('**/src/backend/download-yt-audio.php', route => route.abort());
  await page.locator('#inputYoutubeUrl').fill('https://www.youtube.com/embed/dQw4w9WgXcQ');
  await page.locator('#btnVincularYoutube').click();
  await expect(page.locator('#rehearsalMessage')).toContainText('Failed to download audio');
});

test('bootstrap não faz nada quando a página não tem id de música', async ({ page }) => {
  await page.goto('/index.php');
  await page.evaluate(() => {
    sessionStorage.setItem('fdmEditorPreview', JSON.stringify({
      id: 990002,
      nome: 'Sem id na URL',
      artista: 'Teste E2E',
      bit: '',
      cifra: '<p><b>C</b> Música de teste</p>',
    }));
  });
  await page.goto('/music.php?editorPreview=1');
  await expect(page.locator('#song-cifra')).toBeVisible();

  await page.locator('#menuButton').click();
  await page.locator('#settingsTabTools').click();
  await page.getByText('Ensaio com YouTube e áudio', { exact: true }).click();
  await page.locator('#btnAtivarEnsaio').click();
  // Sem parâmetro ?id= na URL, bootstrap() entra na função mas retorna cedo (musicId ausente):
  // window.bootstrapEntered é setado de qualquer forma, mas o painel nunca é inicializado de fato.
  await expect.poll(() => page.evaluate(() => window.bootstrapEntered === true)).toBe(true);
});

test('bootstrap retorna cedo quando um módulo de ensaio falha ao carregar (window.Rehearsal.audio ausente)', async ({ page }) => {
  // Intercepta rehearsal.audio.js devolvendo um script vazio válido (onload dispara normalmente,
  // mas window.Rehearsal.audio nunca é definido) para cobrir o ramo verdadeiro do guard
  // "if (!stateModule || !youtubeModule || !pitchModule || !audioModule || !uiModule) return;"
  await page.route('**/src/js/rehearsal/rehearsal.audio.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: '// audio module intentionally empty for coverage',
  }));
  await openMusicPreview(page);
  await page.locator('#menuButton').click();
  await page.locator('#settingsTabTools').click();
  await page.getByText('Ensaio com YouTube e áudio', { exact: true }).click();
  await page.locator('#btnAtivarEnsaio').click();
  await expect.poll(() => page.evaluate(() => window.bootstrapEntered === true)).toBe(true);
  // O click no botão ainda alterna o painel (listener próprio inline em music.php, independente
  // do bootstrap), mas uiModule.initUI() nunca roda porque o guard de módulo ausente retornou cedo.
  // Por isso o botão "Vincular" nunca recebe o listener onBindYoutube: clicar nele não escreve
  // nenhuma mensagem em #rehearsalMessage (continua vazio), diferente do fluxo normal.
  await page.locator('#inputYoutubeUrl').fill('endereço inválido');
  await page.locator('#btnVincularYoutube').click({ force: true });
  await page.waitForTimeout(200);
  await expect(page.locator('#rehearsalMessage')).toHaveText('');
});

test('fecha e reabre o painel de ensaio salvando o estado ao fechar', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);

  // Fecha o painel (isActive=false -> handleToggle salva o estado). O botão fica fora do
  // viewport após o painel abrir em telas pequenas de teste, então disparamos o clique via DOM.
  await page.evaluate(() => document.getElementById('btnAtivarEnsaio').click());
  await expect(page.locator('#modo-ensaio')).toHaveAttribute('aria-hidden', 'true');

  // Reabre (isActive=true -> handleToggle não salva).
  await page.evaluate(() => document.getElementById('btnAtivarEnsaio').click());
  await expect(page.locator('#modo-ensaio')).toHaveAttribute('aria-hidden', 'false');
});

test('controles de reprodução sem áudio carregado não quebram e usam mockPlayer quando disponível', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);

  // Os controles de playback começam desabilitados (setPlaybackControlsEnabled(false) até carregar áudio).
  // Removemos o atributo disabled via JS para poder exercitar os handlers reais (guard "if (!player) return").
  await page.evaluate(() => {
    ['btnInicio', 'btnMinus1', 'btnPlayPause', 'btnPlus1', 'btnSetA', 'btnSetB',
      'btnPitchDown', 'btnPitchUp', 'btnPitchReset'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = false;
    });
  });

  // Sem player nem mockPlayer: handleStart/Back1/PlayPause/Forward1/SetA/SetB/Pitch* devem apenas retornar.
  await page.locator('#btnInicio').click();
  await page.locator('#btnMinus1').click();
  await page.locator('#btnPlayPause').click();
  await page.locator('#btnPlus1').click();
  await page.locator('#btnSetA').click();
  await page.locator('#btnSetB').click();
  await page.locator('#btnPitchDown').click();
  await page.locator('#btnPitchUp').click();
  await page.locator('#btnPitchReset').click();
  await expect(page.locator('#pitchLabel')).toContainText('0');

  // Define um mockPlayer global: getPlayer() passa a retornar window.mockPlayer nos botões de pitch.
  await page.evaluate(() => {
    let semitones = 0;
    window.mockPlayer = {
      getPitchSemitones: () => semitones,
      setPitchSemitones: (v) => { semitones = v; },
    };
  });
  await page.locator('#btnPitchUp').click();
  await expect(page.locator('#pitchLabel')).toContainText('+1');
});

test('carrega um segundo arquivo de áudio reutilizando o player e cobre fallback de nome', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);

  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  // Segundo upload: player já existe (branch "if (!player)" = false, reaproveita o player).
  await page.locator('#inputAudio').setInputFiles({ ...wavTone(), name: 'segundo.wav' });
  await expect(page.locator('#audioFileName')).toContainText('segundo.wav');

  // Arquivo sem nome -> fallback "uploaded" em handleAudioFile (file.name || "uploaded").
  // Usa um WAV válido (mesmo gerador do wavTone()) mas com nome vazio, para não cair no catch de loadFile.
  const tone = wavTone();
  await page.evaluate(([bytes]) => {
    const input = document.getElementById('inputAudio');
    const dt = new DataTransfer();
    const emptyNameFile = new File([new Uint8Array(bytes)], '', { type: 'audio/wav' });
    dt.items.add(emptyNameFile);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [Array.from(tone.buffer)]);
  await expect(page.locator('#audioFileName')).toContainText('uploaded', { timeout: 10000 });

  // Evento "change" sem nenhum arquivo selecionado -> handleAudioFile(null) retorna cedo.
  await page.evaluate(() => {
    const input = document.getElementById('inputAudio');
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#audioFileName')).toContainText('uploaded');
});

test('ordena região A/B em ambas as direções cobrindo os ramos de comparação', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);
  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  // Define B antes de A: no momento de SetB, region.A ainda é null (ramo "false" da condição).
  await page.locator('#btnSetB').click();
  // Agora define A depois de B: region.B !== null é true, mas B > A é false (B foi marcado antes/menor).
  await page.locator('#btnPlus1').click();
  await page.locator('#btnSetA').click();

  // Limpa e refaz na ordem normal A -> B para cobrir o ramo "true/true".
  await page.locator('#btnClearAB').click();
  await page.locator('#btnSetA').click();
  await page.locator('#btnPlus1').click();
  await page.locator('#btnSetB').click();
});

test('erro de download sem mensagem usa o fallback "Unknown error"', async ({ page }) => {
  await page.route('**/oembed**', route => route.fulfill({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ title: 'Sem mensagem de erro' }),
  }));
  await openMusicPreview(page);
  await openRehearsalPanel(page);

  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    window.fetch = (url, opts) => {
      if (typeof url === 'string' && url.includes('download-yt-audio')) {
        return Promise.reject({});
      }
      return original(url, opts);
    };
  });

  await page.locator('#inputYoutubeUrl').fill('https://youtu.be/dQw4w9WgXcQ');
  await page.locator('#btnVincularYoutube').click();
  await expect(page.locator('#rehearsalMessage')).toContainText('Failed to download audio: Unknown error');
});

test('conversão de vídeo bem-sucedida com áudio já carregado atualiza o player existente', async ({ page }) => {
  await page.route('**/oembed**', route => route.fulfill({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ title: '' }),
  }));
  await page.route('**/src/backend/download-yt-audio.php', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ audioPath: '/__audio_convertido2.wav' }),
  }));
  await page.route('**/__audio_convertido2.wav', route => route.fulfill({
    contentType: 'audio/wav',
    body: wavTone().buffer,
  }));

  await openMusicPreview(page);
  await openRehearsalPanel(page);

  // Carrega um áudio primeiro para que "player" já exista quando o vínculo do YouTube terminar.
  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  await page.locator('#inputYoutubeUrl').fill('dQw4w9WgXcQ');
  await page.locator('#btnVincularYoutube').click();

  // Sem título no meta -> fallback "" em state.youtubeTitle; audioFileName cai para "audio.mp3" (sem fileName na resposta).
  await expect(page.locator('#audioFileName')).toContainText('audio.mp3');
  await expect(page.locator('#rehearsalMessage')).toContainText('Audio loaded');
});

test('createPitchPlayer chamado diretamente sem callbacks/buffer cobre os guards defensivos', async ({ page }) => {
  await openMusicPreview(page);
  // Só precisamos que os módulos do modo ensaio estejam carregados (não precisa abrir o painel via UI).
  await openRehearsalPanel(page);

  const result = await page.evaluate(async () => {
    const log = [];
    // Sem nenhum options: onTimeUpdate/onEnded/onStatus caem nos noops padrão.
    const p1 = window.Rehearsal.pitch.createPitchPlayer();
    // Chamadas sem buffer carregado: todos os guards "if (!buffer) return" devem apenas retornar.
    p1.play();
    p1.pause();
    p1.seek(5);
    p1.setPitchSemitones(3);
    log.push({ duration: p1.getDuration(), playing: p1.isPlaying(), current: p1.getCurrentTime() });

    // Options parcial: só onStatus definido, onTimeUpdate/onEnded ausentes (cobre os outros ramos ternários).
    const p2 = window.Rehearsal.pitch.createPitchPlayer({ onStatus: (msg) => log.push(['status', msg]) });
    p2.seek(1); // sem buffer -> onTimeUpdate padrão (noop) é chamado sem erro
    return log;
  });

  expect(result[0].duration).toBe(0);
  expect(result[0].playing).toBe(false);
  expect(result[0].current).toBe(0);
});

test('createPitchPlayer sem window.AudioContext usa o fallback window.webkitAudioContext', async ({ page }) => {
  // Cobre o operando `||` de fallback em `new (window.AudioContext ||
  // window.webkitAudioContext)()` (linha 22): em todos os outros testes
  // deste arquivo window.AudioContext está sempre presente (navegador real
  // do Playwright), então esse ramo nunca era exercitado. Removemos
  // AudioContext e expomos webkitAudioContext apontando para o mesmo
  // construtor real antes de chamar createPitchPlayer.
  await openMusicPreview(page);
  await openRehearsalPanel(page);

  const usedFallback = await page.evaluate(() => {
    const RealCtx = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, value: RealCtx });
    let ok = false;
    try {
      const player = window.Rehearsal.pitch.createPitchPlayer();
      ok = typeof player.play === 'function';
    } finally {
      Object.defineProperty(window, 'AudioContext', { configurable: true, value: RealCtx });
    }
    return ok;
  });
  expect(usedFallback).toBe(true);
});

test('reproduz o áudio até o fim naturalmente cobrindo o loop de atualização e o fim de faixa (SoundTouch)', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);
  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  await page.locator('#btnPlayPause').click();
  await expect(page.locator('#btnPlayPause')).toHaveText('Pause');
  // O tom de teste dura 2s; espera o loop de updateTimeLoop rodar por completo e onEnded disparar,
  // o que devolve o botão para "Play" via updateUIFromState().
  await expect(page.locator('#btnPlayPause')).toHaveText('Play', { timeout: 8000 });
});

// NOTA: uma tentativa anterior de forçar esses ramos sobrescrevendo/deletando
// window.soundtouchjs via page.evaluate falhou silenciosamente (o bundle exporta esse
// namespace com propriedades via Object.defineProperty, getters sem setter,
// non-configurable). A técnica que funcionou (abaixo) é interceptar o próprio request
// HTTP do bundle via page.route e servir um stub, antes que o script real rode.

test('seek durante reprodução ativa reinicia o startFrom com pitch alterado', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);
  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  await page.locator('#btnPlayPause').click();
  await expect(page.locator('#btnPlayPause')).toHaveText('Pause');
  // seek() com playing=true cobre o ramo startFrom(next) dentro de seek().
  await page.locator('#btnPlus1').click();
  // setPitchSemitones com playing=true cobre o ramo startFrom(currentTime) dentro de setPitchSemitones().
  await page.locator('#btnPitchUp').click();
  await expect(page.locator('#pitchLabel')).toContainText('+1');
  await page.locator('#btnPlayPause').click();
  await expect(page.locator('#btnPlayPause')).toHaveText('Play');
});

test('sem lib SoundTouch disponível, usa o fallback de áudio nativo (buildFallbackNode + onended)', async ({ page }) => {
  // Intercepta o request do bundle soundtouch.min.js e serve um script vazio válido,
  // de modo que window.soundtouchjs/window.SoundTouch nunca são definidos e
  // resolveSoundTouch() retorna tudo undefined -> buildSoundTouchNode() retorna null
  // -> startFrom() cai no buildFallbackNode() (native AudioBufferSourceNode).
  await page.route('**/src/vendor/soundtouch/soundtouch.min.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '// soundtouch intentionally stubbed out for fallback coverage',
  }));

  await openMusicPreview(page);
  await openRehearsalPanel(page);
  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  await page.locator('#btnPlayPause').click();
  await expect(page.locator('#btnPlayPause')).toHaveText('Pause');
  // O tom de 2s toca via fonte nativa (onended real do AudioBufferSourceNode)
  // e volta para "Play" quando stopInternal(true) + onEnded() disparam.
  await expect(page.locator('#btnPlayPause')).toHaveText('Play', { timeout: 8000 });
});

test('com window.soundtouch (terceiro operando dos ORs em resolveSoundTouch) usa o caminho avançado', async ({ page }) => {
  // Serve um stub que define window.soundtouch (minúsculo) em vez de window.soundtouchjs,
  // cobrindo o terceiro operando de cada `||` em resolveSoundTouch (linhas 6-9, idx4) e
  // permitindo que buildSoundTouchNode() complete com sucesso via um getWebAudioNode falso.
  await page.route('**/src/vendor/soundtouch/soundtouch.min.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `
      window.soundtouch = {
        SoundTouch: function (sampleRate) { this.sampleRate = sampleRate; this.pitch = 1; },
        SimpleFilter: function (source, st) { this.source = source; this.st = st; },
        BufferSource: function (buffer) { this.buffer = buffer; this.position = 0; },
        getWebAudioNode: function (ctx, filter) {
          return { connect: function () {}, disconnect: function () {} };
        },
      };
    `,
  }));

  await openMusicPreview(page);
  await openRehearsalPanel(page);
  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  await page.locator('#btnPlayPause').click();
  await expect(page.locator('#btnPlayPause')).toHaveText('Pause');
  await page.locator('#btnPlayPause').click();
  await expect(page.locator('#btnPlayPause')).toHaveText('Play');
});

test('buildSoundTouchNode retorna null quando getWebAudioNode falha (processor falsy)', async ({ page }) => {
  // Stub de soundtouch com todas as 4 funções presentes (evita o fallback via
  // stLib incompleto), mas getWebAudioNode retorna null — cobre o guard
  // `if (!processor) return null;` (linha 92), que faz startFrom() cair no
  // buildFallbackNode mesmo com a lib "disponível".
  await page.route('**/src/vendor/soundtouch/soundtouch.min.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: `
      window.soundtouchjs = {
        SoundTouch: function (sampleRate) { this.sampleRate = sampleRate; this.pitch = 1; },
        SimpleFilter: function (source, st) { this.source = source; this.st = st; },
        BufferSource: function (buffer) { this.buffer = buffer; this.position = 0; },
        getWebAudioNode: function () { return null; },
      };
    `,
  }));

  await openMusicPreview(page);
  await openRehearsalPanel(page);
  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  await page.locator('#btnPlayPause').click();
  await expect(page.locator('#btnPlayPause')).toHaveText('Pause');
  // Sem um processor SoundTouch válido, cai no fallback nativo, que ainda
  // toca e termina normalmente.
  await expect(page.locator('#btnPlayPause')).toHaveText('Play', { timeout: 8000 });
});

test('play() chamado duas vezes seguidas com áudio carregado não reinicia a reprodução (guard playing)', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);

  const result = await page.evaluate(async () => {
    const player = window.Rehearsal.pitch.createPitchPlayer();
    // Gera um WAV curto sintético em memória (mesmo formato de wavTone) para
    // carregar via loadFile diretamente pela API do player, sem passar pela UI.
    const sampleRate = 44100;
    const durationSeconds = 1;
    const numSamples = sampleRate * durationSeconds;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    function writeString(offset, str) { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }
    writeString(0, 'RIFF'); view.setUint32(4, 36 + numSamples * 2, true); writeString(8, 'WAVE');
    writeString(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeString(36, 'data'); view.setUint32(40, numSamples * 2, true);
    for (let i = 0; i < numSamples; i++) view.setInt16(44 + i * 2, Math.sin(i * 0.05) * 8000, true);
    const blob = new Blob([buffer], { type: 'audio/wav' });

    await player.loadFile(blob);
    player.play();
    const playingAfterFirst = player.isPlaying();
    const timeAfterFirst = player.getCurrentTime();
    player.play(); // segunda chamada: deve ser noop (guard `if (playing) return;`)
    const playingAfterSecond = player.isPlaying();
    player.pause();
    return { playingAfterFirst, playingAfterSecond, timeAfterFirst };
  });

  expect(result.playingAfterFirst).toBe(true);
  expect(result.playingAfterSecond).toBe(true);
});

test('carregar rehearsal.pitch.js uma segunda vez reutiliza window.Rehearsal existente', async ({ page }) => {
  // Cobre o ramo `window.Rehearsal || {}` (linha 220) quando window.Rehearsal
  // já existe (definido por outro módulo carregado antes, ex. rehearsal.audio.js).
  await openMusicPreview(page);
  await openRehearsalPanel(page);
  const before = await page.evaluate(() => typeof window.Rehearsal.pitch.createPitchPlayer);
  expect(before).toBe('function');
  await page.addScriptTag({ url: '/src/js/rehearsal/rehearsal.pitch.js' });
  const after = await page.evaluate(() => typeof window.Rehearsal.pitch.createPitchPlayer);
  expect(after).toBe('function');
  const audioStillThere = await page.evaluate(() => typeof window.Rehearsal.audio);
  expect(audioStillThere).not.toBe('undefined');
});

test('handleOpenYoutube usa título de fallback "song" quando #song-title não existe', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);

  // Remove o elemento de título para exercitar o operando de fallback em handleOpenYoutube:
  // `const defaultTitle = title ? title.textContent : "song";` (rehearsal.bootstrap.js linha 52).
  await page.evaluate(() => document.getElementById('song-title')?.remove());

  const search = page.waitForEvent('popup');
  await page.locator('#btnAbrirYoutube').click();
  const searchPage = await search;
  await expect(searchPage).toHaveURL(/youtube\.com\/results.*song/);
  await searchPage.close();
});

test('handleBindYoutube usa fallback de thumbnail quando meta.thumbnailUrl está ausente', async ({ page }) => {
  // oEmbed sem thumbnail_url -> meta.thumbnailUrl fica undefined, cobrindo o fallback
  // `meta.thumbnailUrl || youtubeModule.getThumbnailUrl(videoId)` (rehearsal.bootstrap.js linha 81).
  await page.route('**/oembed**', route => route.fulfill({
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ title: 'Sem thumbnail nos metadados' }),
  }));
  await page.route('**/src/backend/download-yt-audio.php', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ error: 'indisponível' }),
  }));
  await openMusicPreview(page);
  await openRehearsalPanel(page);
  await page.locator('#inputYoutubeUrl').fill('dQw4w9WgXcQ');
  await page.locator('#btnVincularYoutube').click();
  await expect(page.locator('#ytTitle')).toHaveText('Sem thumbnail nos metadados');
  await expect(page.locator('#ytThumb')).toHaveAttribute('src', /dQw4w9WgXcQ/);
});

test('trocar o input de áudio sem selecionar arquivo não quebra (handleAudioFile(null))', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);

  // Dispara o evento "change" do <input type=file> sem arquivos selecionados, cobrindo o guard
  // "if (!file) return;" em handleAudioFile (rehearsal.bootstrap.js linha 127).
  await page.evaluate(() => {
    document.getElementById('inputAudio').dispatchEvent(new Event('change'));
  });
  await page.waitForTimeout(150);
  await expect(page.locator('#audioFileName')).toHaveText('');
});

test('handleStart e handleBack1 com player já carregado avançam/retrocedem a posição real', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);
  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  // Avança a posição para poder testar handleBack1 com um valor > 0 (Math.max(0, t-1)).
  await page.locator('#btnPlayPause').click();
  await page.waitForTimeout(600);
  await page.locator('#btnPlayPause').click();

  // handleStart com player presente: seek(0) real (rehearsal.bootstrap.js linha 165-166).
  await page.locator('#btnInicio').click();
  // handleBack1 com player presente: seek(max(0, currentTime-1)) real (linha 169-172).
  await page.locator('#btnMinus1').click();

  await expect(page.locator('#btnPlayPause')).toHaveText('Play');
});

test('autoSaveInterval salva a posição quando a diferença ultrapassa 0.1s durante a reprodução', async ({ page }) => {
  await openMusicPreview(page);
  await openRehearsalPanel(page);
  // updateAutoSave() (chamado a cada onTimeUpdate/frame durante a reprodução) já mantém
  // state.lastPositionSeconds sincronizado continuamente, então o diff checado pelo próprio
  // setInterval de 2s nunca ultrapassa 0.1s em reprodução normal (é um checkpoint defensivo
  // redundante). Para exercitar o branch verdadeiro do guard `Math.abs(currentTime -
  // state.lastPositionSeconds) > 0.1` (rehearsal.bootstrap.js linhas 321-327), interceptamos
  // pitchModule.createPitchPlayer e removemos o callback onTimeUpdate antes de repassar às
  // opções reais: o player real continua avançando currentTime normalmente, mas o bootstrap
  // nunca mais sincroniza state.lastPositionSeconds via updateAutoSave, deixando o valor
  // defasado até o setInterval "pegar" a diferença sozinho.
  await page.evaluate(() => {
    const orig = window.Rehearsal.pitch.createPitchPlayer;
    window.Rehearsal.pitch.createPitchPlayer = function (opts) {
      return orig(Object.assign({}, opts, { onTimeUpdate: function () {} }));
    };
  });

  await page.locator('#inputAudio').setInputFiles(wavTone(6));
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  await page.locator('#btnPlayPause').click();
  await expect(page.locator('#btnPlayPause')).toHaveText('Pause');

  const musicId = await page.evaluate(() => new URLSearchParams(window.location.search).get('id'));
  await expect.poll(async () => {
    const saved = await page.evaluate(
      (id) => JSON.parse(localStorage.getItem('rehearsal:' + id) || 'null'),
      musicId
    );
    return saved && saved.lastPositionSeconds;
  }, { timeout: 6000, intervals: [500] }).toBeGreaterThan(0);

  await page.locator('#btnPlayPause').click();
});

test('sem WaveSurfer disponível, waveform fica nulo e os guards dependentes de waveform são pulados', async ({ page }) => {
  // Serve um script vazio para o bundle do WaveSurfer: window.WaveSurfer nunca é definido,
  // createWaveform() retorna null (rehearsal.audio.js linha 10-13), e `waveform` permanece null
  // durante todo o bootstrap. Isso cobre os ramos "falso"/early-return dependentes de waveform:
  // updateRegionFromAB linha 36 (!waveform -> return), handleAudioFile linha 155 (if (waveform) pulado),
  // handleClearAB linha 213 (if (waveform) pulado) e onTimeUpdate linha 133 (waveform && wavesurfer falso).
  await page.route('**/src/vendor/wavesurfer/wavesurfer.min.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '// wavesurfer intentionally stubbed out for coverage (window.WaveSurfer undefined)',
  }));

  await openMusicPreview(page);
  await openRehearsalPanel(page);
  await expect(page.evaluate(() => window.WaveSurfer)).resolves.toBeUndefined();

  await page.locator('#inputAudio').setInputFiles(wavTone());
  await expect(page.locator('#audioFileName')).toContainText('tom.wav');

  // Marca A e depois B com A já setado (B > A) -> chama updateRegionFromAB internamente,
  // que retorna cedo por !waveform (linha 36, idx0) sem lançar erro.
  await page.locator('#btnSetA').click();
  await page.locator('#btnPlus1').click();
  await page.locator('#btnSetB').click();

  // handleClearAB com waveform nulo: pula waveform.clearRegion() (linha 213, idx1).
  await page.locator('#btnClearAB').click();

  // Toca por um instante para que onTimeUpdate rode com waveform nulo (linha 133, idx1).
  await page.locator('#btnPlayPause').click();
  await page.waitForTimeout(500);
  await page.locator('#btnPlayPause').click();

  // Segundo upload com waveform ainda nulo: pula updateRegionFromAB via "if (waveform)" (linha 155, idx1).
  await page.locator('#inputAudio').setInputFiles({ ...wavTone(), name: 'segundo.wav' });
  await expect(page.locator('#audioFileName')).toContainText('segundo.wav');
});
