import { test } from '@playwright/test';
import { fazerLogin } from './helpers/auth';

test('id 165 should NOT have double vertical scroll', async ({ page, context, viewport }) => {
  test.setTimeout(60000);
  
  // First do login to ensure authenticated
  await fazerLogin(page);
  
  // Navigate to id 165
  await page.goto('http://localhost:8090/music.php?id=165', { waitUntil: 'domcontentloaded' });
  
  // Wait for the container to load
  await page.waitForSelector('#song-cifra', { state: 'visible', timeout: 15000 });

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

  console.log('=== ID 165 Scroll Analysis ===');
  console.log(JSON.stringify(containerScroll, null, 2));

  // Should NOT have TWO separate scrollbars
  const containerHasScroll = containerScroll.hasContainerScroll;
  const bodyHasScroll = containerScroll.hasBodyScroll;
  const hasDoubleScroll = containerHasScroll && bodyHasScroll;

  if (hasDoubleScroll) {
    console.warn('WARNING: Double scroll detected!');
    console.warn(`  - Container scroll: ${containerScroll.scrollHeight} > ${containerScroll.clientHeight}`);
    console.warn(`  - Body scroll: ${containerScroll.bodyScrollHeight} > ${containerScroll.bodyClientHeight}`);
  }

  // Expectations
  console.log(`\nContainer has scroll: ${containerHasScroll}`);
  console.log(`Body has scroll: ${bodyHasScroll}`);
  console.log(`Double scroll issue: ${hasDoubleScroll}`);

  // The test: we should NOT have BOTH container and body scroll active
  // Either container scroll OR body scroll, but not both
  if (hasDoubleScroll) {
    throw new Error(`Double vertical scroll detected on id 165! Container overflow, Body scroll both active.`);
  }
});
