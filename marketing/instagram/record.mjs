/**
 * Gravador quadro a quadro do Reel do Cifro.
 *
 * Sobe o servidor PHP contra o banco de demonstracao `cifro_demo`, abre duas
 * sessoes reais do app (host e membro) em contextos separados, dirige o app nos
 * quadros-chave declarados por `stage/timeline.js` e fotografa o palco
 * 1080x1920 uma vez por quadro.
 *
 * Nada aqui e encenado: o Modo Live troca a tela do membro porque o host
 * navegou de verdade, a transposicao usa o botao real da barra de controles e a
 * cena offline corta a rede e recarrega, deixando o service worker responder.
 *
 * Saida: out/frames/frame-000000.png ... frame-001799.png (60s a 30fps).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..', '..');
const OUT = path.join(DIR, 'out', 'frames');
const PORT = 8095;
const APP = `http://127.0.0.1:${PORT}`;
const PHP = 'C:/xampp/php/php.exe';

// Casa exatamente com a tela interna de .phone-bezel no stage.css
// (400x850 menos 12px de padding em volta) — evita corte no object-fit.
const PHONE = { width: 376, height: 826 };

const CREDS = {
  host:   { email: 'host@demo.local',   password: 'CifroDemo#2026!' },
  member: { email: 'membro@demo.local', password: 'CifroDemo#2026!' },
};

// A gravacao so pode falar com o banco de demonstracao local.
const DEMO_DB = 'cifro_demo';
const DEMO_HOST = '127.0.0.1';

// Playlist "Culto de Domingo" semeada pela Task 1 (marketing/instagram/seed-demo.php).
const SETLIST = [
  { id: 1, tom: 'G' }, { id: 2, tom: 'D' }, { id: 3, tom: 'E' },
  { id: 4, tom: 'C' }, { id: 5, tom: 'A' }, { id: 6, tom: 'F' },
];
const ROTEIRO_ID = 1; // "Ordem do Culto de Domingo"
const songUrl = ({ id, tom }) => `${APP}/music.php?id=${id}&playlistTom=${tom}`;

// Janelas em que a tela do app se move de verdade e precisa ser refotografada
// a cada quadro. Fora delas, reaproveitamos a ultima foto — o app esta parado.
const LIVE_WINDOWS = [[1008, 1060], [1090, 1120], [1140, 1200]];
const inLiveWindow = frame => LIVE_WINDOWS.some(([from, to]) => frame >= from && frame < to);

const serverEnv = {
  ...process.env,
  DB_HOST: DEMO_HOST,
  DB_NAME: DEMO_DB,
  APP_ENV: 'development',
  APP_DEBUG: 'false',
  // Impede que uma lista herdada do processo pai deixe um arquivo .env
  // sobrescrever DB_HOST/DB_NAME (ver public/config/env.php).
  CIFRO_FILE_ENV_KEYS: '',
};

/**
 * Trava de seguranca: resolve as variaveis exatamente como o servidor vai
 * resolve-las e aborta se apontarem para qualquer coisa que nao seja o banco
 * de demonstracao local.
 */
function assertDemoDatabase() {
  const script = "require getenv('CIFRO_ENV_BOOT'); echo env('DB_HOST','') . ':' . env('DB_NAME','');";
  const probe = spawnSync(PHP, ['-r', script], {
    cwd: ROOT,
    env: { ...serverEnv, CIFRO_ENV_BOOT: path.join(ROOT, 'public', 'config', 'env.php') },
    encoding: 'utf8',
  });
  const resolved = (probe.stdout || '').trim();
  if (resolved !== `${DEMO_HOST}:${DEMO_DB}`) {
    throw new Error(
      `Recusando gravar: o servidor resolveria DB_HOST:DB_NAME = "${resolved}", `
      + `esperado "${DEMO_HOST}:${DEMO_DB}". ${(probe.stderr || '').trim()}`
    );
  }
  console.log(`banco confirmado: ${resolved}`);
}

