function openSideMenu() {
    const sideMenu = document.getElementById('sideMenu');
    const menuSide = document.getElementById('menusideMenu');
    if (sideMenu) sideMenu.style.right = '0';
    if (menuSide) menuSide.style.right = '-300px';
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
            if (sideMenu) sideMenu.style.right = '-300px';
        });
    }

    var menuButtonTop = document.getElementById('menuButtonTop');
    if (menuButtonTop) {
        menuButtonTop.addEventListener('click', function () {
            var menuSide = document.getElementById('menusideMenu');
            var sideMenu = document.getElementById('sideMenu');
            if (menuSide) menuSide.style.right = '0';
            if (sideMenu) sideMenu.style.right = '-300px';
        });
    }

    var menuCloseButton = document.getElementById('menucloseButton');
    if (menuCloseButton) {
        menuCloseButton.addEventListener('click', function () {
            var menuSide = document.getElementById('menusideMenu');
            if (menuSide) menuSide.style.right = '-300px';
        });
    }

    var closeButton = document.getElementById('closeButton');
    if (closeButton) {
        closeButton.addEventListener('click', function () {
            var sideMenu = document.getElementById('sideMenu');
            if (sideMenu) sideMenu.style.right = '-300px';
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
        sideMenu.style.right = '-300px';
    }

    if (menuOpen && !event.target.closest('#menusideMenu') && !event.target.closest('#menuButton') && !event.target.closest('#menuButtonTop')) {
        menuSide.style.right = '-300px';
    }
});

function fdmSwMessage(msg) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
    }
}

