import { test, expect } from '@playwright/test';
import { fazerLogin } from '../helpers/auth';

test.describe.configure({ mode: 'serial' });

const TOL_X = 2;
const TOL_Y = 6;
const TOL_VIEWPORT = 8;

const PAGE_PATH = (id) => `/music.php?id=${id}`;
const SONG_IDS = Array.from({ length: 100 }, (_, index) => index + 1);
const CHORD_TOKEN_REGEX = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d{0,2}(?:\([^)]+\))?(?:\/[A-G](?:#|b)?)?$/i;

const VIEWPORTS = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'desktop-1366x768', width: 1366, height: 768 },
  { name: 'desktop-1366x1024', width: 1366, height: 1024 },
  { name: 'laptop-1280x720', width: 1280, height: 720 },
  { name: 'tablet-1024x768', width: 1024, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-414x896', width: 414, height: 896 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-812x375', width: 812, height: 375 }
];

const waitForLayoutStabilize = async (page) => {
  await page.evaluate(() => {
    if (typeof window.__reflowCifra === 'function') {
      window.__reflowCifra();
    }
  });
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
};

const normalizeNotFound = (text) => {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
};

const ensureAuthenticated = async (page) => {
  if (page.url().includes('/login.php')) {
    await fazerLogin(page);
    return true;
  }

  const loginForm = await page.locator('#loginForm').count();
  if (loginForm > 0) {
    await fazerLogin(page);
    return true;
  }

  return false;
};

