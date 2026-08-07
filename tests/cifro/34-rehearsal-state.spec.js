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
  await page.evaluate(() => document.body.classList.remove('is-editor-preview'));

  await page.locator('#menuButton').click();
  await page.locator('#settingsTabTools').click();
  await page.getByText('Ensaio com YouTube e áudio', { exact: true }).click();
  await page.locator('#btnAtivarEnsaio').click();
  await expect.poll(() => page.evaluate(() => window.bootstrapEntered === true)).toBe(true);
}

test.describe('Ensaio — validação de configurações', () => {
  test('estado padrão é aplicado quando nenhuma configuração foi salva', async ({ page }) => {
    await openRehearsalPanel(page, 990101);
    const [fromNull, fromUndefined, defaults] = await page.evaluate(() => [
      window.Rehearsal.state.normalizeState(null),
      window.Rehearsal.state.normalizeState(undefined),
      window.Rehearsal.state.DEFAULT_STATE,
    ]);
    expect(fromNull).toEqual(defaults);
    expect(fromUndefined).toEqual(defaults);
  });

  test('configurações com valores inválidos são corrigidas automaticamente', async ({ page }) => {
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

  test('ajuste de tom é limitado ao intervalo de -12 a 12 semitons', async ({ page }) => {
    await openRehearsalPanel(page, 990103);
    const clampedHigh = await page.evaluate(() => window.Rehearsal.state.normalizeState({ pitchSemitones: 99 }).pitchSemitones);
    const clampedLow = await page.evaluate(() => window.Rehearsal.state.normalizeState({ pitchSemitones: -99 }).pitchSemitones);
    const withinRange = await page.evaluate(() => window.Rehearsal.state.normalizeState({ pitchSemitones: 5 }).pitchSemitones);
    expect(clampedHigh).toBe(12);
    expect(clampedLow).toBe(-12);
    expect(withinRange).toBe(5);
  });

  test('posição de reprodução negativa é corrigida para zero', async ({ page }) => {
    await openRehearsalPanel(page, 990104);
    const clamped = await page.evaluate(() => window.Rehearsal.state.normalizeState({ lastPositionSeconds: -50 }).lastPositionSeconds);
    expect(clamped).toBe(0);
  });

  test('marcadores de loop são limitados a valores não-negativos ou nulos', async ({ page }) => {
    await openRehearsalPanel(page, 990105);
    const region = await page.evaluate(() => window.Rehearsal.state.normalizeState({ region: { A: -5, B: 42 } }).region);
    expect(region).toEqual({ A: 0, B: 42 });

    const regionNulls = await page.evaluate(() => window.Rehearsal.state.normalizeState({ region: { A: null, B: undefined } }).region);
    expect(regionNulls).toEqual({ A: null, B: null });
  });

  test('configurações válidas de ensaio são preservadas sem alteração', async ({ page }) => {
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

test.describe('Ensaio — persistência de configurações', () => {
  test('carregar configuração de ensaio pela primeira vez usa os valores padrão', async ({ page }) => {
    const id = 990107;
    await openRehearsalPanel(page, id);
    await page.evaluate((musicId) => localStorage.removeItem('rehearsal:' + musicId), id);
    const state = await page.evaluate((musicId) => window.Rehearsal.state.loadState(musicId), id);
    expect(state.pitchSemitones).toBe(0);
    expect(state.loopEnabled).toBe(false);
  });

  test('configuração salva no ensaio é recuperada corretamente na próxima vez', async ({ page }) => {
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

  test('configuração de ensaio corrompida é ignorada e substituída pelo estado padrão', async ({ page }) => {
    const id = 990109;
    await openRehearsalPanel(page, id);
    await page.evaluate((musicId) => localStorage.setItem('rehearsal:' + musicId, '{not valid json'), id);
    const state = await page.evaluate((musicId) => window.Rehearsal.state.loadState(musicId), id);
    expect(state.pitchSemitones).toBe(0);
    expect(state.region).toEqual({ A: null, B: null });
  });

  test('configuração de ensaio sem ID de música usa chave genérica', async ({ page }) => {
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

test.describe('Ensaio — persistência visível na UI', () => {
  test('tom e loop salvos aparecem na tela ao reabrir o painel', async ({ page }) => {
    const musicId = 990201;
    await openRehearsalPanel(page, musicId);

    // Navega para fora — o beforeunload do music.php dispara e persiste o estado
    // padrão (pitch=0). É intencional: queremos sair antes de escrever o estado
    // desejado, para que o beforeunload não sobrescreva o que vamos salvar a seguir.
    await page.goto('/index.php');

    // Agora em index.php, sem risco de beforeunload do music.php, definimos o
    // estado desejado diretamente no localStorage.
    await page.evaluate(id => {
      localStorage.setItem('rehearsal:' + id, JSON.stringify({
        pitchSemitones: 7,
        loopEnabled: true,
        youtubeVideoId: '',
        youtubeUrl: '',
        youtubeTitle: '',
        audioFileName: '',
        lastPositionSeconds: 0,
        region: { A: null, B: null },
      }));
    }, musicId);

    // Reabre o painel — o bootstrap lê do localStorage e aplica pitch=7
    await openRehearsalPanel(page, musicId);

    // Verifica que os valores persistidos aparecem na UI
    await expect(page.locator('#pitchLabel')).toHaveText('+7 semitons');
    await expect(page.locator('#btnLoop')).toHaveClass(/is-active/);
  });

  test('painel carrega com valores padrão e sem crash quando localStorage está corrompido', async ({ page }) => {
    const musicId = 990202;
    await openRehearsalPanel(page, musicId);

    // Corrompe o localStorage
    await page.evaluate(id => localStorage.setItem('rehearsal:' + id, '{INVALIDO'), musicId);

    // Reabre o painel — deve carregar sem crash e com valores padrão
    await openRehearsalPanel(page, musicId);

    await expect(page.locator('#pitchLabel')).toHaveText('0 semitons');
    await expect(page.locator('#btnLoop')).not.toHaveClass(/is-active/);
  });
});
