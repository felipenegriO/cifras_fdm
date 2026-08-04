import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

const routes = [
  '/index.php',
  '/src/backend/editor/editorplaylist.php',
  '/plano.php',
  '/users.php',
  '/config.php',
  '/src/backend/editor/editor.php',
];

for (const path of routes) {
  test(`${path} preserva semântica, foco e largura da viewport`, async ({ page }) => {
    await page.goto(path);
    const audit = await page.evaluate(() => {
      const unlabeled = [...document.querySelectorAll('button, input:not([type="hidden"]), select, textarea')]
        .filter(element => element.offsetParent !== null && !element.disabled)
        .filter(element => {
          const id = element.getAttribute('id');
          return !element.getAttribute('aria-label')
            && !element.getAttribute('aria-labelledby')
            && !element.getAttribute('title')
            && !element.closest('label')
            && !(id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
            && !(element instanceof HTMLButtonElement && element.textContent.trim());
        })
        .map(element => element.outerHTML.slice(0, 160));
      return {
        headings: document.querySelectorAll('h1').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        unlabeled,
      };
    });
    expect(audit.headings).toBeGreaterThan(0);
    expect(audit.overflow).toBeLessThanOrEqual(1);
    expect(audit.unlabeled).toEqual([]);

    await page.keyboard.press('Tab');
    await expect.poll(() => page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return false;
      const style = getComputedStyle(element);
      return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
    })).toBe(true);
  });
}

test('movimento reduzido desativa animações e rolagem suave', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/index.php');
  const styles = await page.evaluate(() => {
    const element = document.querySelector('.skeleton') || document.body;
    return {
      animation: getComputedStyle(element).animationDuration,
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });
  expect(parseFloat(styles.animation)).toBeLessThanOrEqual(0.00001);
  expect(styles.scroll).toBe('auto');
});
