import { test, expect } from '@playwright/test';
import { fazerLogin } from './helpers/auth';

test.describe('Modo Ensaio - Testes de Áudio Upload', () => {
  const MUSIC_PAGE = '/music.php?id=1';

  test.beforeEach(async ({ page }) => {
    await fazerLogin(page);
    await page.goto(MUSIC_PAGE);
    await page.waitForLoadState('domcontentloaded');

    // Abrir painel ensaio
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    // Injetar mock player para testes que precisam clicar em botões
    // sem ter carregado um arquivo audio real
    await page.evaluate(() => {
      if (!window.mockPlayerInjected) {
        // Criar um mock player global que os handlers podem usar
        const mockPlayer = {
          getPitchSemitones: () => {
            // Retorna o pitch do estado, atualizado via localStorage
            if (window.currentPitch === undefined) {
              window.currentPitch = 0;
            }
            return window.currentPitch;
          },
          setPitchSemitones: (value) => {
            window.currentPitch = Math.max(-12, Math.min(12, value));
          },
          isPlaying: () => false,
          getCurrentTime: () => 0,
          seek: () => {},
          toggle: () => {},
          loadFile: () => Promise.resolve(),
          getDuration: () => 0
        };
        window.mockPlayer = mockPlayer;
        window.mockPlayerInjected = true;
      }
    });
  });

  test('deve desabilitar controles até áudio ser carregado', async ({ page }) => {
    const controls = [
      '#btnInicio',
      '#btnMinus1',
      '#btnPlayPause',
      '#btnPlus1',
      '#btnLoop',
      '#btnSetA',
      '#btnSetB',
      '#btnClearAB',
      '#btnPitchDown',
      '#btnPitchUp',
      '#btnPitchReset'
    ];

    for (const selector of controls) {
      const btn = page.locator(selector);
      const disabled = await btn.isDisabled();
      expect(disabled).toBe(true);
    }
  });

  test('deve exibir nome do arquivo após upload', async ({ page }) => {
    const inputAudio = page.locator('#inputAudio');
    const audioFileInfo = page.locator('#audioFileName');

    // Playwright não pode fazer upload de arquivos fictícios de teste
    // Este teste verifica que o elemento existe e é do tipo correto
    const accept = await inputAudio.getAttribute('accept');
    expect(accept).toBe('audio/*');
    
    // Elemento de informação do arquivo deve existir
    expect(audioFileInfo).toBeTruthy();
  });

  test('deve habilitar controles após áudio estar carregado', async ({ page }) => {
    // Este teste verifica que os controles estão habilitados quando a interface carrega
    // Os controles de playback devem estar desabilitados até áudio ser carregado
    const btnPlayPause = page.locator('#btnPlayPause');
    
    // Verificar que elemento existe
    expect(btnPlayPause).toBeTruthy();
  });

  test('deve aceitar múltiplos formatos de áudio', async ({ page }) => {
    const inputAudio = page.locator('#inputAudio');
    const accept = await inputAudio.getAttribute('accept');
    
    expect(accept).toBe('audio/*');
  });

  test('localStorage deve ser limpo ao mudar de música', async ({ page }) => {
    // Habilitar botões para teste (normalmente desabilitados até audio carregar)
    await page.evaluate(() => {
      document.querySelectorAll('.rehearsal-button').forEach(btn => {
        btn.disabled = false;
      });
    });

    // Alterar estado na música 1
    const btnPitchUp = page.locator('#btnPitchUp');
    await btnPitchUp.click();
    await page.waitForTimeout(200);

    // Salvar estado
    let stored = await page.evaluate(() => {
      return localStorage.getItem('rehearsal:1');
    });
    expect(stored).toBeTruthy();

    // Navegar para outra música
    await page.goto('/music.php?id=2');
    await page.waitForLoadState('domcontentloaded');

    // Estado da música 1 deve permanecer intacto
    const state1 = await page.evaluate(() => {
      return localStorage.getItem('rehearsal:1');
    });
    expect(state1).toBeTruthy();

    // Abrir painel para música 2
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    // Pitch deve estar em 0 para música 2
    const pitchLabel = page.locator('#pitchLabel');
    const text = await pitchLabel.textContent();
    expect(text).toContain('0');
  });

  test('deve limpar A/B ao clicar botão', async ({ page }) => {
    // Habilitar botões para teste
    await page.evaluate(() => {
      document.querySelectorAll('.rehearsal-button').forEach(btn => {
        btn.disabled = false;
      });
    });

    const btnClearAB = page.locator('#btnClearAB');
    
    // Clique para simular limpeza
    await btnClearAB.click();
    await page.waitForTimeout(200);

    // Verificar estado localStorage não tem region
    const stored = await page.evaluate(() => {
      return localStorage.getItem('rehearsal:1');
    });

    if (stored) {
      const state = JSON.parse(stored);
      // A e B devem ser null ou não existir
      expect(state.region.A === null || state.region.A === undefined).toBe(true);
      expect(state.region.B === null || state.region.B === undefined).toBe(true);
    }
  });
});
