/**
 * 34-rehearsal-state.spec.js
 * rehearsal.state.js — window.Rehearsal.state (normalize/load/save).
 *
 * rehearsal.state.js is loaded lazily only when the "Modo Ensaio" panel is
 * opened (see loadRehearsal() in music.php), so every test must open the
 * panel first — visiting music.php alone never defines window.Rehearsal.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function openRehearsalPanel(page, musicId) {
  await page.goto('/index.php');
  await page.evaluate((id) => {
    sessionStorage.setItem('cifroEditorPreview', JSON.stringify({
      id,
      nome: 'Cobertura rehearsal.state',
      artista: 'Teste E2E',
      bit: '',
      cifra: '<p><b>C</b> Música de teste</p>',
    }));
  }, musicId);
  await page.goto(`/music.php?id=${musicId}&editorPreview=1`);
  await expect(page.locator('#song-cifra')).toBeVisible();

  await page.locator('#menuButton').click();
  await page.locator('#settingsTabTools').click();
  await page.getByText('Ensaio com YouTube e áudio', { exact: true }).click();
  await page.locator('#btnAtivarEnsaio').click();
  await expect.poll(() => page.evaluate(() => window.bootstrapEntered === true)).toBe(true);
}

test.describe('Rehearsal.state — normalizeState', () => {
  test('aplica valores padrão quando raw é null/undefined', async ({ page }) => {
    await openRehearsalPanel(page, 990101);
    const [fromNull, fromUndefined, defaults] = await page.evaluate(() => [
      window.Rehearsal.state.normalizeState(null),
      window.Rehearsal.state.normalizeState(undefined),
      window.Rehearsal.state.DEFAULT_STATE,
    ]);
    expect(fromNull).toEqual(defaults);
    expect(fromUndefined).toEqual(defaults);
  });

  test('normaliza tipos inválidos para os padrões seguros', async ({ page }) => {
    await openRehearsalPanel(page, 990102);
    const state = await page.evaluate(() => window.Rehearsal.state.normalizeState({
      youtubeVideoId: 123,
      youtubeUrl: null,
      youtubeTitle: undefined,
      audioFileName: {},
      pitchSemitones: 'abc',
      loopEnabled: 'yes',
      lastPositionSeconds: 'x',
      region: null,
    }));
    expect(state.youtubeVideoId).toBe('');
    expect(state.youtubeUrl).toBe('');
    expect(state.youtubeTitle).toBe('');
    expect(state.audioFileName).toBe('');
    expect(state.pitchSemitones).toBe(0);
    expect(state.loopEnabled).toBe(true);
    expect(state.lastPositionSeconds).toBe(0);
    expect(state.region).toEqual({ A: null, B: null });
  });

  test('clampa pitchSemitones entre -12 e 12', async ({ page }) => {
    await openRehearsalPanel(page, 990103);
    const clampedHigh = await page.evaluate(() => window.Rehearsal.state.normalizeState({ pitchSemitones: 99 }).pitchSemitones);
    const clampedLow = await page.evaluate(() => window.Rehearsal.state.normalizeState({ pitchSemitones: -99 }).pitchSemitones);
    const withinRange = await page.evaluate(() => window.Rehearsal.state.normalizeState({ pitchSemitones: 5 }).pitchSemitones);
    expect(clampedHigh).toBe(12);
    expect(clampedLow).toBe(-12);
    expect(withinRange).toBe(5);
  });

  test('clampa lastPositionSeconds para não-negativo', async ({ page }) => {
    await openRehearsalPanel(page, 990104);
    const clamped = await page.evaluate(() => window.Rehearsal.state.normalizeState({ lastPositionSeconds: -50 }).lastPositionSeconds);
    expect(clamped).toBe(0);
  });

  test('clampa region.A e region.B individualmente, aceitando null', async ({ page }) => {
    await openRehearsalPanel(page, 990105);
    const region = await page.evaluate(() => window.Rehearsal.state.normalizeState({ region: { A: -5, B: 42 } }).region);
    expect(region).toEqual({ A: 0, B: 42 });

    const regionNulls = await page.evaluate(() => window.Rehearsal.state.normalizeState({ region: { A: null, B: undefined } }).region);
    expect(regionNulls).toEqual({ A: null, B: null });
  });

  test('preserva valores válidos sem alterá-los', async ({ page }) => {
    await openRehearsalPanel(page, 990106);
    const state = await page.evaluate(() => window.Rehearsal.state.normalizeState({
      youtubeVideoId: 'abc123',
      youtubeUrl: 'https://youtube.com/watch?v=abc123',
      youtubeTitle: 'Minha música',
      audioFileName: 'audio.mp3',
      pitchSemitones: -3,
      loopEnabled: true,
      lastPositionSeconds: 42.5,
      region: { A: 10, B: 20 },
    }));
    expect(state).toEqual({
      youtubeVideoId: 'abc123',
      youtubeUrl: 'https://youtube.com/watch?v=abc123',
      youtubeTitle: 'Minha música',
      audioFileName: 'audio.mp3',
      pitchSemitones: -3,
      loopEnabled: true,
      lastPositionSeconds: 42.5,
      region: { A: 10, B: 20 },
    });
  });
});

test.describe('Rehearsal.state — loadState/saveState', () => {
  test('loadState sem dado salvo retorna estado padrão', async ({ page }) => {
    const id = 990107;
    await openRehearsalPanel(page, id);
    await page.evaluate((musicId) => localStorage.removeItem('rehearsal:' + musicId), id);
    const state = await page.evaluate((musicId) => window.Rehearsal.state.loadState(musicId), id);
    expect(state.pitchSemitones).toBe(0);
    expect(state.loopEnabled).toBe(false);
  });

  test('saveState persiste e loadState recupera normalizado', async ({ page }) => {
    const id = 990108;
    await openRehearsalPanel(page, id);
    await page.evaluate((musicId) => {
      window.Rehearsal.state.saveState(musicId, { pitchSemitones: 7, loopEnabled: true, region: { A: 1, B: 2 } });
    }, id);
    const reloaded = await page.evaluate((musicId) => window.Rehearsal.state.loadState(musicId), id);
    expect(reloaded.pitchSemitones).toBe(7);
    expect(reloaded.loopEnabled).toBe(true);
    expect(reloaded.region).toEqual({ A: 1, B: 2 });
  });

  test('loadState com JSON corrompido no localStorage cai para o padrão', async ({ page }) => {
    const id = 990109;
    await openRehearsalPanel(page, id);
    await page.evaluate((musicId) => localStorage.setItem('rehearsal:' + musicId, '{not valid json'), id);
    const state = await page.evaluate((musicId) => window.Rehearsal.state.loadState(musicId), id);
    expect(state.pitchSemitones).toBe(0);
    expect(state.region).toEqual({ A: null, B: null });
  });

  test('loadState/saveState com musicId ausente usa a chave "unknown"', async ({ page }) => {
    await openRehearsalPanel(page, 990110);
    await page.evaluate(() => {
      localStorage.removeItem('rehearsal:unknown');
      window.Rehearsal.state.saveState(undefined, { pitchSemitones: 2 });
    });
    const stored = await page.evaluate(() => localStorage.getItem('rehearsal:unknown'));
    expect(stored).not.toBeNull();
    await page.evaluate(() => localStorage.removeItem('rehearsal:unknown'));
  });
});
