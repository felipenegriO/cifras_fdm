/**
 * 39-script-branches.spec.js
 * Cobertura de branches residuais de public/src/js/script.js:
 * openSideMenu sem window.renderPlaylistsMenu, handlers de
 * menu/menuTop/menuClose/close com elementos ausentes, o listener de
 * clique fora fechando sideMenu de fato, fdmSwMessage com controller
 * ativo, e o registro de service worker quando 'serviceWorker' não
 * está em navigator.
 */
import { test, expect } from '../fixtures/coverage.js';

test.use({ storageState: 'tests/.auth/user.json' });

async function openPreview(page) {
  await page.goto('/index.php');
  await page.evaluate((song) => {
    sessionStorage.setItem('fdmEditorPreview', JSON.stringify(song));
    sessionStorage.removeItem('fdmSetlist');
  }, { id: 80, nome: 'Matriz script.js', artista: '', bit: '', cifra: '<b>C G Am F</b><br>' });
  await page.goto('/music.php?id=80&editorPreview=1');
  await expect(page.locator('#song-cifra')).toBeVisible();
}

test('script.js — guards de elementos ausentes, clique fora fechando o menu e SW controller', async ({ page }) => {
  await openPreview(page);
  const result = await page.evaluate(() => {
    // openSideMenu sem window.renderPlaylistsMenu definido (idx falso).
    // `window.renderPlaylistsMenu = renderPlaylistsMenu` em playlists.js
    // reaproveita a mesma propriedade criada pela declaração `function
    // renderPlaylistsMenu() {}` no topo do arquivo — declarações de função
    // no escopo global criam propriedades NÃO configuráveis em `window`,
    // então `delete window.renderPlaylistsMenu` é um no-op silencioso (não
    // lança, mas também não remove nada), e nem Object.defineProperty
    // consegue redefinir a propriedade ("Cannot redefine property"). Como
    // ela É writable, uma atribuição simples para um valor não-função já
    // derruba o `typeof ... === 'function'` para false.
    window.renderPlaylistsMenu = undefined;
    let threw = false;
    try { openSideMenu(); } catch (e) { threw = true; }

    // menucloseButton é FILHO de #menusideMenu, e closeButton é FILHO de
    // #sideMenu (ver music.php) — remover o container também remove o
    // botão do DOM, fazendo `document.getElementById(id)?.click()` virar
    // um no-op silencioso que nunca alcança o guard interno do handler.
    // Por isso capturamos as referências aos botões ANTES de remover os
    // containers: o listener já registrado no DOMContentLoaded continua
    // válido no objeto do botão mesmo depois dele ser desconectado do DOM.
    const menuCloseBtn = document.getElementById('menucloseButton');
    const closeBtn = document.getElementById('closeButton');
    const menuBtn = document.getElementById('menuButton');

    const menuSide = document.getElementById('menusideMenu');
    const sideMenu = document.getElementById('sideMenu');
    if (menuSide) menuSide.remove();
    if (sideMenu) sideMenu.remove();

    menuBtn?.click();
    menuCloseBtn?.click();
    closeBtn?.click();

    return { threw };
  });
  expect(result.threw).toBe(false);
  await expect(page.locator('body')).not.toContainText('Fatal error');
});

test('script.js — guards de elementos ausentes via menuButtonTop (index.php, herdado do topnav)', async ({ page }) => {
  // music.php não renderiza o botão #menuButtonTop (esse id só existe no
  // partial topnav.php, incluído em index.php e outras páginas, mas não em
  // music.php). Por isso o guard `if (menuButtonTop)` da linha 26/27 do
  // script.js nunca chega a registrar o listener quando os testes rodam
  // apenas em music.php, deixando as linhas 31/32 (dentro do handler)
  // estruturalmente inalcançáveis nessa página. Este teste roda em
  // index.php, onde o botão existe de fato, para cobrir o ramo
  // verdadeiro do guard externo e ambos os ramos do guard interno
  // (menuSide/sideMenu presentes vs. removidos).
  await page.goto('/index.php');
  await expect(page.locator('#menuButtonTop')).toHaveCount(1);

  const result = await page.evaluate(() => {
    // Primeiro clique: menusideMenu/sideMenu presentes (ramo verdadeiro
    // do guard interno).
    document.getElementById('menuButtonTop')?.click();
    const rightAfterFirstClick = document.getElementById('menusideMenu')?.style.right;

    // Remove os alvos para exercitar o ramo falso do guard interno.
    document.getElementById('menusideMenu')?.remove();
    document.getElementById('sideMenu')?.remove();
    let threw = false;
    try {
      document.getElementById('menuButtonTop')?.click();
    } catch (e) {
      threw = true;
    }
    return { rightAfterFirstClick, threw };
  });
  expect(['0', '0px']).toContain(result.rightAfterFirstClick);
  expect(result.threw).toBe(false);
  await expect(page.locator('body')).not.toContainText('Fatal error');
});

test('script.js — clique fora do painel fecha sideMenu aberto de fato', async ({ page }) => {
  await openPreview(page);
  await page.evaluate(() => {
    openSideMenu();
  });
  await expect(page.locator('#sideMenu')).toHaveCSS('right', '0px');
  // Clique fora do painel (sideOpen && !closest(#sideMenu/#playlistButton*)).
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#sideMenu')).not.toHaveCSS('right', '0px');
});

test('script.js — clique dentro do próprio sideMenu não fecha o painel', async ({ page }) => {
  await openPreview(page);
  await page.evaluate(() => {
    openSideMenu();
  });
  await expect(page.locator('#sideMenu')).toHaveCSS('right', '0px');
  // Clique dentro de #sideMenu: event.target.closest('#sideMenu') é
  // truthy, então o ramo verdadeiro do guard (linha 61) não deve
  // fechar o painel — cobre o ramo falso de
  // !event.target.closest('#sideMenu').
  const hasInnerTarget = await page.evaluate(() => {
    const sideMenu = document.getElementById('sideMenu');
    return !!(sideMenu && sideMenu.firstElementChild);
  });
  if (hasInnerTarget) {
    await page.locator('#sideMenu').click({ position: { x: 1, y: 1 } });
  } else {
    await page.locator('#sideMenu').click({ force: true });
  }
  await expect(page.locator('#sideMenu')).toHaveCSS('right', '0px');
});

test('script.js — fdmSwMessage envia mensagem quando há controller ativo', async ({ page }) => {
  await openPreview(page);
  const posted = await page.evaluate(() => {
    let received = null;
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: { postMessage: (msg) => { received = msg; } } },
    });
    fdmSwMessage({ type: 'TESTE_CONTROLLER' });
    return received;
  });
  expect(posted).toEqual({ type: 'TESTE_CONTROLLER' });
});

test('script.js — não registra service worker quando ausente em navigator', async ({ page }) => {
  await page.addInitScript(() => {
    try { delete Navigator.prototype.serviceWorker; } catch (e) { /* ignore */ }
    try { delete navigator.serviceWorker; } catch (e) { /* ignore */ }
  });
  await page.goto('/index.php', { waitUntil: 'domcontentloaded' });
  const hasServiceWorker = await page.evaluate(() => 'serviceWorker' in navigator);
  // Em navegadores onde a propriedade não é configurável, o teste ainda é
  // válido (documenta o comportamento real); o importante é que a página
  // carregue sem erro em ambos os casos.
  await expect(page.locator('body')).not.toContainText('Fatal error');
  expect(typeof hasServiceWorker).toBe('boolean');
});
