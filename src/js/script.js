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

function transporCifraHtml(html, semitons) {
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

function identificarTom(html) {
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

