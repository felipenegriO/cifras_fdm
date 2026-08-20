<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Pendências de capotraste</title>
    <?php csrf_meta(); ?>
    <script src="<?= asset_url('/src/js/cifro-csrf.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-theme.js') ?>"></script>
    <link href="<?= asset_url('/src/css/fonts.css') ?>" rel="stylesheet">
    <link href="<?= asset_url('/src/css/theme.css') ?>" rel="stylesheet">
    <link href="<?= asset_url('/src/css/style2.css') ?>" rel="stylesheet">
    <script src="<?= asset_url('/src/js/cifro-toast.js') ?>"></script>
    <style>
        .pendencias { max-width: 720px; margin: 0 auto; padding: var(--space-4); }
        .pendencia {
            background: var(--bg-1);
            border: 1px solid var(--border-1);
            border-radius: var(--radius-md);
            padding: var(--space-4);
            margin-bottom: var(--space-3);
        }
        .pendencia__titulo { margin: 0 0 var(--space-2); font-size: 1.05rem; }
        .pendencia__comparacao { margin: 0 0 var(--space-3); color: var(--text-2); }
        .pendencia__comparacao strong { color: var(--text-1); }
        .pendencia__acoes { display: flex; flex-wrap: wrap; gap: var(--space-2); }
        .pendencias__vazio { color: var(--text-2); }
    </style>
</head>
<body>
    <?php render_partial('topnav'); ?>

    <main class="pendencias">
        <h1>Pendências de capotraste</h1>
        <p class="pendencias__vazio" id="pendenciasIntro">
            Estas músicas mudaram no cadastro da banda e você tinha um capotraste próprio nelas.
            Enquanto você não decidir, vale o que a banda cadastrou.
        </p>

        <div id="pendenciasLista" aria-live="polite"></div>
    </main>

    <script>window.CIFRO_USER_ID = '<?= e($_SESSION['usuario']['id'] ?? '') ?>'; window.CIFRO_BAND_ID = '<?= e(current_band_id()) ?>';</script>
    <script src="<?= asset_url('/src/js/cifro-connectivity.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-sync.js') ?>"></script>
    <script src="<?= asset_url('/src/js/chords.js') ?>"></script>
    <script src="<?= asset_url('/src/js/cifro-capo-pessoal.js') ?>"></script>
    <script>
        (function () {
            const lista = document.getElementById('pendenciasLista');
            const intro = document.getElementById('pendenciasIntro');

            function rotulo() {
                const instrumento = (window.CIFRO_CONFIG && window.CIFRO_CONFIG.instrumento) || 'outro';
                return window.CifroChords.rotuloDeslocamento(instrumento).toLowerCase();
            }

            function render() {
                const pendencias = window.CifroCapoPessoal.pendencias();
                lista.replaceChildren();

                if (!pendencias.length) {
                    intro.textContent = 'Nenhuma pendência. Suas personalizações estão em dia com o cadastro da banda.';
                    return;
                }

                intro.textContent = 'Estas músicas mudaram no cadastro da banda e você tinha um capotraste próprio nelas. '
                    + 'Enquanto você não decidir, vale o que a banda cadastrou.';

                pendencias.forEach(function (item) {
                    const termo = rotulo();
                    const card = document.createElement('article');
                    card.className = 'pendencia';
                    card.dataset.musicaId = item.musica.id;

                    const titulo = document.createElement('h2');
                    titulo.className = 'pendencia__titulo';
                    titulo.textContent = item.musica.nome || 'Sem título';

                    // textContent em tudo: nome de música é conteúdo de usuário.
                    const comparacao = document.createElement('p');
                    comparacao.className = 'pendencia__comparacao';
                    comparacao.textContent =
                        'Cadastro antes: ' + termo + ' ' + (item.preferencia.base_transposicao ?? 0)
                        + ' · Cadastro agora: ' + termo + ' ' + (item.musica.transposicao_instrumento ?? 0)
                        + ' · Você usa: ' + termo + ' ' + (item.preferencia.transposicao_instrumento ?? 0);

                    const acoes = document.createElement('div');
                    acoes.className = 'pendencia__acoes';

                    const usarCadastro = document.createElement('button');
                    usarCadastro.type = 'button';
                    usarCadastro.className = 'btn btn-primary';
                    usarCadastro.dataset.acao = 'cadastro';
                    usarCadastro.textContent = 'Usar o do cadastro';

                    const manterMeu = document.createElement('button');
                    manterMeu.type = 'button';
                    manterMeu.className = 'btn btn-secondary';
                    manterMeu.dataset.acao = 'meu';
                    manterMeu.textContent = 'Manter o meu';

                    const abrir = document.createElement('a');
                    abrir.className = 'btn btn-secondary';
                    abrir.href = 'music.php?id=' + encodeURIComponent(item.musica.id);
                    abrir.textContent = 'Abrir a música';

                    [usarCadastro, manterMeu].forEach(function (botao) {
                        botao.addEventListener('click', async function () {
                            botao.disabled = true;
                            const ok = await window.CifroCapoPessoal.resolver(
                                item.musica.id, botao.dataset.acao, item.tomSoante
                            );
                            if (window.cifroToast) {
                                cifroToast(
                                    ok ? 'Pendência resolvida' : 'Sem conexão — sua decisão sobe quando a internet voltar',
                                    ok ? 'success' : 'error'
                                );
                            }
                            render();
                        });
                    });

                    acoes.append(usarCadastro, manterMeu, abrir);
                    card.append(titulo, comparacao, acoes);
                    lista.appendChild(card);
                });
            }

            document.addEventListener('cifro:sync', render);
            cifroSync.load(window.CIFRO_BAND_ID).then(render).catch(render);
        })();
    </script>
</body>
</html>
