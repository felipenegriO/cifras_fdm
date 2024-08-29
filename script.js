document.getElementById('menuButton').addEventListener('click', function() {
    document.getElementById('sideMenu').style.right = '0';
});

document.getElementById('closeButton').addEventListener('click', function() {
    document.getElementById('sideMenu').style.right = '-300px';
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

