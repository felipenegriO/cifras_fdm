/**
 * Capotraste pessoal por música: escrita, fila offline e detecção de conflito.
 *
 * O conflito segue o modelo do Git: a linha guarda a foto do cadastro no
 * instante da escolha (base_*), então dá para distinguir "o cadastro não
 * mudou" de "mudou e eu tinha personalizado" — só o segundo é conflito.
 *
 * A fila mora em localStorage, não em IndexedDB: são poucos bytes por música,
 * o acesso é síncrono e isso simplifica o disparo no evento 'online'.
 */
(function () {
    const FILA_KEY = 'cifroCapoPendente:';
    const ENDPOINT = '/src/backend/users/preferencia-musica.php';

    function chaveDaFila() {
        return FILA_KEY + String(window.CIFRO_USER_ID || 'anonymous') + ':' + String(window.CIFRO_BAND_ID || '');
    }

    function lerFila() {
        try {
            const bruto = JSON.parse(localStorage.getItem(chaveDaFila()) || '{}');
            return bruto && typeof bruto === 'object' ? bruto : {};
        } catch (_) {
            return {};
        }
    }

    function gravarFila(fila) {
        try {
            if (Object.keys(fila).length) localStorage.setItem(chaveDaFila(), JSON.stringify(fila));
            else localStorage.removeItem(chaveDaFila());
        } catch (_) {}
    }

    // Uma entrada por música: a última escolha vence, então não faz sentido
    // acumular histórico de cliques no stepper.
    function enfileirar(musicaId, corpo) {
        const fila = lerFila();
        fila[String(musicaId)] = corpo;
        gravarFila(fila);
    }

    function desenfileirar(musicaId) {
        const fila = lerFila();
        delete fila[String(musicaId)];
        gravarFila(fila);
    }

    async function enviar(corpo) {
        const resposta = await fetch((window.APP_BASE || '') + ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(corpo)
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || 'falha ao salvar');
        return dados;
    }

    async function despachar(musicaId, corpo) {
        aplicarLocalmente(musicaId, corpo);
        try {
            await enviar(corpo);
            desenfileirar(musicaId);
            return true;
        } catch (_) {
            // Offline ou servidor fora: guarda para subir quando voltar.
            enfileirar(musicaId, corpo);
            return false;
        }
    }

    // Reflete a escolha na memória antes da rede responder, para a tela não
    // ficar esperando o servidor no meio de um ensaio.
    function aplicarLocalmente(musicaId, corpo) {
        const lista = Array.isArray(window.preferenciasMusica) ? window.preferenciasMusica : [];
        const outras = lista.filter(item => Number(item.musica_id) !== Number(musicaId));
        if (corpo.acao === 'remover') {
            window.preferenciasMusica = outras;
            guardarNoCache();
            return;
        }
        const atual = lista.find(item => Number(item.musica_id) === Number(musicaId)) || {};
        const musica = (window.songs || []).find(item => Number(item.id) === Number(musicaId));
        const baseCadastro = Number(musica?.transposicao_instrumento) || 0;
        window.preferenciasMusica = [...outras, {
            musica_id: Number(musicaId),
            transposicao_instrumento: corpo.acao === 'manter'
                ? (atual.transposicao_instrumento ?? 0)
                : Number(corpo.transposicao_instrumento) || 0,
            base_transposicao: baseCadastro,
            base_tom: corpo.base_tom ?? null
        }];
        guardarNoCache();
    }

    // A escolha não sobe a revisão da banda, então o cache não seria
    // revalidado sozinho: sem gravar aqui, o próximo carregamento leria o
    // estado antigo e o capotraste sumiria da tela.
    function guardarNoCache() {
        try {
            window.cifroSync?.savePreferencias?.(window.CIFRO_BAND_ID, window.preferenciasMusica);
        } catch (_) {}
    }

    async function enviarPendentes() {
        const fila = lerFila();
        for (const [musicaId, corpo] of Object.entries(fila)) {
            try {
                await enviar(corpo);
                desenfileirar(musicaId);
            } catch (_) {
                return false; // Ainda sem servidor: tenta de novo no próximo gatilho.
            }
        }
        return true;
    }

    function temPendenteParaEnviar() {
        return Object.keys(lerFila()).length > 0;
    }

    function salvar(musicaId, valor, tomSoante) {
        return despachar(musicaId, {
            musica_id: Number(musicaId),
            transposicao_instrumento: Number(valor) || 0,
            base_tom: tomSoante || null
        });
    }

    /** acao: 'cadastro' apaga a escolha; 'meu' mantém e adota a base nova. */
    function resolver(musicaId, acao, tomSoante) {
        return despachar(musicaId, {
            musica_id: Number(musicaId),
            acao: acao === 'cadastro' ? 'remover' : 'manter',
            base_tom: tomSoante || null
        });
    }

    function tomSoanteDaMusica(musica) {
        if (!musica || !window.CifroChords) return '';
        return window.CifroChords.identifyKey(musica.cifra || '')?.key || '';
    }

    /**
     * Comparação de três pontas: base (o cadastro quando escolhi), o cadastro
     * de agora e a minha escolha. Só é conflito quando os dois lados andaram —
     * se apenas o cadastro mudou e eu não tinha divergido, é fast-forward.
     */
    function emConflito(preferencia, musica, tomSoante) {
        if (!preferencia || !musica) return false;
        const baseValor = Number(preferencia.base_transposicao ?? 0);
        const cadastroValor = Number(musica.transposicao_instrumento ?? 0);
        const meuValor = Number(preferencia.transposicao_instrumento ?? 0);

        const tomAtual = tomSoante === undefined ? tomSoanteDaMusica(musica) : tomSoante;
        const tomMudou = Boolean(preferencia.base_tom) && Boolean(tomAtual) && preferencia.base_tom !== tomAtual;

        const cadastroMudou = cadastroValor !== baseValor || tomMudou;
        const euDivergi = meuValor !== baseValor;
        return cadastroMudou && euDivergi;
    }

    /**
     * Só percorre as músicas que têm personalização: identificar o tom lê a
     * cifra inteira, e fazer isso para o repertório todo custaria caro no
     * celular.
     */
    function pendencias() {
        const musicas = window.songs || [];
        return (Array.isArray(window.preferenciasMusica) ? window.preferenciasMusica : [])
            .map(preferencia => {
                const musica = musicas.find(item => Number(item.id) === Number(preferencia.musica_id));
                if (!musica) return null;
                const tomSoante = tomSoanteDaMusica(musica);
                return emConflito(preferencia, musica, tomSoante)
                    ? { preferencia, musica, tomSoante }
                    : null;
            })
            .filter(Boolean);
    }

    /**
     * A escolha pessoal só vale quando não há conflito: pendente, ela fica
     * suspensa e o app volta à preferência do usuário.
     *
     * `musica` é passada por quem chama porque a tela já a tem em mãos.
     * Procurá-la de novo em window.songs criava dependência de ordem: se o
     * snapshot ainda não tivesse chegado, a busca falhava e a escolha pessoal
     * passava sem a checagem de conflito.
     */
    function escolhaValida(musicaId, musica) {
        const preferencia = (Array.isArray(window.preferenciasMusica) ? window.preferenciasMusica : [])
            .find(item => Number(item.musica_id) === Number(musicaId));
        if (!preferencia || preferencia.transposicao_instrumento === null) return null;

        const alvo = musica || (window.songs || []).find(item => Number(item.id) === Number(musicaId));
        // Sem a música não dá para afirmar que não há conflito, e o certo é
        // não aplicar a escolha por cima de um cadastro que talvez tenha mudado.
        if (!alvo || emConflito(preferencia, alvo)) return null;
        return Number(preferencia.transposicao_instrumento);
    }

    window.CifroCapoPessoal = {
        salvar,
        resolver,
        emConflito,
        pendencias,
        escolhaValida,
        enviarPendentes,
        temPendenteParaEnviar
    };

    // Interromper alguém no meio de um culto é o risco natural do aviso
    // imediato. Se há apresentação ou live rolando, o aviso espera.
    function estaNoPalco() {
        return document.body.classList.contains('cifro-presenting')
            || Boolean(window.LiveMode?.getMode?.());
    }

    let pendenciasAvisadas = 0;

    function avisarPendencias() {
        const total = pendencias().length;
        atualizarContadorNoMenu(total);
        if (!total || total === pendenciasAvisadas || estaNoPalco()) return;
        pendenciasAvisadas = total;
        if (!window.cifroToast) return;
        cifroToast(
            total === 1
                ? 'Uma música mudou no cadastro e tem ajuste seu de capotraste'
                : total + ' músicas mudaram no cadastro e têm ajuste seu de capotraste',
            'info',
            { duration: 6000 }
        );
    }

    function atualizarContadorNoMenu(total) {
        document.querySelectorAll('[data-capo-pendencias]').forEach(function (elemento) {
            elemento.textContent = String(total);
            elemento.hidden = total === 0;
            const link = elemento.closest('[data-capo-pendencias-link]');
            if (link) link.hidden = total === 0;
        });
    }

    document.addEventListener('cifro:sync', function () { avisarPendencias(); });
    document.addEventListener('cifro:capo-pendencias', function () { avisarPendencias(); });

    window.addEventListener('online', function () { enviarPendentes(); });

    document.addEventListener('cifro:sync', function () {
        const fila = lerFila();
        if (!Object.keys(fila).length) return;
        // O snapshot que acabou de chegar não conhece o que ainda não subiu.
        // Sem reaplicar por cima, a tela voltaria ao valor antigo bem na hora
        // em que a conexão retorna.
        Object.entries(fila).forEach(function (entrada) {
            aplicarLocalmente(entrada[0], entrada[1]);
        });
        enviarPendentes();
    });
})();
