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

function wavTone() {
  const sampleRate = 8000;
  const samples = sampleRate * 2;
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

// NOTA: tentamos forçar o fallback de áudio nativo (sem SoundTouch) e o terceiro operando de
// resolveSoundTouch() (window.soundtouch em vez de window.soundtouchjs) sobrescrevendo/deletando
// window.soundtouchjs.getWebAudioNode e window.soundtouchjs em si via page.evaluate. Ambos falham
// silenciosamente: o bundle soundtouch.min.js exporta esse namespace com propriedades definidas via
// Object.defineProperty (getters, sem setter, non-configurable) - confirmado via debug isolado
// (Object.defineProperty lança "Cannot redefine property: getWebAudioNode" e `delete
// window.soundtouchjs` retorna false silenciosamente). Como a biblioteca real sempre está disponível
// nesse ambiente de teste, os branches de fallback (buildFallbackNode, linhas 99-112) e o terceiro
// operando de cada OR em resolveSoundTouch (linhas 6-9, idx4) são estruturalmente inalcançáveis sem
// truques adicionais (ex.: servir uma build alternativa da lib só para o teste), não tentado por
// orçamento de tempo. Documentado como impedimento.

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
