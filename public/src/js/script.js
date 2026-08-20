function openSideMenu() {
    const sideMenu = document.getElementById('sideMenu');
    const menuSide = document.getElementById('menusideMenu');
    if (sideMenu) sideMenu.style.right = '0';
    if (menuSide) menuSide.style.right = '-100%';
    if (typeof window.renderPlaylistsMenu === 'function') window.renderPlaylistsMenu();
}

document.addEventListener('DOMContentLoaded', function () {
    var playlistButton = document.getElementById('playlistButton');
    if (playlistButton) playlistButton.addEventListener('click', openSideMenu);

    var playlistButtonTop = document.getElementById('playlistButtonTop');
    if (playlistButtonTop) playlistButtonTop.addEventListener('click', openSideMenu);

    var menuButton = document.getElementById('menuButton');
    if (menuButton) {
        menuButton.addEventListener('click', function () {
            var menuSide = document.getElementById('menusideMenu');
            var sideMenu = document.getElementById('sideMenu');
            if (menuSide) menuSide.style.right = '0';
            if (sideMenu) sideMenu.style.right = '-100%';
        });
    }

    var menuButtonTop = document.getElementById('menuButtonTop');
    if (menuButtonTop) {
        menuButtonTop.addEventListener('click', function () {
            var menuSide = document.getElementById('menusideMenu');
            var sideMenu = document.getElementById('sideMenu');
            if (menuSide) menuSide.style.right = '0';
            if (sideMenu) sideMenu.style.right = '-100%';
        });
    }

    var menuCloseButton = document.getElementById('menucloseButton');
    if (menuCloseButton) {
        menuCloseButton.addEventListener('click', function () {
            var menuSide = document.getElementById('menusideMenu');
            if (menuSide) menuSide.style.right = '-100%';
        });
    }

    var closeButton = document.getElementById('closeButton');
    if (closeButton) {
        closeButton.addEventListener('click', function () {
            var sideMenu = document.getElementById('sideMenu');
            if (sideMenu) sideMenu.style.right = '-100%';
        });
    }
});

document.addEventListener('click', function(event) {
    var sideMenu = document.getElementById('sideMenu');
    var menuSide = document.getElementById('menusideMenu');
    if (!sideMenu || !menuSide) return;

    var sideOpen = sideMenu.style.right === '0px' || sideMenu.style.right === '0';
    var menuOpen = menuSide.style.right === '0px' || menuSide.style.right === '0';

    if (sideOpen && !event.target.closest('#sideMenu') && !event.target.closest('#playlistButton') && !event.target.closest('#playlistButtonTop')) {
        sideMenu.style.right = '-100%';
    }

    if (menuOpen && !event.target.closest('#menusideMenu') && !event.target.closest('#menuButton') && !event.target.closest('#menuButtonTop')) {
        menuSide.style.right = '-100%';
    }
});

function cifroSwMessage(msg) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
    }
}

function transporCifraHtml(html, semitons) {
    return window.CifroChords.transposeHtml(html, semitons);
}

function identificarTom(html) {
    return window.CifroChords.identifyKey(html)?.key || 'Tom não identificado';
}
