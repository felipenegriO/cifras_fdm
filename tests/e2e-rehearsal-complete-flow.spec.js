import { test, expect } from '@playwright/test';
import { fazerLogin } from './helpers/auth';

test('E2E: Fluxo Completo do Modo Ensaio', async ({ page }) => {
  console.log('=== INICIANDO FLUXO COMPLETO DO MODO ENSAIO ===\n');

  // 1. Login
  console.log('1. ✓ Fazendo login...');
  await fazerLogin(page);
  const loginUrl = page.url();
  console.log(`   URL após login: ${loginUrl}`);

  // 2. Navegar para música
  console.log('\n2. ✓ Navegando para música...');
  await page.goto('/music.php?id=1');
  await page.waitForLoadState('networkidle');
  console.log(`   URL: ${page.url()}`);

  // 2.5 Injetar mock player
  console.log('\n2.5 ✓ Injetando mock player...');
  await page.evaluate(() => {
    const mockPlayer = {
      getPitchSemitones: () => {
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
  });

  // 3. Procurar botão Ensaio
  console.log('\n3. ✓ Procurando botão "Modo Ensaio"...');
  const btnEnsaio = page.locator('#btnAtivarEnsaio');
  await expect(btnEnsaio).toBeVisible();
  const btnText = await btnEnsaio.getAttribute('title');
  console.log(`   Botão encontrado: "${btnText}"`);

  // 4. Abrir painel
  console.log('\n4. ✓ Abrindo painel Ensaio...');
  await btnEnsaio.click();
  await page.waitForTimeout(300);
  
  const painel = page.locator('#modo-ensaio');
  const ariaHidden = await painel.getAttribute('aria-hidden');
  console.log(`   Painel visível: ${ariaHidden === 'false'}`);
  
  // 5. Verificar elementos do painel
  console.log('\n5. ✓ Verificando elementos do painel...');
  const inputYoutube = page.locator('#inputYoutubeUrl');
  const btnVincular = page.locator('#btnVincularYoutube');
  const btnPlayPause = page.locator('#btnPlayPause');
  const btnPitchUp = page.locator('#btnPitchUp');
  const btnPitchDown = page.locator('#btnPitchDown');
  const pitchLabel = page.locator('#pitchLabel');
  
  await expect(inputYoutube).toBeVisible();
  await expect(btnVincular).toBeVisible();
  await expect(btnPlayPause).toBeVisible();
  await expect(btnPitchUp).toBeVisible();
  console.log('   Todos elementos encontrados ✓');

  // 6. Habilitar botões para teste
  console.log('\n6. ✓ Habilitando botões de controle...');
  await page.evaluate(() => {
    document.querySelectorAll('.rehearsal-button').forEach(btn => {
      btn.disabled = false;
    });
  });
  console.log('   Botões habilitados ✓');

  // 7. Testar pitch up
  console.log('\n7. ✓ Testando Pitch UP (aumentar tom)...');
  await btnPitchUp.click();
  await page.waitForTimeout(100);
  let pitchText = await pitchLabel.textContent();
  console.log(`   Pitch atual: ${pitchText}`);
  expect(pitchText).toContain('+1');

  // 8. Aumentar mais 2 vezes
  console.log('\n8. ✓ Aumentando pitch mais 2x...');
  await btnPitchUp.click();
  await page.waitForTimeout(100);
  await btnPitchUp.click();
  await page.waitForTimeout(100);
  pitchText = await pitchLabel.textContent();
  console.log(`   Pitch após 3 cliques: ${pitchText}`);
  expect(pitchText).toContain('+3');

  // 9. Testar pitch down
  console.log('\n9. ✓ Testando Pitch DOWN (diminuir tom)...');
  await btnPitchDown.click();
  await page.waitForTimeout(100);
  pitchText = await pitchLabel.textContent();
  console.log(`   Pitch após DOWN: ${pitchText}`);
  expect(pitchText).toContain('+2');

  // 10. Verificar localStorage
  console.log('\n10. ✓ Verificando localStorage...');
  const stored = await page.evaluate(() => {
    return localStorage.getItem('rehearsal:1');
  });
  expect(stored).toBeTruthy();
  const state = JSON.parse(stored);
  console.log(`   Estado salvo: pitchSemitones = ${state.pitchSemitones}`);
  expect(state.pitchSemitones).toBe(2);

  // 11. Testar toggle loop
  console.log('\n11. ✓ Testando LOOP toggle...');
  const btnLoop = page.locator('#btnLoop');
  
  // Desativar
  let classList = await btnLoop.getAttribute('class');
  console.log(`   Loop inicialmente: ${classList.includes('is-active') ? 'ATIVO' : 'INATIVO'}`);
  
  // Ativar
  await btnLoop.click();
  await page.waitForTimeout(100);
  classList = await btnLoop.getAttribute('class');
  console.log(`   Após clique: ${classList.includes('is-active') ? 'ATIVO' : 'INATIVO'}`);
  expect(classList).toContain('is-active');

  // 12. Verificar YouTube input
  console.log('\n12. ✓ Testando YouTube URL input...');
  await inputYoutube.fill('dQw4w9WgXcQ');
  const inputValue = await inputYoutube.inputValue();
  console.log(`   YouTube ID preenchido: ${inputValue}`);
  expect(inputValue).toBe('dQw4w9WgXcQ');

  // 13. Fechar painel
  console.log('\n13. ✓ Fechando painel Ensaio...');
  await btnEnsaio.click();
  await page.waitForTimeout(300);
  const isClosed = await painel.getAttribute('aria-hidden');
  console.log(`   Painel fechado: ${isClosed === 'true'}`);
  expect(isClosed).toBe('true');

  // 14. Reabrir e verificar estado restaurado
  console.log('\n14. ✓ Reabrindo painel e verificando estado restaurado...');
  await btnEnsaio.click();
  await page.waitForTimeout(300);
  
  const isOpen = await painel.getAttribute('aria-hidden');
  console.log(`   Painel reaberto: ${isOpen === 'false'}`);
  expect(isOpen).toBe('false');

  pitchText = await pitchLabel.textContent();
  console.log(`   Pitch restaurado: ${pitchText}`);
  expect(pitchText).toContain('+2');

  classList = await btnLoop.getAttribute('class');
  console.log(`   Loop status: ${classList.includes('is-active') ? 'ATIVO' : 'INATIVO'}`);

  console.log('\n=== ✓ FLUXO COMPLETO FUNCIONANDO COM SUCESSO! ===\n');
});
