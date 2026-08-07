/**
 * cifro-install.js — PWA install prompt for Android and iOS.
 *
 * Android/Chrome: captures beforeinstallprompt, shows a dismissible banner.
 * iOS/Safari: detects non-standalone mode, shows "Add to Home Screen" instructions.
 *
 * Usage: include this script on index.php. It self-initialises on DOMContentLoaded.
 * The user can dismiss the banner; dismissal is remembered in localStorage for 30 days.
 */
(function () {
  const DISMISS_KEY  = 'cifroInstallDismissed';
  const DISMISS_DAYS = 30;

  function wasDismissed() {
    const ts = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    return ts > 0 && Date.now() - ts < DISMISS_DAYS * 86400 * 1000;
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    const el = document.getElementById('cifro-install-banner');
    if (el) el.remove();
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  function isSafari() {
    return /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
  }

  function buildBanner(content) {
    const div = document.createElement('div');
    div.id = 'cifro-install-banner';
    div.innerHTML = `
      <div class="cib-inner">
        <span class="cib-icon">📲</span>
        <span class="cib-msg">${content}</span>
        <button class="cib-close" aria-label="Fechar" onclick="(function(){localStorage.setItem('${DISMISS_KEY}',Date.now());document.getElementById('cifro-install-banner').remove()})()">✕</button>
      </div>`;
    div.style.cssText = `
      position:fixed;bottom:0;left:0;right:0;z-index:9999;
      background:var(--bg-elevated,#1e1e2e);border-top:1px solid var(--border-1,#333);
      padding:10px 16px;font-size:14px;
      box-shadow:0 -2px 12px rgba(0,0,0,.35);
    `;
    div.querySelector('.cib-inner').style.cssText = `
      display:flex;align-items:center;gap:10px;max-width:680px;margin:0 auto;
    `;
    div.querySelector('.cib-icon').style.cssText = `flex:0 0 auto;font-size:20px;`;
    div.querySelector('.cib-msg').style.cssText  = `flex:1;color:var(--text-1,#fff);line-height:1.35;`;
    div.querySelector('.cib-close').style.cssText = `
      flex:0 0 auto;background:none;border:none;color:var(--text-3,#888);
      font-size:18px;cursor:pointer;padding:4px 6px;border-radius:4px;
    `;
    return div;
  }

  // ── Android / Chrome: beforeinstallprompt ────────────────────────────────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;

    if (isStandalone() || wasDismissed()) return;

    const banner = buildBanner(
      'Instale o Cifrô para acesso rápido, offline e tela cheia. ' +
      '<button id="cib-install-btn" style="background:var(--brand,#7c3aed);color:#fff;border:none;padding:5px 14px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;margin-left:4px;">Instalar</button>'
    );
    document.body.appendChild(banner);

    document.getElementById('cib-install-btn')?.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (result) {
        deferredPrompt = null;
        dismiss();
      });
    });
  });

  // ── iOS / Safari: manual instructions ────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    if (!isIOS() || !isSafari() || isStandalone() || wasDismissed()) return;

    const shareIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin:0 2px"><path stroke-linecap="round" stroke-linejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>`;
    const banner = buildBanner(
      `Para instalar o Cifrô no iOS: toque em ${shareIcon} <strong>Compartilhar</strong> e depois em <strong>"Adicionar à Tela de Início"</strong>.`
    );
    document.body.appendChild(banner);
  });
})();
