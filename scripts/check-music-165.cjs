(async () => {
  const { chromium } = require('playwright');
  const chordRegex = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d{0,2}(?:\([^)]+\))?(?:\/[A-G](?:#|b)?)?$/i;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:8090/login.php', { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', 'felipe');
  await page.fill('input[name="senha"]', '123');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');

  await page.goto('http://localhost:8090/music.php?id=165', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const columnCheck = await page.evaluate((regexSource) => {
    const el = document.getElementById('song-cifra');
    if (!el) return { columns: 0, chordOnlyColumns: 0 };

    const columns = Array.from(el.querySelectorAll(':scope > div > div'));
    let chordOnlyColumns = 0;
    const re = new RegExp(regexSource, 'i');

    columns.forEach(col => {
      const lines = Array.from(col.children);
      let hasLyric = false;

      lines.forEach(line => {
        const text = (line.innerText || '').replace(/\u00a0/g, ' ').trim();
        if (!text) return;

        const tokens = text.split(/\s+/).filter(Boolean);
        const hasNonChord = tokens.some(t => !re.test(t.replace(/[.,;:!?]/g, '')));
        if (hasNonChord) {
          hasLyric = true;
        }
      });

      if (!hasLyric && lines.length) chordOnlyColumns += 1;
    });

    return { columns: columns.length, chordOnlyColumns };
  }, chordRegex.source);

  await page.screenshot({ path: 'test-results/music-165.png', fullPage: false });
  console.log('Columns:', columnCheck.columns, 'Chord-only columns:', columnCheck.chordOnlyColumns);

  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
