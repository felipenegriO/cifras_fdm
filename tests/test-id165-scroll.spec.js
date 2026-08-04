import { test } from './fixtures/coverage.js';
import { fazerLogin } from './helpers/auth';

test('cifra não deve ter rolagem vertical dupla', async ({ page }) => {
  await fazerLogin(page);
  await page.evaluate(song => sessionStorage.setItem('cifroEditorPreview', JSON.stringify(song)), {
    id: 0,
    nome: '__SCROLL_VISUAL_TEST__',
    artista: 'Playwright',
    bit: '120',
    cifra: Array.from({ length: 40 }, (_, index) => `<p>C G Am F</p><p>Linha ${index + 1} para validar rolagem.</p>`).join(''),
  });
  await page.goto('/music.php?editorPreview=1', { waitUntil: 'domcontentloaded' });

  await page.locator('#song-cifra').waitFor({ state: 'visible', timeout: 15000 });

  // Get container and check scrollbars
  const containerScroll = await page.evaluate(() => {
    const cifraDiv = document.getElementById('song-cifra');
    if (!cifraDiv) return { error: 'song-cifra not found' };
    
    return {
      overflowY: cifraDiv.style.overflowY,
      scrollHeight: cifraDiv.scrollHeight,
      clientHeight: cifraDiv.clientHeight,
      hasContainerScroll: cifraDiv.scrollHeight > cifraDiv.clientHeight,
      
      bodyScrollHeight: document.body.scrollHeight,
      bodyClientHeight: window.innerHeight,
      hasBodyScroll: document.body.scrollHeight > window.innerHeight,
      
      htmlScrollHeight: document.documentElement.scrollHeight,
      htmlClientHeight: document.documentElement.clientHeight,
      hasHtmlScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      
      dataOverflowY: cifraDiv.dataset.actualOverflowY,
      dataHeightUsage: cifraDiv.dataset.heightUsage
    };
  });

  const containerHasScroll = containerScroll.hasContainerScroll;
  const bodyHasScroll = containerScroll.hasBodyScroll;
  const hasDoubleScroll = containerHasScroll && bodyHasScroll;
  if (hasDoubleScroll) {
    throw new Error('Rolagem vertical dupla detectada na prévia da música.');
  }
});