function startServer() {
  return spawn(PHP, ['-S', `127.0.0.1:${PORT}`, '-t', 'public', 'router.php'], {
    cwd: ROOT,
    env: serverEnv,
    stdio: 'ignore',
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${APP}/login.php`);
      if (response.ok) return;
    } catch { /* servidor ainda subindo */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Servidor de demonstracao nao subiu em 15s.');
}

async function login(browser, { email, password }) {
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
    // A cena offline depende do service worker; o padrao do Playwright ja
    // permite, mas deixamos explicito porque o playwright.config.js do projeto
    // bloqueia na maioria dos projetos.
    serviceWorkers: 'allow',
  });
  const page = await context.newPage();
  await page.goto(`${APP}/login.php`);
  await page.fill('#email', email);
  await page.fill('#senha', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  if (/login\.php/.test(page.url())) {
    throw new Error(`Login falhou para ${email} — ainda em ${page.url()}`);
  }
  return page;
}

/** Abre a musica e espera a cifra estar renderizada. */
async function openSong(page, song) {
  await page.goto(songUrl(song));
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => (document.getElementById('song-cifra')?.innerText || '').length > 20);
  await page.waitForTimeout(600);
}

async function shoot(page) {
  return (await page.screenshot({ type: 'png' })).toString('base64');
}

/** Troca a imagem de um celular do palco e espera o navegador decodifica-la. */
async function paint(stagePage, side, base64) {
  await stagePage.evaluate(async ([selector, data]) => {
    const img = document.querySelector(selector);
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
  }, [`#phone-${side} .screen`, base64]);
}

async function main() {
  assertDemoDatabase();

  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  const server = startServer();
  let browser = null;
  try {
    await waitForServer();
    browser = await chromium.launch();

    const hostPage = await login(browser, CREDS.host);
    const memberPage = await login(browser, CREDS.member);

    const stageContext = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
    const stagePage = await stageContext.newPage();
    await stagePage.goto(pathToFileURL(path.join(DIR, 'stage', 'stage.html')).href);
    await stagePage.waitForFunction(() => !!window.STAGE);
    await stagePage.evaluate(async () => {
      await Promise.all([600, 700, 800].map(weight => document.fonts.load(`${weight} 64px Inter`)));
      await document.fonts.ready;
    });

    const { TOTAL_FRAMES, KEYFRAMES } = await stagePage.evaluate(() => ({
      TOTAL_FRAMES: window.STAGE.TOTAL_FRAMES,
      KEYFRAMES: window.STAGE.KEYFRAMES,
    }));

    // Estado inicial: os dois na primeira musica da playlist Culto de Domingo.
    // O host precisa estar em music.php para poder publicar estado (live.js:147-165).
    await openSong(hostPage, SETLIST[0]);
    await openSong(memberPage, SETLIST[0]);

    // O host assume o comando e o membro entra na sessao. Os botoes reais
    // (#livePlay e #entrarlivePlay) vivem dentro da gaveta de ajustes; chamamos
    // as mesmas funcoes que os handlers de clique chamam (live.js:495-507) para
    // nao abrir a gaveta na frente da camera.
    await hostPage.evaluate(() => window.LiveMode.assumirHost());
    await hostPage.waitForFunction(() => sessionStorage.getItem('cifroLiveMode_' + window.CIFRO_BAND_ID) === 'host');
    await memberPage.evaluate(() => window.LiveMode.entrarOuSairLive());
    await memberPage.waitForFunction(() => document.getElementById('liveModeIndicator') !== null);
    await memberPage.waitForTimeout(1200);
    console.log(`live pronta: host="${await hostPage.textContent('#liveStatus')}" `
      + `membro="${await memberPage.textContent('#liveStatus')}"`);

    await paint(stagePage, 'left', await shoot(hostPage));
    await paint(stagePage, 'right', await shoot(memberPage));

    let scrollRange = 0; // preenchido no quadro KEYFRAMES.scroll

    for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
      // --- acoes reais no app, disparadas no quadro exato ---

      // Biblioteca: todas as musicas da banda numa lista so (index.php).
      if (frame === KEYFRAMES.lista) {
        await hostPage.goto(`${APP}/index.php`);
        await hostPage.waitForLoadState('networkidle');
        await hostPage.waitForFunction(
          () => document.querySelectorAll('#music-list li').length >= 6,
          { timeout: 15000 },
        );
        await hostPage.waitForTimeout(600);
        await paint(stagePage, 'left', await shoot(hostPage));
      }

      // Repertorios: o menu lateral de index.php lista playlists e roteiros.
      // Abrimos do mesmo jeito que o handler do app abre (index.php:270).
      if (frame === KEYFRAMES.playlist) {
        await hostPage.evaluate(() => { document.getElementById('sideMenu').style.right = '0px'; });
        await hostPage.waitForFunction(
          () => document.querySelectorAll('#lista-playlists li').length >= 1,
          { timeout: 15000 },
        );
        await hostPage.waitForTimeout(600);
        await paint(stagePage, 'left', await shoot(hostPage));
      }

      // Volta para a cifra antes da cena do Modo Live: o host so publica estado
      // em music.php (live.js:147-165), e ele estava em index.php.
      if (frame === KEYFRAMES.liveBack) {
        await hostPage.evaluate(() => { document.getElementById('sideMenu').style.right = '-100%'; });
        await openSong(hostPage, SETLIST[0]);
        await hostPage.waitForTimeout(1500);
        await paint(stagePage, 'left', await shoot(hostPage));
        await paint(stagePage, 'right', await shoot(memberPage));
      }

      // O host navega para a proxima musica da playlist. A tela do membro troca
      // sozinha porque live.js:453 leva o navegador dele para paginaAtual.
      if (frame === KEYFRAMES.liveFlip) {
        await openSong(hostPage, SETLIST[2]);
      }

      // Transposicao pelo botao real da barra de controles (music.php:86).
      if (frame === KEYFRAMES.transpose) {
        await hostPage.click('.music-bottom-bar [data-music-action="increase-tom"]');
        await hostPage.waitForTimeout(400);
      }

      // Rolagem da cifra. As musicas de demonstracao cabem inteiras na tela
      // (o layout automatico ajusta a fonte), entao normalmente nao ha o que
      // rolar; medimos antes de tentar em vez de fingir movimento.
      if (frame === KEYFRAMES.scroll) {
        scrollRange = await hostPage.evaluate(() => {
          const el = document.getElementById('song-cifra') || document.scrollingElement;
          return Math.max(0, el.scrollHeight - el.clientHeight);
        });
        console.log(`rolagem disponivel na cifra: ${scrollRange}px`);
      }
      if (scrollRange > 8 && frame >= KEYFRAMES.scroll && frame < KEYFRAMES.roteiro) {
        const progress = Math.min(1, (frame - KEYFRAMES.scroll) / 45);
        await hostPage.evaluate(top => {
          const el = document.getElementById('song-cifra') || document.scrollingElement;
          el.scrollTop = top;
        }, Math.round(scrollRange * progress));
      }

      // --- cenas de reforco: cada uma numa tela diferente do Cifro ---

      // Roteiro do culto (texto livre da tabela `roteiros`, renderizado por
      // roteiro.php). `editorplaylist.php` do rascunho nao existe no app.
      if (frame === KEYFRAMES.roteiro) {
        await hostPage.goto(`${APP}/roteiro.php?id=${ROTEIRO_ID}`);
        await hostPage.waitForLoadState('networkidle');
        await hostPage.waitForFunction(() => (document.getElementById('roteiro-body')?.innerText || '').length > 40);
        await hostPage.waitForTimeout(500);
        await paint(stagePage, 'left', await shoot(hostPage));
      }

      // Painel de ensaio (loop A/B e pitch). Nao existe `ensaio.php`: o painel
      // e um modal dentro de music.php, aberto por #btnAtivarEnsaio.
      if (frame === KEYFRAMES.rehearsal) {
        await openSong(hostPage, SETLIST[3]);
        await hostPage.click('[data-music-action="menuButton"]');
        await hostPage.waitForTimeout(400);
        await hostPage.click('#settingsTabTools');
        await hostPage.waitForTimeout(250);
        await hostPage.evaluate(() => {
          document.querySelectorAll('#settingsPanelTools details').forEach(node => { node.open = true; });
        });
        await hostPage.click('#btnAtivarEnsaio');
        await hostPage.waitForFunction(() => document.getElementById('modo-ensaio')?.classList.contains('is-active'));
        await hostPage.waitForTimeout(2500);

        // Carrega um audio AUTORAL (gerado por ffmpeg em assets/) para que os
        // controles de loop A/B e pitch fiquem realmente habilitados. Sem audio
        // eles aparecem acinzentados, e a legenda "ensaia o trecho dificil em
        // loop" estaria afirmando algo que a tela nao mostra.
        await hostPage.setInputFiles('#inputAudio', path.join(DIR, 'assets', 'ensaio-demo.wav'));
        await hostPage.waitForFunction(
          () => /loaded/i.test(document.getElementById('rehearsalMessage')?.textContent || ''),
          { timeout: 20000 },
        );
        // Marca um trecho e liga o loop: o botao acende verde, que e o estado real.
        await hostPage.click('#btnPlayPause');
        await hostPage.waitForTimeout(1000);
        await hostPage.click('#btnSetA');
        await hostPage.waitForTimeout(2200);
        await hostPage.click('#btnSetB');
        await hostPage.click('#btnLoop');
        await hostPage.waitForTimeout(300);
        await hostPage.click('#btnPlayPause');

        // Enquadra transporte, A/B e pitch. O contêiner #waveform fica de fora
        // de proposito: o WaveSurfer nao pinta canvas nenhum em Chromium
        // headless (o elemento fica com um <div> vazio), e uma caixa preta vazia
        // no quadro pareceria um bug do produto.
        await hostPage.evaluate(() => {
          const panel = document.getElementById('modo-ensaio');
          panel.scrollTop = panel.scrollHeight;
        });
        await hostPage.waitForTimeout(400);
        const loopAtivo = await hostPage.evaluate(() => {
          const b = document.getElementById('btnLoop');
          return !b.disabled && (b.classList.length > 0 || getComputedStyle(b).borderColor !== 'rgba(0, 0, 0, 0)');
        });
        if (!loopAtivo) throw new Error('Cena de ensaio: o botao de loop nao ficou habilitado.');
        await paint(stagePage, 'left', await shoot(hostPage));
      }

      // Offline de verdade: corta a rede e recarrega. O service worker serve a
      // pagina do cache (service-worker.js:305-333) e a cifra continua legivel.
      if (frame === KEYFRAMES.offline) {
        await openSong(hostPage, SETLIST[0]);
        await hostPage.waitForFunction(() => !!navigator.serviceWorker.controller);
        await hostPage.waitForTimeout(1500);
        await hostPage.context().setOffline(true);
        await hostPage.reload({ waitUntil: 'domcontentloaded' });
        await hostPage.waitForFunction(() => (document.getElementById('song-cifra')?.innerText || '').length > 20);
        await hostPage.waitForTimeout(800);
        const offlineTitle = await hostPage.title();
        if (!/Amanhecer/.test(offlineTitle)) {
          throw new Error(`Cena offline nao se sustenta: a pagina recarregada e "${offlineTitle}".`);
        }
        console.log(`offline ok: "${offlineTitle}" servida pelo service worker`);
        await paint(stagePage, 'left', await shoot(hostPage));
      }

      if (inLiveWindow(frame)) {
        await paint(stagePage, 'left', await shoot(hostPage));
        await paint(stagePage, 'right', await shoot(memberPage));
      }

      await stagePage.evaluate(n => window.STAGE.render(n), frame);
      await stagePage.screenshot({
        path: path.join(OUT, `frame-${String(frame).padStart(6, '0')}.png`),
      });

      if (frame % 60 === 0) process.stdout.write(`quadro ${frame}/${TOTAL_FRAMES}\n`);
    }

    console.log(`Pronto: ${TOTAL_FRAMES} quadros em ${OUT}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