function transporCifraHtmlLegado(html, semitons) {
    const notas = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const notasMap = {};
    // Mapear todas as variações possíveis (incluindo equivalentes como Db = C#)
    notas.forEach((n, i) => {
        notasMap[n] = i;
        // Também adiciona bemóis equivalentes (opcional, se quiser aceitar entrada com "b")
        if (n.includes('#')) {
            const base = notas[i + 1];
            if (base) notasMap[base.replace('#', 'b')] = i;
        }
    });

    // Regex que pega acordes dentro da tag <b>: como A, A7M, F#m, G#9 etc.
    return html.replace(/<b>(.*?)<\/b>/g, (match, acordeOriginal) => {
        const regex = /^([A-Ga-g])(#|b)?(.*)$/;
        const partes = acordeOriginal.match(regex);
        if (!partes) return match;

        let [, nota, alteracao, sufixo] = partes;
        nota = nota.toUpperCase();
        alteracao = alteracao || '';
        const notaCompleta = nota + alteracao;

        let idx = notasMap[notaCompleta];
        if (idx === undefined) return match; // Nota não reconhecida

        let novoIdx = (idx + semitons + 12) % 12;
        const novaNota = notas[novoIdx];

        return `<b>${novaNota}${sufixo}</b>`;
    });

 

}

function identificarTomLegado(html) {
    const notasMaiores = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];
    const relativosMenores = {
        'C': 'Am', 'G': 'Em', 'D': 'Bm', 'A': 'F#m', 'E': 'C#m', 'B': 'G#m', 'F#': 'D#m', 'C#': 'A#m',
        'F': 'Dm', 'Bb': 'Gm', 'Eb': 'Cm', 'Ab': 'Fm', 'Db': 'Bbm', 'Gb': 'Ebm'
    };

    const contagem = {};

    // Extrai os acordes dentro das tags <b>
    const acordes = Array.from(html.matchAll(/<b>(.*?)<\/b>/g)).map(m => m[1]);

    // Normaliza e conta as tônicas
    acordes.forEach(acorde => {
        const match = acorde.match(/^([A-Ga-g])(#|b)?/);
        if (match) {
            const tônica = (match[1].toUpperCase() + (match[2] || ''));
            contagem[tônica] = (contagem[tônica] || 0) + 1;
        }
    });

    // Se nada foi encontrado
    if (Object.keys(contagem).length === 0) {
        return 'Tom não identificado';
    }

    // Ordena as notas mais usadas
    const maisUsada = Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0];

    // Busca o tom mais provável baseado na tônica mais frequente
    let tomMaior = notasMaiores.includes(maisUsada) ? maisUsada : null;
    if (!tomMaior) {
        // tenta encontrar a nota sem sustenido ou bemol, exemplo: A# → Bb
        const equivalentes = {
            'A#': 'Bb', 'D#': 'Eb', 'G#': 'Ab',
            'C#': 'Db', 'F#': 'Gb'
        };
        tomMaior = equivalentes[maisUsada];
    }

    if (tomMaior && relativosMenores[tomMaior]) {
        // return `${tomMaior} ou ${relativosMenores[tomMaior]}`;
         return `${tomMaior}`;
    } else {
        return `${maisUsada}`;
    }
}

const __notasTransposicao = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const __notasMapTransposicao = {
    C: 0, 'C#': 1, Db: 1,
    D: 2, 'D#': 3, Eb: 3,
    E: 4, Fb: 4, 'E#': 5,
    F: 5, 'F#': 6, Gb: 6,
    G: 7, 'G#': 8, Ab: 8,
    A: 9, 'A#': 10, Bb: 10,
    B: 11, Cb: 11
};

function normalizarNotaTransposicao(nota, alteracao) {
    return String(nota || '').toUpperCase() + (alteracao || '');
}

function transporNotaTransposicao(nota, alteracao, semitons) {
    const idx = __notasMapTransposicao[normalizarNotaTransposicao(nota, alteracao)];
    if (idx === undefined) return nota + (alteracao || '');
    return __notasTransposicao[(idx + semitons + 120) % 12];
}

function transporTextoAcordes(texto, semitons) {
    const textoNormalizado = String(texto || '').replace(/&nbsp;|\u00a0/g, ' ');
    const acordeRegex = /(^|[^A-Za-z0-9#b/])([A-Ga-g])(#|b)?((?:(?:m(?![a-z])|maj|min|dim|aug|sus|add|M)?[0-9]*(?:M)?(?:\([^)]+\))?(?:[+º°])?))(\/([A-Ga-g])(#|b)?)?(?=$|[^A-Za-z0-9#b/])/g;

    return textoNormalizado.replace(acordeRegex, function(match, prefixo, nota, alteracao, sufixo, baixoInteiro, baixoNota, baixoAlteracao) {
        const novaNota = transporNotaTransposicao(nota, alteracao, semitons);
        const novoBaixo = baixoInteiro ? '/' + transporNotaTransposicao(baixoNota, baixoAlteracao, semitons) : '';
        return prefixo + novaNota + (sufixo || '') + novoBaixo;
    });
}

function extrairTonicasCifra(html) {
    const tonicas = [];
    const cifra = String(html || '');
    const acordes = Array.from(cifra.matchAll(/<b\b[^>]*>([\s\S]*?)<\/b>/gi)).map(m => m[1]);
    const acordeRegex = /(^|[^A-Za-z0-9#b/])([A-Ga-g])(#|b)?(?:(?:m(?![a-z])|maj|min|dim|aug|sus|add|M)?[0-9]*(?:M)?(?:\([^)]+\))?(?:[+º°])?)(?:\/[A-Ga-g](?:#|b)?)?(?=$|[^A-Za-z0-9#b/])/g;

    if (acordes.length === 0 && /^[A-Ga-gmM0-9#b\s\u00a0&;(),./+º°\[\]-]+$/.test(cifra) && /[A-Ga-g]/.test(cifra)) {
        acordes.push(cifra);
    }

    acordes.forEach(acorde => {
        const texto = String(acorde || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;|\u00a0/g, ' ');

        let match;
        while ((match = acordeRegex.exec(texto)) !== null) {
            const nota = normalizarNotaTransposicao(match[2], match[3]);
            if (__notasMapTransposicao[nota] !== undefined) {
                tonicas.push(__notasTransposicao[__notasMapTransposicao[nota]]);
            }
        }
    });

    return tonicas;
}

function transporCifraHtml(html, semitons) {
    const cifra = String(html || '');
    if (!/<b\b/i.test(cifra) && /^[A-Ga-gmM0-9#b\s\u00a0&;(),./+º°\[\]-]+$/.test(cifra) && /[A-Ga-g]/.test(cifra)) {
        return transporTextoAcordes(cifra, semitons);
    }

    return cifra.replace(/<b\b([^>]*)>([\s\S]*?)<\/b>/gi, function(match, atributos, conteudo) {
        return '<b' + atributos + '>' + transporTextoAcordes(conteudo, semitons) + '</b>';
    });
}

function identificarTom(html) {
    const contagem = {};
    extrairTonicasCifra(html).forEach(tom => {
        contagem[tom] = (contagem[tom] || 0) + 1;
    });

    if (Object.keys(contagem).length === 0) {
        return 'Tom nÃ£o identificado';
    }

    return Object.entries(contagem).sort((a, b) => b[1] - a[1])[0][0];
}

function mostrarToast(mensagem, corFundo) {
    corFundo = corFundo || 'white';
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = mensagem;
    toast.style.background = corFundo;
    toast.style.display = 'block';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function () { toast.style.display = 'none'; }, 3000);
}

function checarStatusConexao() {
    if (navigator.onLine) {
        mostrarToast('Você está online ✅', '#2ecc71');
    } else {
        mostrarToast('Sem conexão com a internet ⚠️', '#e74c3c');
    }
}

window.addEventListener('online', function () {
    checarStatusConexao();
    fdmSwMessage({ type: 'ONLINE' });
});
window.addEventListener('offline', checarStatusConexao);


if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').then(reg => {
        reg.update();
        // After SW is ready and controlling the page, send daily check
        navigator.serviceWorker.ready.then(() => {
            fdmSwMessage({ type: 'DAILY_CHECK' });
        });
    });
}