test.describe('Music Layout', () => {
  for (const viewport of VIEWPORTS) {
    test(`layout fits viewport (${viewport.name})`, async ({ page }) => {
      test.setTimeout(240000);
      const consoleErrors = [];

      const isBenignConsoleError = (message) => {
        if (!message) return true;
        return message.includes('net::ERR_FAILED');
      };

      const pushConsoleError = (message) => {
        if (message) {
          consoleErrors.push(message);
        }
      };

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!isBenignConsoleError(text)) {
            pushConsoleError(text);
          }
        }
      });

      page.on('pageerror', (err) => {
        const message = err && err.message ? err.message : String(err);
        if (!isBenignConsoleError(message)) {
          pushConsoleError(message);
        }
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await fazerLogin(page);

      for (const songId of SONG_IDS) {
        await page.goto(PAGE_PATH(songId), { waitUntil: 'domcontentloaded' });

        if (await ensureAuthenticated(page)) {
          await page.goto(PAGE_PATH(songId), { waitUntil: 'domcontentloaded' });
        }

        const rawText = await page.evaluate(() => (document.body && document.body.innerText) || '');
        const pageText = normalizeNotFound(rawText);
        if (pageText.includes('musica nao encontrada')) {
          console.warn(`Skipping id=${songId} (${viewport.name}). Song not found.`);
          continue;
        }

        await expect(page.locator('#song-cifra')).toBeVisible();
        await waitForLayoutStabilize(page);

        const metrics = await page.evaluate((regexSource) => {
          const el = document.getElementById('song-cifra');
          if (!el) {
            return { missing: true };
          }

          const rect = el.getBoundingClientRect();
          const viewport = window.visualViewport;
          const viewportWidth = viewport ? viewport.width : document.documentElement.clientWidth;
          const viewportHeight = viewport ? viewport.height : document.documentElement.clientHeight;
          const overflowX = el.scrollWidth - el.clientWidth;
          const overflowY = el.scrollHeight - el.clientHeight;
          const overflowYStyle = window.getComputedStyle(el).overflowY;

          const wrapper = el.querySelector(':scope > div');
          const wrapperOverflowX = wrapper ? wrapper.scrollWidth - el.clientWidth : 0;
          const columns = wrapper ? Array.from(wrapper.children) : [];
          const hasColumns = columns.length > 0;
          const autoColumns = el.classList.contains('auto-columns');

          const playBar = document.getElementById('mostrarbtnplay');
          const playVisible = !!(playBar && playBar.offsetParent !== null);
          const playRect = playVisible ? playBar.getBoundingClientRect() : null;

          const re = new RegExp(regexSource, 'i');

          const getLineInfo = (line) => {
            const text = (line.innerText || '').replace(/\u00a0/g, ' ').trim();
            if (!text) return { empty: true, chordOnly: false, hasLyric: false };
            const tokens = text.split(/\s+/).filter(Boolean);
            let hasNonChord = false;

            tokens.forEach((token) => {
              const cleaned = token.replace(/[.,;:!?]/g, '');
              if (cleaned && !re.test(cleaned)) {
                hasNonChord = true;
              }
            });

            return {
              empty: false,
              chordOnly: tokens.length > 0 && !hasNonChord,
              hasLyric: hasNonChord
            };
          };

          const getFirstNonEmptyLine = (lines) => {
            for (const line of lines) {
              const info = getLineInfo(line);
              if (!info.empty) return info;
            }
            return null;
          };

          const getLastNonEmptyLine = (lines) => {
            for (let i = lines.length - 1; i >= 0; i -= 1) {
              const info = getLineInfo(lines[i]);
              if (!info.empty) return info;
            }
            return null;
          };

          let badChordBreaks = 0;
          let trailingChordOnlySmallColumn = 0;

          columns.forEach((col, index) => {
            const lines = Array.from(col.children);
            const lastInfo = getLastNonEmptyLine(lines);
            const nextCol = columns[index + 1];
            const nextLines = nextCol ? Array.from(nextCol.children) : [];
            const firstInfo = nextCol ? getFirstNonEmptyLine(nextLines) : null;

            if (lastInfo && lastInfo.chordOnly && firstInfo && firstInfo.hasLyric) {
              badChordBreaks += 1;
            }

            const nonEmptyInfos = lines.map(getLineInfo).filter((info) => !info.empty);
            const allChordOnly = nonEmptyInfos.length > 0 && nonEmptyInfos.every((info) => info.chordOnly);
            if (lines.length <= 2 && allChordOnly) {
              const prevCol = columns[index - 1];
              const prevLines = prevCol ? Array.from(prevCol.children) : [];
              const prevLast = prevCol ? getLastNonEmptyLine(prevLines) : null;
              if (!prevLast || !prevLast.hasLyric) {
                trailingChordOnlySmallColumn += 1;
              }
            }
          });

          return {
            missing: false,
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              right: rect.right,
              bottom: rect.bottom
            },
            viewportWidth,
            viewportHeight,
            overflowX,
            overflowY,
            overflowYStyle,
            wrapperOverflowX,
            wrapperWidth: wrapper ? wrapper.getBoundingClientRect().width : 0,
            hasColumns,
            autoColumns,
            playVisible,
            playRect: playRect ? { top: playRect.top, bottom: playRect.bottom } : null,
            columnsCount: columns.length,
            badChordBreaks,
            trailingChordOnlySmallColumn
          };
        }, CHORD_TOKEN_REGEX.source);

        if (metrics.missing) {
          throw new Error(`Missing #song-cifra for id=${songId} (${viewport.name}).`);
        }

        if (consoleErrors.length) {
          const errorMessage = consoleErrors.join('\n');
          consoleErrors.length = 0;
          throw new Error(`Console errors for id=${songId} (${viewport.name}):\n${errorMessage}`);
        }

        expect(metrics.overflowX).toBeLessThanOrEqual(TOL_X);
        if (metrics.hasColumns) {
          expect(metrics.wrapperOverflowX).toBeLessThanOrEqual(TOL_X);
        }

        if (metrics.overflowYStyle === 'hidden' || metrics.overflowYStyle === 'clip') {
          expect(metrics.overflowY).toBeLessThanOrEqual(TOL_Y);
        }

        const playHeight = metrics.playVisible && metrics.playRect
          ? Math.max(0, metrics.playRect.bottom - metrics.playRect.top)
          : 0;
        const extraBottomSafety = metrics.playVisible ? 50 : 22;
        const bottomOverlay = (metrics.playVisible ? playHeight + 10 : 0) + extraBottomSafety;
        const heightSafety = metrics.viewportWidth <= 1024 ? 16 : 8;
        const availableHeight = Math.max(
          1,
          metrics.viewportHeight - metrics.rect.y - 16 - bottomOverlay - heightSafety
        );
        const widthSafety = metrics.viewportWidth <= 1024
          ? (metrics.viewportHeight < metrics.viewportWidth ? 24 : 16)
          : 12;
        const availableWidth = Math.max(
          1,
          metrics.viewportWidth - metrics.rect.x - 16 - widthSafety
        );

        const visibleHeightRatio = metrics.rect.height / availableHeight;
        expect(visibleHeightRatio).toBeGreaterThanOrEqual(0.8);

        const visibleWidthRatio = metrics.rect.width / availableWidth;
        expect(visibleWidthRatio).toBeGreaterThanOrEqual(0.55);

        const minColWidth = 140;
        const minGap = 15;
        const canFitExtraColumn = metrics.wrapperWidth + minColWidth + minGap <= metrics.rect.width + TOL_X;
        if (canFitExtraColumn) {
          throw new Error(`More columns could fit (${viewport.name}, id=${songId}).`);
        }

        expect(metrics.rect.x).toBeGreaterThanOrEqual(-TOL_VIEWPORT);
        expect(metrics.rect.y).toBeGreaterThanOrEqual(-TOL_VIEWPORT);
        expect(metrics.rect.right).toBeLessThanOrEqual(metrics.viewportWidth + TOL_VIEWPORT);
        expect(metrics.rect.bottom).toBeLessThanOrEqual(metrics.viewportHeight + TOL_VIEWPORT);

        if (metrics.playVisible && metrics.playRect) {
          expect(metrics.rect.bottom).toBeLessThanOrEqual(metrics.playRect.top + TOL_Y);
        }

        if (metrics.autoColumns && metrics.hasColumns) {
          expect(metrics.badChordBreaks).toBe(0);
          if (metrics.trailingChordOnlySmallColumn > 0) {
            console.warn(`Warning: chord-only small columns for id=${songId} (${viewport.name})`);
          }
        }

        if (metrics.viewportHeight <= 420 && metrics.viewportWidth > metrics.viewportHeight) {
          const minColWidth = 140;
          const minGap = 15;
          const canFitExtraColumn = metrics.wrapperWidth + minColWidth + minGap <= metrics.rect.width + TOL_X;
          if (canFitExtraColumn) {
            expect(metrics.columnsCount).toBeGreaterThanOrEqual(2);
          }
        }
      }
    });
  }
});
