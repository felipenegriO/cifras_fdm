const playlistButton = document.getElementById('playlistButton');
if (playlistButton) {
    playlistButton.addEventListener('click', function() {
        const sideMenu = document.getElementById('sideMenu');
        const menuSide = document.getElementById('menusideMenu');
        if (sideMenu) sideMenu.style.right = '0';
        if (menuSide) menuSide.style.right = '-300px';
        if (typeof window.renderPlaylistsMenu === 'function') {
            window.renderPlaylistsMenu();
        }
    });
}

const menuButton = document.getElementById('menuButton');
if (menuButton) {
    menuButton.addEventListener('click', function() {
        const menuSide = document.getElementById('menusideMenu');
        const sideMenu = document.getElementById('sideMenu');
        if (menuSide) menuSide.style.right = '0';
        if (sideMenu) sideMenu.style.right = '-300px';
    });
}

const menuCloseButton = document.getElementById('menucloseButton');
if (menuCloseButton) {
    menuCloseButton.addEventListener('click', function() {
        const menuSide = document.getElementById('menusideMenu');
        if (menuSide) menuSide.style.right = '-300px';
    });
}

const closeButton = document.getElementById('closeButton');
if (closeButton) {
    closeButton.addEventListener('click', function() {
        const sideMenu = document.getElementById('sideMenu');
        if (sideMenu) sideMenu.style.right = '-300px';
    });
}

document.addEventListener('click', function(event) {
    var sideMenu = document.getElementById('sideMenu');
    var menuSide = document.getElementById('menusideMenu');
    if (!sideMenu || !menuSide) return;

    var sideOpen = sideMenu.style.right === '0px';
    var menuOpen = menuSide.style.right === '0px';

    if (sideOpen && !event.target.closest('#sideMenu') && !event.target.closest('#playlistButton')) {
        sideMenu.style.right = '-300px';
    }

    if (menuOpen && !event.target.closest('#menusideMenu') && !event.target.closest('#menuButton')) {
        menuSide.style.right = '-300px';
    }
});

async function checkAndCleanCache() {
    // Verifica se o dispositivo está online
    if (!navigator.onLine) {
        console.log('Sem conexão com a internet.');
        return;
    }

    console.log('Conectado à internet.');

    // Verifica a qualidade do sinal (simplificadamente, estamos assumindo que se está online, o sinal é bom)
    // Aqui você pode adicionar sua própria lógica para verificar a qualidade do sinal se desejar.

    // Verifica e limpa o cache se ele existir e for mais antigo que um dia
    const cacheName = 'your-cache-name'; // Substitua pelo nome do seu cache

    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        const oneDay = 24 * 60 * 60 * 1000; // 1 dia em milissegundos
        const now = Date.now();

        let cacheCleaned = false;
        for (const request of keys) {
            const response = await cache.match(request);
            const headers = response.headers;
            const date = headers.get('date');

            if (date) {
                const cacheDate = new Date(date).getTime();
                if (now - cacheDate > oneDay) {
                    console.log('Cache antigo encontrado, limpando...');
                    await cache.delete(request);
                    cacheCleaned = true;
                }
            }
        }

        if (!cacheCleaned) {
            console.log('O cache está atualizado.');
        }
    } catch (error) {
        console.error('Erro ao acessar ou limpar o cache:', error);
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

const toast = document.getElementById('toast');

    function mostrarToast(mensagem, corFundo = 'white') {
        if (!toast) return;
        toast.textContent = mensagem;
        toast.style.background = corFundo;
        toast.style.display = 'block';

        // Oculta o toast depois de 3 segundos
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

  function checarStatusConexao() {
    if (navigator.onLine) {
      mostrarToast('Você está online ✅', '#2ecc71'); // verde
    } else {
      mostrarToast('Sem conexão com a internet ⚠️', '#e74c3c'); // vermelho
    }
  }

    // Verifica inicialmente
    if (toast) {
        checarStatusConexao();
    }

  // Eventos de mudança
    window.addEventListener('online', checarStatusConexao);
    window.addEventListener('offline', checarStatusConexao);
  
  
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.update(); // força o SW a buscar uma nova versão
    }
  });
}

