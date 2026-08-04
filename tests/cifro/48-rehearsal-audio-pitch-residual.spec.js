import { test, expect } from '../fixtures/coverage.js';

async function load(page, src) {
  await page.evaluate(src => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  }), src);
}

test('rehearsal.audio cobre ausência, regiões e fallbacks do waveform', async ({ page }) => {
  await page.goto('/login.php');
  await load(page, '/src/js/rehearsal/rehearsal.audio.js');
  const result = await page.evaluate(async () => {
    const statuses = [];
    const missing = Rehearsal.audio.createWaveform({ container: document.body, onStatus: value => statuses.push(value) });
    const events = {};
    const added = [];
    const region = { setOptions: value => added.push(value), remove: () => added.push('removed') };
    const ws = {
      registerPlugin: plugin => plugin,
      on: (name, callback) => { events[name] = callback; },
      getCurrentTime: () => 7,
      loadBlob: blob => Promise.resolve(blob.size),
      getRegion: () => region,
      getDuration: () => 10,
      seekTo: ratio => added.push(['seek', ratio]),
      isReady: false,
    };
    window.WaveSurfer = {
      create: () => ws,
      Regions: { create: () => ({ addRegion: value => added.push(value) }) },
    };
    let seek = 0;
    let changed = null;
    const audio = Rehearsal.audio.createWaveform({
      container: document.body,
      onSeek: value => { seek = value; },
      onRegionChange: (start, end) => { changed = [start, end]; },
      onStatus: value => statuses.push(value),
    });
    events.interaction();
    events['region-created']({ id: 'outro' });
    events['region-created']({ id: 'loop-region', start: 1, end: 2 });
    events['region-updated'](null);
    events['region-updated']({ id: 'loop-region', start: 3, end: 4 });
    await audio.loadBlob(new Blob(['abc']));
    audio.setRegion(-2, -4);
    audio.clearRegion();
    audio.setTime(5);
    return { missing, statuses, seek, changed, added, duration: audio.getDuration(), ready: audio.isReady() };
  });
  expect(result.missing).toBeNull();
  expect(result.statuses[0]).toContain('not available');
  expect(result.seek).toBe(7);
  expect(result.changed).toEqual([3, 4]);
  expect(result.duration).toBe(10);
  expect(result.ready).toBe(true);
  expect(result.added).toContainEqual(['seek', 0.5]);
});

test('rehearsal.pitch cobre reprodução sem arquivo, fallback e controles', async ({ page }) => {
  await page.goto('/login.php');
  await page.evaluate(() => {
    let time = 0;
    window.AudioContext = class {
      constructor() { this.destination = {}; }
      get currentTime() { return ++time; }
      createBufferSource() {
        return {
          playbackRate: { value: 1 },
          connect() {}, disconnect() {}, start() {}, stop() {}, onended: null,
        };
      }
      async decodeAudioData() { return { duration: 5, sampleRate: 100 }; }
    };
    window.requestAnimationFrame = callback => { window.__pitchFrame = callback; return 1; };
    window.cancelAnimationFrame = () => {};
  });
  await load(page, '/src/js/rehearsal/rehearsal.pitch.js');
  const result = await page.evaluate(async () => {
    const status = [];
    const times = [];
    let ended = 0;
    const player = Rehearsal.pitch.createPitchPlayer({
      onStatus: value => status.push(value),
      onTimeUpdate: value => times.push(value),
      onEnded: () => { ended++; },
    });
    player.play();
    player.pause();
    player.seek(2);
    player.setPitchSemitones(99);
    await player.loadFile(new Blob(['audio']));
    player.seek(-2);
    player.play();
    player.play();
    player.setPitchSemitones(-99);
    player.pause();
    player.pause();
    player.toggle();
    player.toggle();
    return {
      status, times, ended,
      pitch: player.getPitchSemitones(),
      duration: player.getDuration(),
      playing: player.isPlaying(),
      current: player.getCurrentTime(),
    };
  });
  expect(result.status).toContain('Audio loaded. Ready to play.');
  expect(result.status.some(value => value.includes('fallback audio'))).toBe(true);
  expect(result.pitch).toBe(-12);
  expect(result.duration).toBe(5);
  expect(result.playing).toBe(false);
});
