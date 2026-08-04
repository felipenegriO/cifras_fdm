/**
 * 37-rehearsal-audio-youtube-branches.spec.js
 * Cobertura de branches residuais de rehearsal.audio.js e rehearsal.youtube.js
 * não exercitados pelo teste de matriz em 31-browser-branch-matrix.spec.js:
 * callbacks onSeek/onRegionChange ausentes, fallback addRegion, clearRegion
 * sem clearRegions, setTime/getDuration/isReady sem métodos do WaveSurfer,
 * e as variações de URL/host do YouTube (watch real, shorts/embed inválidos,
 * paths desconhecidos, fetchYoutubeMeta sem videoId).
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function openPreview(page) {
  await page.goto('/index.php');
  await page.evaluate((song) => {
    sessionStorage.setItem('cifroEditorPreview', JSON.stringify(song));
    sessionStorage.removeItem('cifroSetlist');
  }, { id: 78, nome: 'Matriz de ensaio audio/youtube', artista: '', bit: '', cifra: '<b>C G Am F</b><br>'.repeat(20) });
  await page.goto('/music.php?id=78&editorPreview=1');
  await expect(page.locator('#song-cifra')).toBeVisible();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

test('rehearsal.audio.js — callbacks ausentes, fallback addRegion, clearRegion e getters sem métodos', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(async (loadFn) => {
    // eslint-disable-next-line no-eval
    const load = eval(`(${loadFn})`);
    await load('/src/js/rehearsal/rehearsal.audio.js');

    const messages = [];

    // 1) onSeek/onRegionChange ausentes: os handlers devem checar
    // "typeof onSeek === 'function'" e "typeof onRegionChange === 'function'"
    // como false, sem lançar.
    const savedHandlersNoCallbacks = {};
    window.WaveSurfer = {
      Regions: { create: () => ({ addRegion: (opts) => ({ ...opts, setOptions() {}, remove() {} }) }) },
      create: () => ({
        on(name, handler) { savedHandlersNoCallbacks[name] = handler; },
        registerPlugin(plugin) { return plugin; },
        loadBlob() { return Promise.resolve(); },
        getCurrentTime() { return 1; },
      }),
    };
    const waveNoCallbacks = window.Rehearsal.audio.createWaveform({ container: document.body, onStatus: (m) => messages.push(m) });
    let threw = false;
    try {
      savedHandlersNoCallbacks.interaction();
      savedHandlersNoCallbacks['region-created']({ id: 'loop-region', start: 0, end: 1 });
      savedHandlersNoCallbacks['region-updated']({ id: 'loop-region', start: 0, end: 1 });
    } catch (e) {
      threw = true;
    }

    // 2) setRegion sem região existente (getRegion retorna null) usa o
    // caminho addRegion (regionsPlugin.addRegion).
    let addRegionCalled = null;
    window.WaveSurfer = {
      Regions: { create: () => ({ addRegion: (opts) => { addRegionCalled = opts; return { ...opts }; } }) },
      create: () => ({
        on() {},
        registerPlugin(plugin) { return plugin; },
        loadBlob() { return Promise.resolve(); },
        getRegion() { return null; },
      }),
    };
    const waveAddRegion = window.Rehearsal.audio.createWaveform({ container: document.body, onStatus: (m) => messages.push(m) });
    waveAddRegion.setRegion(2, 5);

    // 3) clearRegion sem ws.clearRegions, com getRegion retornando uma
    // região real (remove chamado) e depois sem região (skip).
    let removed = false;
    let getRegionCallIndex = 0;
    window.WaveSurfer = {
      create: () => ({
        on() {},
        registerPlugin(plugin) { return plugin; },
        loadBlob() { return Promise.resolve(); },
        getRegion() {
          getRegionCallIndex += 1;
          if (getRegionCallIndex === 1) return { remove() { removed = true; } };
          return null;
        },
      }),
    };
    const waveClearWithRegion = window.Rehearsal.audio.createWaveform({ container: document.body, onStatus: (m) => messages.push(m) });
    waveClearWithRegion.clearRegion(); // getRegion() #1 -> remove() chamado
    waveClearWithRegion.clearRegion(); // getRegion() #2 -> null, sem remove

    // 4) clearRegion sem ws (null) — createWaveform retorna null quando
    // WaveSurfer ausente, então chamamos clearRegion diretamente via
    // uma instância cujo ws foi zerado não é possível (closure), então
    // testamos apenas o caminho onde nem clearRegions nem getRegion existem.
    window.WaveSurfer = {
      create: () => ({
        on() {},
        registerPlugin(plugin) { return plugin; },
        loadBlob() { return Promise.resolve(); },
      }),
    };
    const waveNoClearMethods = window.Rehearsal.audio.createWaveform({ container: document.body, onStatus: (m) => messages.push(m) });
    waveNoClearMethods.clearRegion(); // nem clearRegions nem getRegion — não lança

    // 5) setTime sem ws.getDuration; setTime com duration 0; getDuration
    // sem ws.getDuration (fallback 0); isReady sem ws.isReady (fallback
    // Boolean(getDuration())).
    window.WaveSurfer = {
      create: () => ({
        on() {},
        registerPlugin(plugin) { return plugin; },
        loadBlob() { return Promise.resolve(); },
      }),
    };
    const waveNoDuration = window.Rehearsal.audio.createWaveform({ container: document.body, onStatus: (m) => messages.push(m) });
    waveNoDuration.setTime(3); // ws.getDuration ausente -> return antecipado
    const durationFallback = waveNoDuration.getDuration(); // 0
    const readyFallback = waveNoDuration.isReady(); // Boolean(0) === false

    window.WaveSurfer = {
      create: () => ({
        on() {},
        registerPlugin(plugin) { return plugin; },
        loadBlob() { return Promise.resolve(); },
        getDuration() { return 0; },
      }),
    };
    const waveZeroDuration = window.Rehearsal.audio.createWaveform({ container: document.body, onStatus: (m) => messages.push(m) });
    waveZeroDuration.setTime(3); // duration <= 0 -> return antecipado

    window.WaveSurfer = {
      create: () => ({
        on() {},
        registerPlugin(plugin) { return plugin; },
        loadBlob() { return Promise.resolve(); },
        getDuration() { return 8; },
        isReady: 0,
      }),
    };
    const waveIsReadyFalsy = window.Rehearsal.audio.createWaveform({ container: document.body, onStatus: (m) => messages.push(m) });
    const readyViaDuration = waveIsReadyFalsy.isReady(); // Boolean(getDuration()) === true

    delete window.WaveSurfer;

    return {
      threw,
      addRegionCalled,
      removed,
      durationFallback,
      readyFallback,
      readyViaDuration,
      noCallbacksOk: Boolean(waveNoCallbacks),
    };
  }, loadScript.toString());

  expect(result.threw).toBe(false);
  expect(result.noCallbacksOk).toBe(true);
  expect(result.addRegionCalled).toMatchObject({ id: 'loop-region', start: 2, end: 5 });
  expect(result.removed).toBe(true);
  expect(result.durationFallback).toBe(0);
  expect(result.readyFallback).toBe(false);
  expect(result.readyViaDuration).toBe(true);
});

test('rehearsal.youtube.js — hosts, paths e ids reais do YouTube', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(async (loadFn) => {
    // eslint-disable-next-line no-eval
    const load = eval(`(${loadFn})`);
    await load('/src/js/rehearsal/rehearsal.youtube.js');
    // Segundo load: exercita `window.Rehearsal = window.Rehearsal || {}` já truthy.
    await load('/src/js/rehearsal/rehearsal.youtube.js');

    const y = window.Rehearsal.youtube;
    const cases = {
      shortInvalidYoutuBe: y.extractYoutubeVideoId('https://youtu.be/abc'),
      realWatch: y.extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      watchNoParam: y.extractYoutubeVideoId('https://www.youtube.com/watch'),
      watchInvalidId: y.extractYoutubeVideoId('https://www.youtube.com/watch?v=xx'),
      shortsEmpty: y.extractYoutubeVideoId('https://www.youtube.com/shorts/'),
      shortsInvalid: y.extractYoutubeVideoId('https://www.youtube.com/shorts/xx'),
      embedEmpty: y.extractYoutubeVideoId('https://www.youtube.com/embed/'),
      embedInvalid: y.extractYoutubeVideoId('https://www.youtube.com/embed/xx'),
      unknownPath: y.extractYoutubeVideoId('https://www.youtube.com/channel/xyz'),
      searchDefault: y.buildSearchUrl(),
      searchEmptyString: y.buildSearchUrl(''),
    };

    const metaNoId = await y.fetchYoutubeMeta('');

    return { cases, metaNoId };
  }, loadScript.toString());

  expect(result.cases.shortInvalidYoutuBe).toBeNull();
  expect(result.cases.realWatch).toBe('dQw4w9WgXcQ');
  expect(result.cases.watchNoParam).toBeNull();
  expect(result.cases.watchInvalidId).toBeNull();
  expect(result.cases.shortsEmpty).toBeNull();
  expect(result.cases.shortsInvalid).toBeNull();
  expect(result.cases.embedEmpty).toBeNull();
  expect(result.cases.embedInvalid).toBeNull();
  expect(result.cases.unknownPath).toBeNull();
  expect(result.cases.searchDefault).toContain('search_query=');
  expect(result.cases.searchEmptyString).toContain('search_query=');
  expect(result.metaNoId).toBeNull();
});
