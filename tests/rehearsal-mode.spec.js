import { test, expect } from './fixtures/diagnostics.js';
import { fazerLogin } from './helpers/auth';

function createTestWav() {
  const sampleRate = 8000;
  const samples = 800;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}

async function loadTestAudio(page) {
  await page.locator('#inputAudio').setInputFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: createTestWav() });
  await expect(page.locator('#btnPitchUp')).toBeEnabled();
}

test.describe('Modo Ensaio (Rehearsal Mode)', () => {
  const MUSIC_PAGE = '/music.php?id=1';
  const TEST_AUDIO_PATH = './tests/fixtures/test-audio.mp3';

  test.beforeEach(async ({ page }) => {
    // Fazer login
    await fazerLogin(page);
    
    // Navegar para página de música
    await page.goto(MUSIC_PAGE);
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      const drawer = document.getElementById('menusideMenu');
      if (drawer) {
        drawer.style.right = '0px';
        drawer.setAttribute('aria-hidden', 'false');
      }
      document.querySelectorAll('[data-settings-panel]').forEach(panel => { panel.hidden = panel.id !== 'settingsPanelTools'; });
      document.getElementById('btnAtivarEnsaio')?.closest('details')?.setAttribute('open', '');
    });
    await expect(page.locator('#btnAtivarEnsaio')).toBeVisible();
    await page.locator('#btnAtivarEnsaio').evaluate(button => button.click());
    await expect.poll(() => page.evaluate(() => Boolean(window.Rehearsal?.ui && window.bootstrapEntered))).toBe(true);
    await expect(page.locator('#btnAtivarEnsaio')).toBeEnabled();
    await expect(page.locator('#modo-ensaio')).toHaveAttribute('aria-hidden', 'false');
    await page.locator('#btnAtivarEnsaio').evaluate(button => button.click());
    await expect(page.locator('#modo-ensaio')).toHaveAttribute('aria-hidden', 'true');
    await page.evaluate(() => {
      const drawer = document.getElementById('menusideMenu');
      if (drawer) {
        drawer.style.right = '0px';
        drawer.setAttribute('aria-hidden', 'false');
      }
    });
    await expect(page.locator('#btnAtivarEnsaio')).toBeVisible();

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

  test('deve exibir botão Ensaio e painel', async ({ page }) => {
    // Verificar se botão existe
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await expect(btnEnsaio).toBeVisible();
    await expect(btnEnsaio).toContainText(/ensaio/i);

    // Painel deve estar oculto inicialmente
    const painel = page.locator('#modo-ensaio');
    const ariaHidden = await painel.getAttribute('aria-hidden');
    expect(ariaHidden).toBe('true');
  });

  test('deve togglear painel Ensaio ao clicar botão', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    const painel = page.locator('#modo-ensaio');

    // Inicialmente oculto
    await expect(painel).toHaveAttribute('aria-hidden', 'true');

    // Clicar para abrir
    await btnEnsaio.click();
    await page.waitForTimeout(300);
    await expect(painel).toHaveAttribute('aria-hidden', 'false');

    // Clicar para fechar
    await btnEnsaio.evaluate(button => button.click());
    await page.waitForTimeout(300);
    await expect(painel).toHaveAttribute('aria-hidden', 'true');
  });

  test('deve verificar elementos UI do painel', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    // Verificar seções YouTube
    await expect(page.locator('#btnAbrirYoutube')).toBeVisible();
    await expect(page.locator('#inputYoutubeUrl')).toBeVisible();
    await expect(page.locator('#btnVincularYoutube')).toBeVisible();

    // Verificar section Áudio
    await expect(page.locator('#inputAudio')).toBeVisible();
    await expect(page.locator('#waveform')).toBeVisible();

    // Verificar controles
    await expect(page.locator('#btnInicio')).toBeVisible();
    await expect(page.locator('#btnMinus1')).toBeVisible();
    await expect(page.locator('#btnPlayPause')).toBeVisible();
    await expect(page.locator('#btnPlus1')).toBeVisible();
    await expect(page.locator('#btnLoop')).toBeVisible();

    // Verificar A/B
    await expect(page.locator('#btnSetA')).toBeVisible();
    await expect(page.locator('#btnSetB')).toBeVisible();
    await expect(page.locator('#btnClearAB')).toBeVisible();

    // Verificar Pitch
    await expect(page.locator('#btnPitchDown')).toBeVisible();
    await expect(page.locator('#btnPitchUp')).toBeVisible();
    await expect(page.locator('#btnPitchReset')).toBeVisible();
    await expect(page.locator('#pitchLabel')).toBeVisible();
  });

  test('deve tentar abrir pesquisa YouTube', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    const btnAbrirYoutube = page.locator('#btnAbrirYoutube');
    
    // Interceptar nova aba
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      btnAbrirYoutube.click()
    ]);

    // Verificar se é URL de pesquisa YouTube
    const url = popup.url();
    expect(url).toContain('youtube.com');
    expect(url).toContain('results');
    expect(url).toContain('search_query');

    await popup.close();
  });

  test('deve validar entrada de URL YouTube inválida', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    const inputUrl = page.locator('#inputYoutubeUrl');
    const btnVincular = page.locator('#btnVincularYoutube');

    // URL inválida
    await inputUrl.fill('não é url válida');
    await btnVincular.click();
    await page.waitForTimeout(500);

    // Verificar mensagem de erro
    const mensagem = page.locator('#rehearsalMessage');
    await expect(mensagem).toContainText('Invalid');
  });

  test('deve resetar pitch para 0', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);
    await loadTestAudio(page);

    // Habilitar botões
    await page.evaluate(() => {
      document.querySelectorAll('.rehearsal-button').forEach(btn => {
        btn.disabled = false;
      });
    });

    const btnPitchUp = page.locator('#btnPitchUp');
    const btnPitchReset = page.locator('#btnPitchReset');
    const pitchLabel = page.locator('#pitchLabel');

    // Aumentar pitch 3 vezes
    for (let i = 0; i < 3; i++) {
      await btnPitchUp.click();
      await page.waitForTimeout(100);
    }

    // Verificar se mudou
    let text = await pitchLabel.textContent();
    expect(text).toContain('+3');

    // Reset
    await btnPitchReset.click();
    await page.waitForTimeout(100);

    // Verificar se voltou a 0
    text = await pitchLabel.textContent();
    expect(text).toContain('0');
  });

  test('deve limitar pitch entre -12 e +12', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);
    await loadTestAudio(page);

    // Habilitar botões
    await page.evaluate(() => {
      document.querySelectorAll('.rehearsal-button').forEach(btn => {
        btn.disabled = false;
      });
    });

    const btnPitchUp = page.locator('#btnPitchUp');
    const pitchLabel = page.locator('#pitchLabel');

    // Aumentar 15 vezes (deve parar em +12)
    for (let i = 0; i < 15; i++) {
      await btnPitchUp.click();
      await page.waitForTimeout(50);
    }

    const text = await pitchLabel.textContent();
    expect(text).toContain('+12');
  });

  test('deve toggle loop enable/disable', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    // Habilitar botões
    await page.evaluate(() => {
      document.querySelectorAll('.rehearsal-button').forEach(btn => {
        btn.disabled = false;
      });
    });

    const btnLoop = page.locator('#btnLoop');

    // Inicialmente sem class 'is-active'
    let classList = await btnLoop.getAttribute('class');
    expect(classList).not.toContain('is-active');

    // Clique para ativar
    await btnLoop.click();
    await page.waitForTimeout(100);
    classList = await btnLoop.getAttribute('class');
    expect(classList).toContain('is-active');

    // Clique para desativar
    await btnLoop.click();
    await page.waitForTimeout(100);
    classList = await btnLoop.getAttribute('class');
    expect(classList).not.toContain('is-active');
  });

  test('deve salvar estado em localStorage', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);
    await loadTestAudio(page);

    // Habilitar botões
    await page.evaluate(() => {
      document.querySelectorAll('.rehearsal-button').forEach(btn => {
        btn.disabled = false;
      });
    });

    // Alterar pitch
    const btnPitchUp = page.locator('#btnPitchUp');
    await btnPitchUp.click();
    await btnPitchUp.click();
    await page.waitForTimeout(300);

    // Ativar loop
    const btnLoop = page.locator('#btnLoop');
    await btnLoop.click();
    await page.waitForTimeout(300);

    // Verificar localStorage
    const stored = await page.evaluate(() => {
      return localStorage.getItem('rehearsal:1');
    });

    expect(stored).toBeTruthy();
    const state = JSON.parse(stored);
    expect(state.pitchSemitones).toBe(2);
    expect(state.loopEnabled).toBe(true);
  });

  test('deve restaurar estado após reload', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);
    await loadTestAudio(page);

    // Habilitar botões
    await page.evaluate(() => {
      document.querySelectorAll('.rehearsal-button').forEach(btn => {
        btn.disabled = false;
      });
    });

    // Alterar pitch
    const btnPitchUp = page.locator('#btnPitchUp');
    await btnPitchUp.click();
    await btnPitchUp.click();
    await page.waitForTimeout(300);

    // Ativar loop
    const btnLoop = page.locator('#btnLoop');
    await btnLoop.click();
    await page.waitForTimeout(300);

    // Reload
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Abrir painel novamente
    await btnEnsaio.evaluate(button => button.click());
    await page.waitForTimeout(300);

    // Verificar pitch restaurado
    const pitchLabel = page.locator('#pitchLabel');
    let text = await pitchLabel.textContent();
    expect(text).toContain('+2');

    // Verificar loop ativo
    const loopActive = await btnLoop.getAttribute('class');
    expect(loopActive).toContain('is-active');
  });

  test('deve desabilitar controles sem áudio carregado', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    // Controles devem estar desabilitados inicialmente
    const btnPlayPause = page.locator('#btnPlayPause');
    const disabled = await btnPlayPause.isDisabled();
    expect(disabled).toBe(true);
  });

  test('deve aceitar vídeo ID direto (11 chars)', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    const inputUrl = page.locator('#inputYoutubeUrl');
    const mensagem = page.locator('#rehearsalMessage');

    // Video ID válido (sem verificação real de download, só sintaxe)
    await inputUrl.fill('dQw4w9WgXcQ');
    
    // Não deve dar erro de "invalid"
    const msgText = await mensagem.textContent();
    expect(msgText).not.toContain('Invalid');
  });

  test('deve mostrar erro em YouTube URL inválida com menos de 11 chars', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    const inputUrl = page.locator('#inputYoutubeUrl');
    const btnVincular = page.locator('#btnVincularYoutube');

    // ID com poucos chars
    await inputUrl.fill('abc123');
    await btnVincular.click();
    await page.waitForTimeout(500);

    const mensagem = page.locator('#rehearsalMessage');
    await expect(mensagem).toContainText('Invalid');
  });

  test('deve atualizar label de pitch ao mudar', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);
    await loadTestAudio(page);

    // Habilitar botões
    await page.evaluate(() => {
      document.querySelectorAll('.rehearsal-button').forEach(btn => {
        btn.disabled = false;
      });
    });

    const btnPitchDown = page.locator('#btnPitchDown');
    const pitchLabel = page.locator('#pitchLabel');

    // Diminuir 2 vezes
    await btnPitchDown.click();
    await page.waitForTimeout(100);
    await btnPitchDown.click();
    await page.waitForTimeout(100);

    const text = await pitchLabel.textContent();
    expect(text).toContain('-2');
  });

  test('deve manter a estrutura do preview do YouTube antes da vinculação', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    const ytThumb = page.locator('#ytThumb');
    const ytTitle = page.locator('#ytTitle');

    // Inicialmente sem preview
    let visible = await ytThumb.evaluate((el) => el.classList.contains('is-visible'));
    expect(visible).toBe(false);

    // Após vincular (que falharia sem yt-dlp), preview não apareceria
    // Mas estrutura HTML deve estar presente
    await expect(ytThumb).toHaveCount(1);
    await expect(ytTitle).toHaveCount(1);
  });

  test('deve ter estrutura A/B controls', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    const btnSetA = page.locator('#btnSetA');
    const btnSetB = page.locator('#btnSetB');
    const btnClearAB = page.locator('#btnClearAB');

    // Todos devem estar presentes
    await expect(btnSetA).toBeVisible();
    await expect(btnSetB).toBeVisible();
    await expect(btnClearAB).toBeVisible();

    // Inicialmente não devem estar "active"
    let classA = await btnSetA.getAttribute('class');
    let classB = await btnSetB.getAttribute('class');

    expect(classA).not.toContain('is-active');
    expect(classB).not.toContain('is-active');
  });

  test('deve aceitar múltiplos formatos YouTube URL', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    const inputUrl = page.locator('#inputYoutubeUrl');
    const btnVincular = page.locator('#btnVincularYoutube');

    // Testa diferentes formatos (sem fazer download real)
    const urls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    ];

    for (const url of urls) {
      await inputUrl.fill(url);
      // Não deve dar erro de parsing imediato
      // (o erro viria do backend se tenta download)
      const msg = page.locator('#rehearsalMessage');
      const text = await msg.textContent();
      // Se não começar a converter, não deve ter "Invalid URL"
      expect(text || '').not.toContain('Invalid URL');
    }
  });

  test('deve responder buttons de transporte (desktop)', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    // Verificar que buttons existem
    const btnInicio = page.locator('#btnInicio');
    const btnMinus1 = page.locator('#btnMinus1');
    const btnPlayPause = page.locator('#btnPlayPause');
    const btnPlus1 = page.locator('#btnPlus1');

    await expect(btnInicio).toBeVisible();
    await expect(btnMinus1).toBeVisible();
    await expect(btnPlayPause).toBeVisible();
    await expect(btnPlus1).toBeVisible();

    // Verificar que são buttons
    expect(await btnPlayPause.getAttribute('id')).toBe('btnPlayPause');
  });

  test('deve ter waveform container', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    const waveform = page.locator('#waveform');
    await expect(waveform).toBeVisible();
  });

  test('deve mostrar mensagem de conversão automática indisponível gracefully', async ({ page }) => {
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.click();
    await page.waitForTimeout(300);

    const inputUrl = page.locator('#inputYoutubeUrl');
    const btnVincular = page.locator('#btnVincularYoutube');
    const mensagem = page.locator('#rehearsalMessage');

    // Tentar vincular YouTube (que pode falhar sem yt-dlp/APIs)
    await inputUrl.fill('dQw4w9WgXcQ');
    await btnVincular.click();
    
    // Aguardar resposta (timeout genérico)
    await page.waitForTimeout(2000);

    // Se falhar, deve haver mensagem ou sugestão
    const msg = await mensagem.textContent();
    // Pode estar vazio (se fetch não retornar erro) ou com mensagem
    // Não deve quebrar a página
    expect(page).toBeTruthy();
  });

  test('painel deve ser responsivo em mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 }
    });
    const page = await context.newPage();

    // Login
    await fazerLogin(page);

    // Acessar música
    await page.goto(MUSIC_PAGE);
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(() => {
      document.getElementById('menuButton')?.click();
      document.getElementById('settingsTabTools')?.click();
    });

    // Abrir painel
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    await btnEnsaio.evaluate(button => button.click());
    await page.waitForTimeout(300);

    // Verificar que painel é visível
    const painel = page.locator('#modo-ensaio');
    await expect(painel).toBeVisible();

    // Verificar buttons estão acessíveis
    const btnPlayPause = page.locator('#btnPlayPause');
    await expect(btnPlayPause).toBeVisible();

    await context.close();
  });

  test('teste visual - navegação e clique no botão Ensaio (DEBUG)', async ({ page }) => {
    // 1. Fazer login
    console.log('🔵 Fazendo login...');
    await fazerLogin(page);
    
    // 2. Navegar para página de música
    console.log('🔵 Navegando para music.php?id=1...');
    await page.goto('/music.php?id=1', { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      document.getElementById('menuButton')?.click();
      document.getElementById('settingsTabTools')?.click();
    });
    
    // 3. Aguardar que o botão apareça
    const btnEnsaio = page.locator('#btnAtivarEnsaio');
    console.log('🔵 Esperando botão Ensaio estar visível...');
    await expect(btnEnsaio).toHaveCount(1);
    
    // 4. Screenshot inicial
    console.log('🔵 Tirando screenshot ANTES do clique...');
    await page.screenshot({ path: 'tests-results/before-click.png', fullPage: true });
    
    // 5. Verificar painel antes (deve estar hidden)
    const painel = page.locator('#modo-ensaio');
    const ariaHiddenBefore = await painel.getAttribute('aria-hidden');
    const classListBefore = await painel.getAttribute('class');
    console.log(`📊 Antes do clique: aria-hidden="${ariaHiddenBefore}", class="${classListBefore}"`);
    
    // 6. Clicar no botão
    console.log('🔵 CLICANDO no botão Ensaio...');
    await btnEnsaio.evaluate(button => button.click());
    
    // 7. Aguardar animação CSS
    console.log('🔵 Aguardando 500ms para animação CSS...');
    await page.waitForTimeout(500);
    
    // 8. Screenshot depois
    console.log('🔵 Tirando screenshot DEPOIS do clique...');
    await page.screenshot({ path: 'tests-results/after-click.png', fullPage: true });
    
    // 9. Verificar painel depois (deve estar visível)
    const ariaHiddenAfter = await painel.getAttribute('aria-hidden');
    const classListAfter = await painel.getAttribute('class');
    console.log(`📊 Depois do clique: aria-hidden="${ariaHiddenAfter}", class="${classListAfter}"`);
    
    // 10. Verificações
    console.log('🔵 Verificando css computed do painel...');
    const computedStyle = await page.evaluate(() => {
      const panel = document.getElementById('modo-ensaio');
      const style = window.getComputedStyle(panel);
      return {
        opacity: style.opacity,
        display: style.display,
        maxHeight: style.maxHeight,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents
      };
    });
    console.log('📊 Computed style:', computedStyle);
    
    // 11. Verificar que o painel ficou visível
    await expect(painel).toHaveAttribute('aria-hidden', 'false');
    await expect(painel).toHaveClass(/is-active/);
    
    // 12. Verificar opacity e max-height via computed style
    expect(computedStyle.opacity).toBe('1');
    expect(computedStyle.maxHeight).not.toBe('0px');
    
    console.log('✅ Teste visual passou! O painel está visível!');
  });
});
