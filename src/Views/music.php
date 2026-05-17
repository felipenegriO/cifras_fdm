<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php csrf_meta(); ?>
    <script src="<?= asset_url('/src/js/fdm-csrf.js') ?>"></script>
    <title>Filhos de Maria</title>
    <link href="/src/css/bootstrap.min.css" rel="stylesheet">
    <link href="/src/css/style2.css" rel="stylesheet">
    <link href="/src/css/rehearsal.css" rel="stylesheet">

    <style>
        * {
            background: black !important;
            color: white;
            line-height: normal;
        }

        body {
            padding: 20px;
            overflow-x: hidden;
        }

        .toggle-btn.active {
            background-color: #28a745 !important;
        }

        #song-cifra {
            /* preservar espaços exatos para alinhamento dos acordes */
            white-space: pre-wrap;

            /* permitir scroll quando necessário */
            overflow-x: auto;
            overflow-y: auto;

            width: 100%;
            max-width: none; /* ✅ Sem limite de largura */
            box-sizing: border-box;
            min-height: 1px;
        }

        /* Garantir que tudo dentro da cifra preserva espaços */
        #song-cifra * {
            white-space: inherit;
        }

        #song-cifra p,
        #song-cifra div,
        #song-cifra pre,
        #song-cifra refrao,
        #song-cifra prerefrao {
            white-space: pre-wrap !important;
        }
    </style>
</head>

<body>
    <div id="toast" style="
      position: fixed;
      bottom: 15%;
      right: 15%;
      transform: translateX(-50%);
      background: white;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 14px;
      display: none;
      z-index: 9999;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>

    <div id="menusideMenu">
        <h2><button id="menucloseButton" style="z-index: 999;">×</button>Menu</h2>

        <div class="row" style="margin-bottom: 15px;">
            <button type="button" class="btn btn-primary col" id="decrease-tom">- tom</button>
            <button type="button" class="btn col" style="color: white;" id="tom"></button>
            <button type="button" class="btn btn-primary col" id="increase-tom">+ tom</button>
        </div>
        <div id="tomInfo" class="live-status" style="margin-bottom: 15px; font-size: 12px;"></div>

        <div class="row" style="margin-bottom: 15px;">
            <button type="button" class="btn btn-primary col mr-2" id="increase-text">A+</button>
            <button type="button" class="btn btn-primary col" id="decrease-text">A-</button>
        </div>

        <div class="row" style="margin-bottom: 15px;">
            <button id="toggle-columns" class="btn btn-primary toggle-btn col">Formatação automática</button>
        </div>

        <div class="row" style="margin-bottom: 15px;">
            <button id="toggle-cifra-letra" class="btn btn-primary toggle-btn col">Somente letra</button>
        </div>

        <div class="row" style="margin-bottom: 15px;">
            <button type="button" class="btn btn-primary col" id="entrarlivePlay">
                <i class="fa-solid fa-play"></i> ENTRAR NO MODO LIVE
            </button>
        </div>

        <div class="row" style="margin-bottom: 15px;">
            <button type="button" class="btn btn-primary col" id="livePlay">
                <i class="fa-solid fa-broadcast-tower"></i> VIRAR HOST
            </button>
        </div>

        <div id="liveStatus" class="live-status" style="margin-bottom: 15px;">Live desconectada</div>

        <div class="row" style="margin-bottom: 15px;">
            <a href="" id="linkYou" target="_blank" class="btn btn-primary" style="width: 100%;">
                <img src="/src/images/youtube.svg" style="width: 100px;">
            </a>
        </div>


        <div class="metronome-controls mt-3">
            <label for="bpmSlider">BPM: <span id="bpmValue">80</span></label><br>
            <input type="range" id="bpmSlider" min="40" max="300" value="60" step="1" style="width: 100%;">

            <div class="row mt-2" role="group">
                <button id="startMetronome" class="btn btn-success col mr-2"
                    style="background-color: #28a745 !important;">
                    <i style="background-color: #28a745 !important;" class="fa-solid fa-play"></i> Iniciar
                </button>
                <button id="stopMetronome" class="btn btn-danger col mr-2"
                    style="background-color: #dc3545 !important;">
                    <i style="background-color: #dc3545 !important;" class="fa-solid fa-stop"></i> Parar
                </button>
                <button id="tapTempo" class="btn btn-primary col" style="background-color: #007bff !important;">
                    Tap Tempo
                </button>
            </div>
        </div>
    </div>

    <div id="sideMenu">
        <button id="closeButton">×</button>
        <h2>PlayLists <button class="btn" data-toggle="modal" data-target="#addPlayList"><i
                    class="fa-solid fa-plus"></i></button></h2>
        <ul id="lista-playlists" stlye="overflow: hidden; height: 100%; border: none;"></ul>
    </div>

    <div class="row">
        <div class="col-2">
            <a href="index.php" class="btn" id="backLink"><i class="fa-solid fa-2x fa-arrow-left"></i></a>
        </div>
        <div class="col-10">
            <h3 id="song-title"></h3>
        </div>

        <div class="btn-group" style="position: fixed; right: 10px; overflow: auto;" role="group"
            aria-label="Basic example">
            <!-- <button type="button" class="btn btn-primary" id="btnAtivarEnsaio" title="Ativar Modo Ensaio"><i class="fa-solid fa-heart"></i> Ensaio</button> -->
            <button type="button" class="btn btn-primary" id="menuButton"><i class="fa-solid fa-list"></i></button>
            <button type="button" class="btn btn-primary" id="playlistButton"><i class="fa-solid fa-music"></i></button>
        </div>
    </div>

    <div class="row">
        <div class="container" style="margin-left: 0px; margin-right: 0; max-width: 100%;">
            <div id="song-cifra" class="cifra auto-columns" style="margin-bottom: 4rem !important;"></div>

            <!-- Modo Ensaio Panel -->
            <div id="modo-ensaio" aria-hidden="true">
                <!-- YouTube Section -->
                <div class="rehearsal-section">
                    <h4 class="rehearsal-section-title">Inserir Música (YouTube)</h4>
                    <div class="rehearsal-button-group">
                        <button id="btnAbrirYoutube" class="rehearsal-button">Pesquisar no YouTube</button>
                    </div>
                    <input type="text" id="inputYoutubeUrl" placeholder="Colar link ou ID do YouTube...">
                    <div class="rehearsal-button-group">
                        <button id="btnVincularYoutube" class="rehearsal-button">Vincular</button>
                    </div>
                    <div id="ytPreview">
                        <img id="ytThumb" alt="YouTube Thumbnail">
                        <div id="ytInfo">
                            <div id="ytTitle"></div>
                        </div>
                    </div>
                </div>

                <!-- Audio Upload Section -->
                <div class="rehearsal-section">
                    <h4 class="rehearsal-section-title">Carregar Áudio</h4>
                    <input type="file" id="inputAudio" accept="audio/*" style="color: var(--rehearsal-text);">
                    <div class="rehearsal-file-info" id="audioFileName"></div>
                </div>

                <!-- Waveform Display -->
                <div id="waveform"></div>

                <!-- Message Area -->
                <div id="rehearsalMessage"></div>

                <!-- Transport Controls -->
                <div id="rehearsalControls" class="rehearsal-section">
                    <button id="btnInicio" class="rehearsal-button" title="Início">⏮</button>
                    <button id="btnMinus1" class="rehearsal-button" title="-1s">−1s</button>
                    <button id="btnPlayPause" class="rehearsal-button" title="Play/Pause">▶</button>
                    <button id="btnPlus1" class="rehearsal-button" title="+1s">+1s</button>
                    <button id="btnLoop" class="rehearsal-button" title="Loop">🔄</button>
                </div>

                <!-- A/B Controls -->
                <div id="rehearsalAB" class="rehearsal-section">
                    <button id="btnSetA" class="rehearsal-button">Marcar A</button>
                    <button id="btnSetB" class="rehearsal-button">Marcar B</button>
                    <button id="btnClearAB" class="rehearsal-button">Limpar A/B</button>
                </div>

                <!-- Pitch Controls -->
                <div id="rehearsalPitch" class="rehearsal-section">
                    <div id="pitchLabelContainer">
                        <span>Pitch (Semitoms):</span>
                        <span id="pitchLabel">0 semitons</span>
                    </div>
                    <div id="rehearsalPitchButtons">
                        <button id="btnPitchDown" class="rehearsal-button">−</button>
                        <button id="btnPitchReset" class="rehearsal-button">Reset</button>
                        <button id="btnPitchUp" class="rehearsal-button">+</button>
                    </div>
                </div>
            </div>

            <div id="barranaevegacao">
                <div style="right: 15px; position: fixed; bottom: 15px;"></div>
            </div>
        </div>
    </div>

    <div id="mostrarbtnplay" class="hide">
        <a type="button" class="btn btn-primary col" id="entrarlivePlaynow">
            <i class="fa-solid fa-play"></i> ENTRAR PRO PLAY
        </a>
    </div>

    <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1100">
        <div id="toastNovaPlay" class="toast align-items-center text-bg-success border-0" role="alert"
            aria-live="assertive" aria-atomic="true" data-bs-delay="12000"
            style="position: fixed; top: 1vh; right: 23vw;">
            <div class="d-flex">
                <div class="toast-body" style="background:white !important; color:black !important">
                    🎵 A música foi definida como nova play.
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"
                    aria-label="Fechar"></button>
            </div>
        </div>
    </div>

    <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1100">
        <div id="toastNovaPlayerro" class="toast align-items-center text-bg-success border-0" role="alert"
            aria-live="assertive" aria-atomic="true" data-bs-delay="12000"
            style="position: fixed; top: 1vh; right: 23vw;">
            <div class="d-flex">
                <div class="toast-body" style="background:RED !important; color:black !important">
                    ERRO AO DEFINIR NOVA PLAY.
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"
                    aria-label="Fechar"></button>
            </div>
        </div>
    </div>

    <div id="modalPlaylists" style="display:none; width:75%; height:75%; top:10%; left:10%; border:solid;"
        class="modal">
        <div class="modal-content">
            <span class="close" onclick='document.getElementById("modalPlaylists").style.display="none";'>&times;</span>
            <div id="listaPlaylists" style="display: contents; overflow:auto; padding:10px; margin-top:10px;"></div>
        </div>
    </div>

    <script src="/src/js/06215d6691.js"></script>
    <script src="/src/js/jquery-3.5.1.min.js"></script>
    <script src="/src/js/bootstrap.min.js"></script>

    <!-- WaveSurfer v7 (UMD version for script tag loading) -->
    <script src="https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.umd.js"></script>

    <!-- SoundTouchJS for Pitch Control (Optional) -->
    <script src="https://unpkg.com/soundtouchjs@0.1.30/dist/soundtouch.min.js"></script>

    <!-- Rehearsal Mode Modules -->
    <script src="<?= asset_url('/src/js/rehearsal/rehearsal.state.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/rehearsal/rehearsal.youtube.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/rehearsal/rehearsal.pitch.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/rehearsal/rehearsal.audio.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/rehearsal/rehearsal.ui.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/rehearsal/rehearsal.bootstrap.js') ?>" defer></script>

    <!-- Botão Ensaio - Listener IMEDIATO (executa antes de tudo) -->
    <script>
        (function setupEnsaioButton() {
            function bindButton() {
                const btn = document.getElementById('btnAtivarEnsaio');
                const panel = document.getElementById('modo-ensaio');
                
                if (!btn || !panel) return false;
                
                if (btn.dataset.ensaioListenerAdded) return true;
                btn.dataset.ensaioListenerAdded = 'true';
                
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    const isActive = panel.classList.toggle('is-active');
                    panel.setAttribute('aria-hidden', String(!isActive));
                    btn.classList.toggle('active', isActive);
                    
                    // Force reflow
                    void panel.offsetHeight;
                });
                
                return true;
            }
            
            if (!bindButton()) {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', bindButton);
                }
            }
        })();
    </script>

    <script src="<?= asset_url('/src/js/script.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/musicas.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/playlists_salvas.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/roteiros_salvos.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/playlists.js') ?>" defer></script>
    <script src="<?= asset_url('/src/js/offline-tools.js') ?>"></script>
    <script src="<?= asset_url('/src/js/live.js') ?>"></script>

    <script>
        (function () {
            const params = new URLSearchParams(window.location.search);
            const from = params.get('from');
            const roteiroId = params.get('roteiroId');
            if (from === 'roteiro' && roteiroId) {
                const backLink = document.getElementById('backLink');
                if (backLink) {
                    backLink.href = 'roteiro.php?id=' + encodeURIComponent(roteiroId);
                }
            }
        })();

        // ==========================
        //  SOMENTE LETRA (mantém tags, remove cifra)
        // ==========================
        function getTextFromHtml(html) {
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || div.innerText || "";
        }

        function sanitizeCifraHtml(html) {
            // PRESERVAR espaços múltiplos convertendo para &nbsp;
            // Isso previne o DOMParser de colapsar espaços
            const preservedHtml = String(html).replace(/ {2,}/g, match => {
                // Converte múltiplos espaços em combinação de &nbsp; e espaços
                return match.split('').map((_, i) => i === 0 ? ' ' : '&nbsp;').join('');
            });

            const allowedTags = new Set([
                'b', 'br', 'refrao', 'prerefrao', 'ponte', 'intro', 'verso',
                'strong', 'em', 'i', 'u', 'p', 'span', 'pre', 'div'
            ]);

            const doc = new DOMParser().parseFromString(preservedHtml, 'text/html');
            const nodes = Array.from(doc.body.querySelectorAll('*'));

            nodes.forEach(node => {
                const tag = node.nodeName.toLowerCase();
                if (!allowedTags.has(tag)) {
                    const parent = node.parentNode;
                    if (parent) {
                        while (node.firstChild) {
                            parent.insertBefore(node.firstChild, node);
                        }
                        parent.removeChild(node);
                    }
                    return;
                }

                Array.from(node.attributes).forEach(attr => node.removeAttribute(attr.name));
            });

            return doc.body.innerHTML;
        }

        function setCifraHtml(html) {
            const sanitized = sanitizeCifraHtml(html);
            const el = document.getElementById('song-cifra');
            if (el) {
                el.dataset.rawHtml = sanitized;
            }
            if (!window.__modoSomenteLetra && sanitized && sanitized.trim() !== '') {
                window.__cifraOriginalHtml = sanitized;
            }
            if (el && el.classList.contains('auto-columns') && typeof window.renderColumnsFromRaw === 'function') {
                window.renderColumnsFromRaw();
            } else {
                $('#song-cifra').html(sanitized);
            }
        }

        function normalizeCifraWhitespace(html) {
            return String(html).replace(/&nbsp;|\u00a0/g, ' ');
        }

        const chordTokenRegex =
            /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d{0,2}(?:\([^)]+\))?(?:\/[A-G](?:#|b)?)?$/i;

        function cleanChordTokensInPlainText(text) {
            const parts = text.split(/(\s+)/);

            const cleanedParts = parts.map(p => {
                if (/^\s+$/.test(p)) return p;

                const token = p.replace(/[.,;:!?]/g, '');
                if (chordTokenRegex.test(token)) return '';

                return p;
            });

            return cleanedParts.join('')
                .replace(/\s{2,}/g, ' ')
                .trimEnd();
        }

        // remove linhas só de cifra + remove acordes dentro da linha (mantendo tags como <prerefrao>, <refrao>, etc.)
        function stripChordLinesKeepTags(html) {
            const tagsToKeep = ['prerefrao', 'refrao', 'ponte', 'intro', 'verso'];

            let processed = html;

            // 1) limpa dentro dessas tags preservando a tag
            for (const tag of tagsToKeep) {
                const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');

                processed = processed.replace(re, (full, attrs, inner) => {
                    const innerLines = inner.split(/<br\s*\/?>/i).map(lineHtml => {
                        const text = getTextFromHtml(lineHtml);
                        const trimmed = text.trim();
                        if (!trimmed) return "";

                        const tokens = trimmed.split(/\s+/).filter(Boolean);
                        let chordLike = 0;
                        let wordLike = 0;

                        for (const t of tokens) {
                            const token = t.replace(/[.,;:!?]/g, '');
                            if (chordTokenRegex.test(token)) chordLike++;
                            else wordLike++;
                        }

                        const isChordOnlyLine = chordLike >= 1 && wordLike === 0 && tokens.length <= 12;
                        if (isChordOnlyLine) return "";

                        return cleanChordTokensInPlainText(text);
                    });

                    const innerClean = innerLines.join("<br>");
                    return `<${tag}${attrs}>${innerClean}</${tag}>`;
                });
            }

            // 2) limpa o restante fora dessas tags
            const lines = processed.split(/<br\s*\/?>/i);

            const cleaned = lines.map(lineHtml => {
                if (/(<(prerefrao|refrao|ponte|intro|verso)\b)/i.test(lineHtml)) return lineHtml;

                const text = getTextFromHtml(lineHtml);
                const trimmed = text.trim();
                if (!trimmed) return "";

                const tokens = trimmed.split(/\s+/).filter(Boolean);
                let chordLike = 0;
                let wordLike = 0;

                for (const t of tokens) {
                    const token = t.replace(/[.,;:!?]/g, '');
                    if (chordTokenRegex.test(token)) chordLike++;
                    else wordLike++;
                }

                const isChordOnlyLine = chordLike >= 1 && wordLike === 0 && tokens.length <= 12;
                if (isChordOnlyLine) return "";

                return cleanChordTokensInPlainText(text);
            });

            const result = cleaned.join('\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            let out = result
                .split('\n')
                .map(l => (l || "").trim())
                .filter(l => l !== "" && l !== "&nbsp;")
                .join("<br>");

            // remove <br> duplicado (caso ainda escape)
            out = out
                .replace(/(<br\s*\/?>\s*){2,}/gi, '<br>')
                .replace(/^(<br\s*\/?>\s*)+/gi, '')
                .replace(/(<br\s*\/?>\s*)+$/gi, '');

            return out;

        }

        // ==========================
        //  RESTO DO SEU SCRIPT
        // ==========================
        let ultimoNumero = null;

        $(document).ready(function () {

            $(document).click(function (event) {
                var $menu = $('#menusideMenu');
                var right = $menu.css('right');

                if (right === '0px' && !$(event.target).closest('#menusideMenu').length) {
                    $menu.css('right', '-300px');
                }
            });

            $(document).click(function (event) {
                var $menu = $('#sideMenu');
                var right = $menu.css('right');

                if (right === '0px' && !$(event.target).closest('#sideMenu').length) {
                    $menu.css('right', '-300px');
                }
            });

            const urlParams = new URLSearchParams(window.location.search);
            const increaseBtn = document.getElementById('increase-text');
            const decreaseBtn = document.getElementById('decrease-text');

            const increaseBtnTom = document.getElementById('increase-tom');
            const decreaseBtnTom = document.getElementById('decrease-tom');
            const cifraDiv = document.getElementById('song-cifra');
            const songId = urlParams.get('id');
            const song = songs.find(song => song.id == songId);

            let baseFontSize = null;

            ultimoNumero = songId;

            // Ajuste automático (colunas + tamanho da fonte)
            function adjustColumns() {
                if (!cifraDiv.classList.contains('auto-columns')) return;

                layoutToFill();
            }

            window.__reflowCifra = () => {
                if (!cifraDiv || !cifraDiv.classList.contains('auto-columns')) return;
                layoutToFill();
            };

            function setBodyScrollLock(locked) {
                document.body.style.overflowY = locked ? 'hidden' : '';
            }

            function getRawCifraHtml() {
                const raw = (cifraDiv.dataset.rawHtml || '').trim();
                if (raw) return raw;
                const original = (window.__cifraOriginalHtml || '').trim();
                if (original) return original;
                return cifraDiv.innerHTML || '';
            }

            function normalizarTomPlaylist(tom) {
                const equivalentes = {
                    'DB': 'C#',
                    'EB': 'D#',
                    'GB': 'F#',
                    'AB': 'G#',
                    'BB': 'A#'
                };
                const valor = String(tom || '').trim().toUpperCase();
                return equivalentes[valor] || valor;
            }

            function indiceTomPlaylist(tom) {
                const notas = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                return notas.indexOf(normalizarTomPlaylist(tom));
            }

            function aplicarTomDaPlaylist(html, tomDestino) {
                const destino = indiceTomPlaylist(tomDestino);
                const origem = indiceTomPlaylist(identificarTom(html));

                if (origem < 0 || destino < 0 || origem === destino) {
                    return html;
                }

                return transporCifraHtml(html, destino - origem);
            }

            function setTomInfo(texto, tipo) {
                const el = document.getElementById('tomInfo');
                if (!el) return;
                el.textContent = texto || '';
                el.dataset.status = tipo || '';
                el.style.display = texto ? 'block' : 'none';
            }

            function splitNodeToLines(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    return [[document.createTextNode(node.textContent)]];
                }

                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return [[document.createTextNode('')]];
                }

                const lines = [[]];
                node.childNodes.forEach(child => {
                    if (child.nodeName === 'BR') {
                        lines.push([]);
                        return;
                    }

                    const childLines = splitNodeToLines(child);
                    if (childLines.length === 1) {
                        lines[lines.length - 1].push(...childLines[0]);
                        return;
                    }

                    lines[lines.length - 1].push(...childLines[0]);
                    for (let i = 1; i < childLines.length; i += 1) {
                        lines.push([...childLines[i]]);
                    }
                });

                return lines.map(lineNodes => {
                    const clone = node.cloneNode(false);
                    lineNodes.forEach(child => clone.appendChild(child));
                    return [clone];
                });
            }

            function buildLineHtmls(html) {
                const container = document.createElement('div');
                container.innerHTML = html;

                const lines = [[]];
                container.childNodes.forEach(child => {
                    if (child.nodeName === 'BR') {
                        lines.push([]);
                        return;
                    }

                    const childLines = splitNodeToLines(child);
                    if (childLines.length === 1) {
                        lines[lines.length - 1].push(...childLines[0]);
                        return;
                    }

                    lines[lines.length - 1].push(...childLines[0]);
                    for (let i = 1; i < childLines.length; i += 1) {
                        lines.push([...childLines[i]]);
                    }
                });

                return lines.map(nodes => {
                    const line = document.createElement('div');
                    nodes.forEach(node => line.appendChild(node));
                    return line.innerHTML;
                });
            }

            function wrapLinesWithTag(tagName, attributes, lines) {
                const attrPairs = Array.from(attributes || []).map(attr => `${attr.name}="${attr.value}"`);
                const attrString = attrPairs.length ? ' ' + attrPairs.join(' ') : '';
                return lines.map(line => `<${tagName}${attrString}>${line}</${tagName}>`);
            }

            function buildBlocksFromHtml(html) {
                const container = document.createElement('div');
                container.innerHTML = html;

                // Apenas tags semânticas de cifra são blockTags - p e div são tratados como containers normais
                const blockTags = new Set(['refrao', 'prerefrao', 'ponte', 'intro', 'verso', 'pre']);
                const blocks = [];
                let currentLines = [];

                const appendLineHtml = (htmlLine) => {
                    if (currentLines.length === 0) {
                        currentLines.push(htmlLine);
                        return;
                    }

                    if (currentLines[currentLines.length - 1] === '') {
                        currentLines[currentLines.length - 1] = htmlLine;
                        return;
                    }

                    currentLines[currentLines.length - 1] += htmlLine;
                };

                const flushCurrent = () => {
                    if (currentLines.length) {
                        blocks.push({ lines: currentLines.slice(), splittable: true });
                        currentLines = [];
                    }
                };

                container.childNodes.forEach(child => {
                    if (child.nodeName === 'BR') {
                        currentLines.push('');
                        return;
                    }

                    if (child.nodeType === Node.ELEMENT_NODE && blockTags.has(child.nodeName.toLowerCase())) {
                        flushCurrent();
                        const tagName = child.nodeName.toLowerCase();
                        const lines = buildLineHtmls(child.innerHTML);
                        const wrappedLines = wrapLinesWithTag(tagName, child.attributes, lines);
                        
                        // Tags semânticas (refrao, prerefrao, ponte) não devem ser divididas
                        const isSemanticBlock = ['refrao', 'prerefrao', 'ponte', 'intro', 'verso'].includes(tagName);
                        blocks.push({ 
                            lines: wrappedLines, 
                            splittable: !isSemanticBlock,
                            belongsToSemanticBlock: isSemanticBlock
                        });
                        return;
                    }

                    const childLines = splitNodeToLines(child);
                    if (childLines.length === 1) {
                        const temp = document.createElement('div');
                        childLines[0].forEach(node => temp.appendChild(node));
                        appendLineHtml(temp.innerHTML);
                        return;
                    }

                    const temp = document.createElement('div');
                    childLines[0].forEach(node => temp.appendChild(node));
                    appendLineHtml(temp.innerHTML);
                    for (let i = 1; i < childLines.length; i += 1) {
                        const line = document.createElement('div');
                        childLines[i].forEach(node => line.appendChild(node));
                        currentLines.push(line.innerHTML);
                    }
                });

                flushCurrent();

                const isChordOnlyLine = (htmlLine) => {
                    const text = getTextFromHtml(htmlLine).replace(/\u00a0/g, ' ').trim();
                    if (!text) return false;
                    const tokens = text.split(/\s+/).filter(Boolean);
                    if (!tokens.length) return false;
                    let chordLike = 0;
                    let wordLike = 0;
                    tokens.forEach(t => {
                        const token = t.replace(/[.,;:!?]/g, '');
                        if (chordTokenRegex.test(token)) chordLike += 1;
                        else wordLike += 1;
                    });
                    return chordLike > 0 && wordLike === 0;
                };

                // Evita separar linha de cifra da linha de letra seguinte.
                const mergedBlocks = [];
                blocks.forEach(block => {
                    // Blocos não-splittable (refrao, prerefrao, ponte) mantêm-se inteiros
                    if (block.splittable === false) {
                        mergedBlocks.push(block);
                        return;
                    }
                    
                    if (!block.lines || block.lines.length <= 1) {
                        mergedBlocks.push(block);
                        return;
                    }

                    let buffer = [];
                    for (let i = 0; i < block.lines.length; i += 1) {
                        const line = block.lines[i];
                        const isChord = isChordOnlyLine(line);

                        if (isChord) {
                            if (buffer.length) {
                                mergedBlocks.push({ lines: buffer.slice(), splittable: true });
                                buffer = [];
                            }

                            const next = block.lines[i + 1];
                            if (next && !isChordOnlyLine(next)) {
                                mergedBlocks.push({ lines: [line, next], splittable: false });
                                i += 1;
                            } else {
                                mergedBlocks.push({ lines: [line], splittable: false });
                            }
                            continue;
                        }

                        buffer.push(line);
                    }

                    if (buffer.length) {
                        mergedBlocks.push({ lines: buffer.slice(), splittable: true });
                    }
                });

                return mergedBlocks;
            }

            function renderColumnsFromRaw() {
                const rawHtml = getRawCifraHtml();
                const blocks = buildBlocksFromHtml(rawHtml);
                const availableWidth = getAvailableWidth();
                const viewportWidth = window.visualViewport ? window.visualViewport.width : document.documentElement.clientWidth;
                const viewportHeight = window.visualViewport ? window.visualViewport.height : document.documentElement.clientHeight;
                const isNarrowViewport = availableWidth <= 1024;
                const isPortraitNarrow = isNarrowViewport && viewportHeight >= viewportWidth;
                const isShortLandscape = isNarrowViewport && !isPortraitNarrow && viewportHeight <= 420;
                const scrollbarAllowance = Math.max(Number(cifraDiv.dataset.scrollbarWidth || 0), (() => {
                    const scroller = document.createElement('div');
                    scroller.style.width = '100px';
                    scroller.style.height = '100px';
                    scroller.style.overflow = 'scroll';
                    scroller.style.position = 'absolute';
                    scroller.style.top = '-9999px';
                    document.body.appendChild(scroller);
                    const width = Math.max(0, scroller.offsetWidth - scroller.clientWidth);
                    document.body.removeChild(scroller);
                    return width;
                })());
                const overflowSlack = Number(cifraDiv.dataset.overflowSlack || 0);

                // ✅ em vez de “inventar” um effectiveWidth e setar px,
                // use a largura real do container e só desconte o que for necessário.
                const availableHeight = getLayoutAvailableHeight();

                const columnGap = 15;
                const columnMargin = (availableWidth <= 1024) ? 1 : 2;
                const keepChordWithLyric = !window.__modoSomenteLetra;

                cifraDiv.style.columnCount = '';
                cifraDiv.style.columnGap = '';
                cifraDiv.style.width = '100%'; // Largura base
                cifraDiv.style.maxWidth = 'none'; // ✅ Remover limite máximo
                cifraDiv.style.height = availableHeight + 'px';
                cifraDiv.style.maxHeight = availableHeight + 'px';
                cifraDiv.style.whiteSpace = 'normal';
                cifraDiv.style.overflowY = 'hidden';
                cifraDiv.style.overflowX = 'hidden'; // Inicialmente oculto, será ajustado depois

                // largura real útil
                const containerClientWidth = cifraDiv.clientWidth || availableWidth;

                // ✅ widthGuard pequeno e fixo (antes ele te impedia de colunar)
                const widthGuard = 8;

                // ✅ contentWidth real: container - scrollbar - slack
                const contentWidth = Math.max(
                    120,
                    containerClientWidth - scrollbarAllowance - 2 - overflowSlack
                );

                const measure = document.createElement('div');
                measure.style.position = 'absolute';
                measure.style.visibility = 'hidden';
                measure.style.whiteSpace = 'pre';
                measure.style.padding = '0';
                measure.style.margin = '0';
                measure.style.width = 'max-content';
                measure.style.fontSize = window.getComputedStyle(cifraDiv).fontSize;
                measure.style.fontFamily = window.getComputedStyle(cifraDiv).fontFamily;
                document.body.appendChild(measure);

                const measuredBlocks = blocks.map(block => {
                    const belongsToSemantic = block.belongsToSemanticBlock || false;
                    const lineMetrics = block.lines.map(html => {
                        const plainText = getTextFromHtml(html).replace(/\u00a0/g, ' ').trim();
                        const isEmpty = !plainText;
                        const tokens = plainText ? plainText.split(/\s+/).filter(Boolean) : [];
                        let chordLike = 0;
                        let wordLike = 0;

                        tokens.forEach(token => {
                            const cleanToken = token.replace(/[.,;:!?]/g, '');
                            if (chordTokenRegex.test(cleanToken)) {
                                chordLike += 1;
                            } else {
                                wordLike += 1;
                            }
                        });

                        const isChordOnly = tokens.length > 0 && chordLike > 0 && wordLike === 0;
                        const measureLine = (lineHtml, allowWrap) => {
                            const line = document.createElement('div');
                            line.style.display = 'inline-block';
                            line.style.whiteSpace = allowWrap ? 'normal' : 'pre';
                            if (allowWrap) {
                                line.style.width = 'fit-content';
                                line.style.maxWidth = contentWidth + 'px';
                            } else {
                                line.style.width = 'auto';
                                line.style.maxWidth = 'none';
                            }
                            line.innerHTML = lineHtml && lineHtml.trim() !== '' ? lineHtml : '&nbsp;';
                            if (!allowWrap) {
                                line.querySelectorAll('refrao, prerefrao, ponte, intro, verso, p, div').forEach(node => {
                                    node.style.display = 'inline';
                                    node.style.whiteSpace = 'pre';
                                    node.style.margin = '0';
                                    node.style.padding = '0';
                                });
                            }
                            measure.appendChild(line);
                            const rect = line.getBoundingClientRect();
                            const width = Math.ceil(rect.width);
                            const height = Math.ceil(rect.height);
                            measure.removeChild(line);
                            return { width, height };
                        };

                        let resolvedHtml = String(html).replace(/&nbsp;|\u00a0/g, ' ');
                        let naturalMetrics = measureLine(resolvedHtml, false);
                        const hasChordToken = chordLike > 0;
                        
                        // Todas as linhas usam largura natural (sem wrap)
                        const resolvedWidth = naturalMetrics.width;
                        const resolvedHeight = naturalMetrics.height;

                        return {
                            html: resolvedHtml,
                            width: resolvedWidth,
                            height: resolvedHeight,
                            isChordOnly,
                            isEmpty,
                            hasChordToken,
                            belongsToSemanticBlock: belongsToSemantic
                        };
                    });

                    const height = lineMetrics.reduce((acc, line) => acc + line.height, 0);
                    const maxWidth = lineMetrics.reduce((acc, line) => Math.max(acc, line.width), 0);
                    
                    // Detecta se é um bloco especial (refrão, pré-refrão, ponte, etc.)
                    const blockHtml = block.lines.join('');
                    const isSpecialBlock = /<(refrao|prerefrao|ponte|intro|verso)[ >]/i.test(blockHtml);
                    
                    return {
                        lines: lineMetrics,
                        height,
                        maxWidth,
                        splittable: block.splittable,
                        isSpecialBlock: isSpecialBlock
                    };
                }).filter(block => block.lines.some(line => !line.isEmpty));

                const totalHeight = measuredBlocks.reduce((acc, block) => acc + block.height, 0);
                const maxLineWidth = measuredBlocks.reduce((acc, block) => Math.max(acc, block.maxWidth), 0);
                const maxColumnsByWidth = Math.max(1, measuredBlocks.length);
                let maxColumns = maxColumnsByWidth;
                const forcedMaxColumns = Number(cifraDiv.dataset.forceMaxColumns || 0);
                if (forcedMaxColumns > 0) {
                    maxColumns = Math.min(maxColumns, forcedMaxColumns);
                }
                const forcedMinColumns = Number(cifraDiv.dataset.forceMinColumns || 0);
                const minColumnsStart = forcedMinColumns > 0
                    ? Math.min(forcedMinColumns, maxColumns)
                    : 1;
                // ✅ permite colunas no portrait também, baseado numa largura mínima por coluna
                const MIN_COL_WIDTH = 140;
                const minColsPreferred = isShortLandscape
                    ? Math.min(2, Math.floor((contentWidth + columnGap) / (MIN_COL_WIDTH + columnGap)))
                    : 1;

                if (isPortraitNarrow) {
                    maxColumns = Math.max(
                        1,
                        Math.floor((contentWidth + columnGap) / (MIN_COL_WIDTH + columnGap))
                    );
                }

                // ✅ não desabilite quebra só por estar em portrait
                const disableColumnBreaks = false;


                document.body.removeChild(measure);

                const startsWithLyric = (lines) => {
                    for (let i = 0; i < lines.length; i += 1) {
                        const line = lines[i];
                        if (line.isEmpty) continue;
                        return !line.isChordOnly;
                    }
                    return false;
                };

                const preferredPackMode = 'sequential';
                const packModesToTry = ['sequential'];

                const buildColumnsSequential = (maxColumnsForPack) => {
                    // Use ideal height per column to balance text amount while preserving order.
                    const idealHeight = totalHeight / maxColumnsForPack;
                    const targetHeight = Math.ceil(idealHeight);
                    
                    // Tolerância reduzida para melhor aproveitamento vertical
                    const overflowTolerance = Math.max(0, Math.floor(targetHeight * 0.10));
                    
                    // Altura mínima antes de permitir quebra de coluna (evita colunas com 1-2 linhas)
                    const minHeightBeforeBreak = Math.max(0, Math.floor(idealHeight * 0.85));
                    
                    // Número mínimo de linhas na coluna antes de permitir quebra
                    const minLinesBeforeBreak = 8;
                    
                    const columns = [];
                    let currentColumn = { lines: [], height: 0, maxWidth: 0 };
                    columns.push(currentColumn);
                    let totalPackedWidth = 0;
                    let columnCountPacked = 1;

                    const getLastNonEmptyLine = (column) => {
                        for (let i = column.lines.length - 1; i >= 0; i -= 1) {
                            const line = column.lines[i];
                            if (!line.isEmpty) return line;
                        }
                        return null;
                    };

                    const canStartNewColumn = (nextWidthEstimate) => {
                        if (disableColumnBreaks) return false;
                        if (columns.length >= maxColumnsForPack) return false;

                        const nextWidth = nextWidthEstimate || maxLineWidth || 0;

                        // ✅ largura real já ocupada (colunas + gaps)
                        const currentWidth =
                            columns.reduce((acc, col) => acc + Math.ceil(col.maxWidth + columnMargin), 0) +
                            Math.max(0, columns.length - 1) * columnGap;

                        const projected = currentWidth + columnGap + Math.ceil(nextWidth + columnMargin);

                        return projected <= (contentWidth - widthGuard);
                    };


                    measuredBlocks.forEach(block => {
                        const lastLine = getLastNonEmptyLine(currentColumn);
                        const avoidBreakForChord =
                            keepChordWithLyric &&
                            lastLine &&
                            lastLine.isChordOnly &&
                            startsWithLyric(block.lines);

                        // Se for bloco especial (refrão, etc) e couber na altura disponível, não quebrar
                        const isSpecial = block.isSpecialBlock;
                        const wouldFitVertically = (currentColumn.height + block.height) <= availableHeight;
                        const shouldKeepSpecialBlockTogether = isSpecial && wouldFitVertically;

                        // Só quebra coluna se:
                        // 1. Não está desabilitado
                        // 2. Não vai separar acorde da letra
                        // 3. Não é bloco especial que cabe verticalmente
                        // 4. Coluna atual atingiu altura mínima (85% da ideal)
                        // 5. Coluna tem pelo menos minLinesBeforeBreak linhas
                        // 6. Altura + próximo bloco ultrapassa alvo + tolerância
                        // 7. Já tem conteúdo
                        // 8. Cabe mais uma coluna
                        const shouldBreak = !disableColumnBreaks 
                            && !avoidBreakForChord 
                            && !shouldKeepSpecialBlockTogether
                            && currentColumn.height >= minHeightBeforeBreak
                            && currentColumn.lines.length >= minLinesBeforeBreak
                            && currentColumn.height + block.height > (targetHeight + overflowTolerance) 
                            && currentColumn.lines.length > 0 
                            && canStartNewColumn(block.maxWidth);
                        
                        if (shouldBreak) {
                            console.log(`[DEBUG] Quebra coluna ${columns.length} -> ${columns.length + 1}: height=${currentColumn.height}px, isSpecial=${isSpecial}, wouldFit=${wouldFitVertically}`);
                            currentColumn = { lines: [], height: 0, maxWidth: 0 };
                            columns.push(currentColumn);
                            columnCountPacked += 1;
                        }
                        
                        if (shouldKeepSpecialBlockTogether && currentColumn.lines.length > 0) {
                            console.log(`[DEBUG] Mantendo bloco especial junto: height=${currentColumn.height + block.height}px <= ${availableHeight}px`);
                        }

                        const prevMax = currentColumn.maxWidth;
                        block.lines.forEach(line => {
                            currentColumn.lines.push(line);
                        });
                        currentColumn.height += block.height;
                        currentColumn.maxWidth = Math.max(currentColumn.maxWidth, block.maxWidth);
                        if (currentColumn.maxWidth > prevMax) {
                            totalPackedWidth += currentColumn.maxWidth - prevMax;
                        }
                    });

                    if (keepChordWithLyric && columns.length > 1) {
                        for (let c = 0; c < columns.length - 1; c += 1) {
                            const column = columns[c];
                            let lastIndex = -1;
                            for (let i = column.lines.length - 1; i >= 0; i -= 1) {
                                if (!column.lines[i].isEmpty) {
                                    lastIndex = i;
                                    break;
                                }
                            }

                            if (lastIndex === -1) continue;
                            const lastLine = column.lines[lastIndex];
                            if (!lastLine.isChordOnly) continue;

                            const nextColumn = columns[c + 1];
                            if (!nextColumn || !startsWithLyric(nextColumn.lines)) continue;

                            const moved = column.lines.splice(lastIndex);
                            nextColumn.lines = moved.concat(nextColumn.lines);

                            const recalc = (col) => {
                                col.height = col.lines.reduce((acc, line) => acc + line.height, 0);
                                col.maxWidth = col.lines.reduce((acc, line) => Math.max(acc, line.width), 0);
                            };

                            recalc(column);
                            recalc(nextColumn);
                        }
                    }

                    return columns;
                };

                const buildColumnsBalanced = (maxColumnsForPack) => {
                    const columns = Array.from({ length: maxColumnsForPack }, () => ({ lines: [], height: 0, maxWidth: 0 }));

                    measuredBlocks.forEach(block => {
                        let target = columns[0];
                        for (let i = 1; i < columns.length; i += 1) {
                            if (columns[i].height < target.height) {
                                target = columns[i];
                            }
                        }

                        block.lines.forEach(line => {
                            target.lines.push(line);
                        });
                        target.height += block.height;
                        target.maxWidth = Math.max(target.maxWidth, block.maxWidth);
                    });

                    return columns.filter(column => column.lines.length > 0);
                };

                const buildColumnsWithMode = (maxColumnsForPack) => {
                    return buildColumnsSequential(maxColumnsForPack);
                };

                const computeTotalWidth = (columnsList, gapValue) => {
                    let width = 0;
                    columnsList.forEach(column => {
                        const columnWidth = Math.max(0, Math.floor(column.maxWidth + columnMargin));
                        width += columnWidth;
                    });
                    width += Math.max(0, columnsList.length - 1) * gapValue;
                    return width;
                };

                const scoreColumns = (columnsList) => {
                    if (!columnsList.length) return Number.POSITIVE_INFINITY;
                    const heights = columnsList.map(column => column.height || 0);
                    const maxH = Math.max(...heights);
                    const minH = Math.min(...heights);
                    const imbalancePenalty = maxH - minH;
                    const shortColumnPenalty = minH < maxH * 0.75 ? maxH * 2 : 0;
                    return maxH + 0.6 * imbalancePenalty + shortColumnPenalty;
                };

                const balanceColumns = (columnsList) => {
                    const balanceMinRatio = 0.9;
                    const balanceMaxGap = 40;
                    const columnsCopy = columnsList.map(column => ({
                        lines: column.lines.slice(),
                        height: column.height,
                        maxWidth: column.maxWidth
                    }));

                    const recalc = (col) => {
                        col.height = col.lines.reduce((acc, line) => acc + line.height, 0);
                        col.maxWidth = col.lines.reduce((acc, line) => Math.max(acc, line.width), 0);
                    };

                    const canMoveLine = (fromCol, toCol, line) => {
                        if (!line) return false;
                        // Não move linhas que pertencem a blocos semânticos
                        if (line.belongsToSemanticBlock) return false;
                        const fi = columnsCopy.indexOf(fromCol);
                        const ti = columnsCopy.indexOf(toCol);
                        if (fi === -1 || ti === -1) return false;

                        const tmpCols = columnsCopy.map(col => ({
                            lines: col.lines.slice(),
                            maxWidth: col.maxWidth
                        }));

                        tmpCols[fi].lines.pop();
                        tmpCols[ti].lines.unshift(line);

                        const recalcMaxW = (col) => col.lines.reduce((acc, l) => Math.max(acc, l.width), 0);
                        tmpCols[fi].maxWidth = recalcMaxW(tmpCols[fi]);
                        tmpCols[ti].maxWidth = recalcMaxW(tmpCols[ti]);

                        const nextWidth = computeTotalWidth(
                            tmpCols.map(col => ({ maxWidth: col.maxWidth })),
                            resolvedColumnGap
                        );

                        return nextWidth <= (contentWidth - widthGuard);
                    };

                    for (let moves = 0; moves < 50; moves += 1) {
                        let maxIndex = 0;
                        let minIndex = 0;
                        for (let i = 1; i < columnsCopy.length; i += 1) {
                            if (columnsCopy[i].height > columnsCopy[maxIndex].height) maxIndex = i;
                            if (columnsCopy[i].height < columnsCopy[minIndex].height) minIndex = i;
                        }

                        const maxH = columnsCopy[maxIndex].height;
                        const minH = columnsCopy[minIndex].height;
                        if (minH >= maxH * balanceMinRatio || (maxH - minH) <= balanceMaxGap) {
                            break;
                        }

                        const fromCol = columnsCopy[maxIndex];
                        const toCol = columnsCopy[minIndex];
                        if (!fromCol.lines.length) break;

                        const lastLine = fromCol.lines[fromCol.lines.length - 1];
                        if (!canMoveLine(fromCol, toCol, lastLine)) break;

                        fromCol.lines.pop();
                        toCol.lines.unshift(lastLine);
                        recalc(fromCol);
                        recalc(toCol);
                    }

                    return columnsCopy;
                };

                let resolvedColumnGap = columnGap;
                let columns = null;
                let totalWidth = 0;
                let bestScore = Number.POSITIVE_INFINITY;
                let bestColumns = null;
                let bestWidth = 0;
                let bestGap = resolvedColumnGap;
                let bestMode = packModesToTry[0];

                for (let k = minColumnsStart; k <= maxColumns; k += 1) {
                    const cols = buildColumnsWithMode(k);
                    const width = computeTotalWidth(cols, resolvedColumnGap);
                    let effectiveGap = resolvedColumnGap;
                    let effectiveWidth = width;

                    if (width > (contentWidth - widthGuard)) {
                        const minWidth = computeTotalWidth(cols, 0);
                        if (minWidth > (contentWidth - widthGuard)) {
                            continue;
                        }

                        const overflow = width - (contentWidth - widthGuard);
                        const gapReduction = Math.ceil(overflow / Math.max(1, cols.length - 1));
                        effectiveGap = Math.max(0, resolvedColumnGap - gapReduction);
                        effectiveWidth = computeTotalWidth(cols, effectiveGap);
                    }

                    const heights = cols.map(col => col.height || 0);
                    const maxH = Math.max(...heights, 0);
                    const minH = Math.min(...heights, 0);
                    const imbalance = maxH > 0 ? (maxH - minH) / maxH : 0;
                    const heightUsage = availableHeight > 0 ? maxH / availableHeight : 1;
                    const overflow = Math.max(0, maxH - availableHeight);

                    // Prefer no overflow, then better balance, then closer to full height usage.
                    const score = (overflow > 0 ? 1000 + overflow : 0)
                        + (imbalance * 200)
                        + (Math.abs(1 - heightUsage) * 10);

                    if (score < bestScore) {
                        bestScore = score;
                        bestColumns = cols;
                        bestWidth = effectiveWidth;
                        bestGap = effectiveGap;
                        bestMode = preferredPackMode;
                    }
                }

                if (bestColumns) {
                    columns = bestColumns;
                    totalWidth = bestWidth;
                    resolvedColumnGap = bestGap;
                } else {
                    columns = buildColumnsWithMode(1);
                    totalWidth = computeTotalWidth(columns, resolvedColumnGap);
                }

                cifraDiv.dataset.packMode = bestMode;

                if (minColsPreferred > 1 && columns.length < minColsPreferred) {
                    const preferredColumns = buildColumnsSequential(minColsPreferred);
                    const preferredWidth = computeTotalWidth(preferredColumns, resolvedColumnGap);
                    if (preferredWidth <= (contentWidth - widthGuard)) {
                        columns = preferredColumns;
                        totalWidth = preferredWidth;
                    }
                }

                if (totalWidth > (contentWidth - widthGuard) && columns.length > 1) {
                    const overflow = totalWidth - (contentWidth - widthGuard);
                    const gapReduction = Math.ceil(overflow / (columns.length - 1));
                    resolvedColumnGap = Math.max(0, columnGap - gapReduction);
                    totalWidth = computeTotalWidth(columns, resolvedColumnGap);
                }

                // ✅ NOVO: Se altura total < altura disponível, expandir colunas para ocupar espaço vertical
                let maxHeightInColumns = Math.max(...columns.map(col => col.height || 0));
                let minHeightInColumns = Math.min(...columns.map(col => col.height || 0));
                let heightImbalance = maxHeightInColumns > 0 ? (maxHeightInColumns - minHeightInColumns) / maxHeightInColumns : 0;
                
                console.log('[renderColumnsFromRaw] DEBUG COLUNAS:', {
                    columnCount: columns.length,
                    maxHeight: maxHeightInColumns,
                    minHeight: minHeightInColumns,
                    heightImbalance: (heightImbalance * 100).toFixed(1) + '%',
                    availableHeight,
                    maxColumns,
                    canExpandMore: maxHeightInColumns < availableHeight && columns.length < maxColumns
                });
                
                // Se há muito desbalance (>30%), tentar balancear redistribuindo blocos
                if (heightImbalance > 0.3 && columns.length > 1) {
                    console.log('[renderColumnsFromRaw] Balanceando colunas...');
                    const balanced = balanceColumns(columns);
                    const balancedMaxHeight = Math.max(...balanced.map(col => col.height || 0));
                    const balancedMinHeight = Math.min(...balanced.map(col => col.height || 0));
                    const newImbalance = balancedMaxHeight > 0 ? (balancedMaxHeight - balancedMinHeight) / balancedMaxHeight : 0;
                    
                    console.log('[renderColumnsFromRaw] Após balanceamento:', {
                        heightImbalance: (newImbalance * 100).toFixed(1) + '%',
                        maxHeight: balancedMaxHeight
                    });
                    
                    // Se balanceamento melhorou, usar
                    if (newImbalance < heightImbalance * 0.8) {
                        columns = balanced;
                    }
                }
                
                // Tentar adicionar mais colunas se há espaço horizontal E (overflow vertical OU espaço vertical sobrando)
                const shouldTryMoreColumns = columns.length < maxColumns && (
                    maxHeightInColumns > availableHeight || // Tem overflow, tentar dividir mais
                    maxHeightInColumns < availableHeight * 0.85 // Muito espaço sobrando, tentar preencher
                );
                
                if (shouldTryMoreColumns) {
                    // Tentar adicionar mais colunas até preencher o espaço ou resolver overflow
                    for (let k = columns.length + 1; k <= maxColumns; k += 1) {
                        const newCols = buildColumnsWithMode(k);
                        const newWidth = computeTotalWidth(newCols, resolvedColumnGap);
                        const newMaxHeight = Math.max(...newCols.map(col => col.height || 0));
                        
                        console.log(`[renderColumnsFromRaw] Testando ${k} colunas:`, {
                            newWidth,
                            contentWidth: contentWidth - widthGuard,
                            newMaxHeight,
                            availableHeight,
                            fits: newWidth <= (contentWidth - widthGuard)
                        });
                        
                        // Se a largura cabe
                        if (newWidth <= (contentWidth - widthGuard)) {
                            // Se reduz overflow OU mantém dentro da altura disponível, usar
                            if (newMaxHeight <= availableHeight || newMaxHeight < maxHeightInColumns) {
                                console.log(`[renderColumnsFromRaw] ✅ Usando ${k} colunas (melhora altura)`);
                                columns = newCols;
                                totalWidth = newWidth;
                                maxHeightInColumns = newMaxHeight;
                            } else {
                                console.log(`[renderColumnsFromRaw] ⚠️ ${k} colunas piora altura (${newMaxHeight}px vs ${maxHeightInColumns}px)`);
                                break;
                            }
                        } else {
                            console.log(`[renderColumnsFromRaw] ❌ Não cabe ${k} colunas horizontalmente`);
                            break;
                        }
                    }
                }

                const heights = columns.map(column => column.height || 0);
                const maxH = Math.max(...heights, 0);
                const minH = Math.min(...heights, 0);
                if (maxH > 0 && (minH < maxH * 0.55)) {
                    if (columns.length > 1) {
                        const mergeIndex = heights.indexOf(minH);
                        const targetIndex = mergeIndex > 0 ? mergeIndex - 1 : mergeIndex + 1;
                        const target = columns[targetIndex];
                        const source = columns[mergeIndex];
                        if (target && source && Array.isArray(target.lines) && Array.isArray(source.lines)) {
                            if (mergeIndex < targetIndex) {
                                target.lines = source.lines.concat(target.lines);
                            } else {
                                target.lines = target.lines.concat(source.lines);
                            }
                            target.height = target.lines.reduce((acc, line) => acc + line.height, 0);
                            target.maxWidth = target.lines.reduce((acc, line) => Math.max(acc, line.width), 0);
                            columns.splice(mergeIndex, 1);
                            totalWidth = computeTotalWidth(columns, resolvedColumnGap);
                        }
                    }
                }

                const columnsWrapper = document.createElement('div');
                columnsWrapper.style.display = 'flex';
                columnsWrapper.style.alignItems = 'flex-start';
                columnsWrapper.style.gap = resolvedColumnGap + 'px';
                columnsWrapper.style.width = 'max-content'; // Cresce conforme necessário
                columnsWrapper.style.minWidth = '100%'; // Ocupa pelo menos 100%
                columnsWrapper.style.overflow = 'visible'; // Nunca cortar

                let maxColumnHeight = 0;

                columns.forEach(column => {
                    const columnEl = document.createElement('div');
                    // ✅ Não definir largura fixa - deixar o conteúdo definir naturalmente
                    columnEl.style.whiteSpace = 'pre';
                    columnEl.style.display = 'flex';
                    columnEl.style.flexDirection = 'column';
                    columnEl.style.flex = '0 0 auto';
                    columnEl.style.minWidth = '0'; // Permite shrink se necessário
                    columnEl.style.overflow = 'visible'; // Nunca ocultar conteúdo
                    columnEl.style.paddingRight = columnMargin + 'px'; // Espaçamento mínimo à direita

                    column.lines.forEach(line => {
                        const lineEl = document.createElement('div');
                        lineEl.style.display = 'block'; // Block para ocupar toda largura disponível
                        lineEl.style.whiteSpace = 'pre'; // Nunca quebrar linhas
                        lineEl.style.overflow = 'visible'; // Nunca cortar
                        lineEl.style.width = 'max-content'; // Cresce conforme necessário
                        lineEl.innerHTML = line.html && line.html.trim() !== '' ? line.html : '&nbsp;';
                        columnEl.appendChild(lineEl);
                    });

                    columnsWrapper.appendChild(columnEl);
                });

                cifraDiv.innerHTML = '';
                cifraDiv.appendChild(columnsWrapper);

                // ✅ Permitir scroll horizontal se necessário, mas priorizar vertical
                cifraDiv.style.overflowX = 'auto';
                cifraDiv.style.overflowY = 'auto';

                const renderedColumns = Array.from(columnsWrapper.children);
                renderedColumns.forEach(col => {
                    const rect = col.getBoundingClientRect();
                    maxColumnHeight = Math.max(maxColumnHeight, Math.ceil(rect.height));
                });

                const actualOverflowX = cifraDiv.scrollWidth - cifraDiv.clientWidth;
                const actualOverflowY = cifraDiv.scrollHeight - cifraDiv.clientHeight;
                const scrollbarWidth = Math.max(0, cifraDiv.offsetWidth - cifraDiv.clientWidth);
                
                // ✅ Sempre permitir scroll se há overflow
                cifraDiv.style.overflowX = actualOverflowX > 1 ? 'auto' : 'hidden';
                cifraDiv.style.overflowY = actualOverflowY > 1 ? 'auto' : 'hidden';
                
                // Layout check - debug info
                cifraDiv.dataset.balancedTried = '';
                cifraDiv.dataset.columnsUsed = String(columns.length);
                cifraDiv.dataset.actualOverflowX = String(actualOverflowX);
                cifraDiv.dataset.scrollbarWidth = String(scrollbarWidth);
                cifraDiv.dataset.heightUsage = String(maxColumnHeight / availableHeight);
                cifraDiv.dataset.maxColumnHeight = String(maxColumnHeight);
                cifraDiv.dataset.actualOverflowY = String(actualOverflowY);
            }

            window.renderColumnsFromRaw = renderColumnsFromRaw;

            function layoutToFillFast() {
                const minSize = 6;
                const availableHeight = getLayoutAvailableHeight();
                const availableWidth = getAvailableWidth();
                const viewportWidth = window.visualViewport ? window.visualViewport.width : document.documentElement.clientWidth;
                const viewportHeight = window.visualViewport ? window.visualViewport.height : document.documentElement.clientHeight;
                const isNarrowViewport = availableWidth <= 1024;
                const isPortraitNarrow = isNarrowViewport && viewportHeight >= viewportWidth;
                const isShortLandscape = isNarrowViewport && !isPortraitNarrow && viewportHeight <= 420;
                const minColWidth = 140;
                const columnGap = 15;
                const isTablet = viewportWidth >= 900 && viewportWidth <= 1200;
                const isDesktop = viewportWidth >= 1280;
                const maxColsByWidth = Math.max(1, Math.floor((availableWidth + columnGap) / (minColWidth + columnGap)));
                const maxColsCap = isNarrowViewport ? 4 : 6;
                const maxCols = Math.min(maxColsByWidth, maxColsCap);
                const tabletPreferred = isTablet ? Math.min(3, maxColsByWidth) : 1;
                let minColsPreferred = isShortLandscape
                    ? Math.min(2, maxColsByWidth)
                    : tabletPreferred;
                if (isDesktop) {
                    minColsPreferred = Math.max(minColsPreferred, 2);
                }
                const maxSize = Math.max(
                    240,
                    Math.floor(availableHeight * (isNarrowViewport ? (isShortLandscape ? 1.2 : 0.9) : (isDesktop ? 1.0 : 0.9)))
                );
                const maxSizeCap = Math.floor(availableHeight * (isTablet ? 2.0 : (isDesktop ? 0.95 : 0.85)));
                const scrollTarget = 1.02;
                const step = 0.5;

                const readState = () => ({
                    overflowX: Number(cifraDiv.dataset.actualOverflowX || 0),
                    overflowY: Number(cifraDiv.dataset.actualOverflowY || 0),
                    heightUsage: Number(cifraDiv.dataset.heightUsage || 0),
                    columnsUsed: Number(cifraDiv.dataset.columnsUsed || 1)
                });

                const tryRender = (cols, fontSize, minCols) => {
                    if (Number.isFinite(fontSize)) {
                        cifraDiv.style.fontSize = fontSize + 'px';
                    }
                    if (Number.isFinite(cols)) {
                        cifraDiv.dataset.forceMaxColumns = String(cols);
                    } else {
                        cifraDiv.dataset.forceMaxColumns = '';
                    }
                    if (Number.isFinite(minCols) && minCols > 0) {
                        cifraDiv.dataset.forceMinColumns = String(minCols);
                    } else {
                        cifraDiv.dataset.forceMinColumns = '';
                    }
                    renderColumnsFromRaw();
                    return readState();
                };

                let currentSize = parseFloat(window.getComputedStyle(cifraDiv, null).getPropertyValue('font-size'));
                currentSize = Math.max(minSize, currentSize);

                // Passo A: prefere 2 colunas em telas largas, se couber.
                let minForcedCols = minColsPreferred > 1 ? minColsPreferred : 1;
                if (minForcedCols > 1) {
                    const preferState = tryRender(minForcedCols, currentSize, minForcedCols);
                    if (preferState.overflowX > 1) {
                        minForcedCols = 1;
                        cifraDiv.dataset.forceMinColumns = '';
                    }
                }

                // Passo A: encontra o maior numero de colunas sem overflow X.
                let lowCols = minForcedCols;
                let highCols = Math.max(1, maxCols);
                let bestCols = minForcedCols;
                let colsIters = 0;
                while (lowCols <= highCols && colsIters < 4) {
                    const mid = Math.floor((lowCols + highCols) / 2);
                    const state = tryRender(mid, currentSize, minForcedCols);
                    if (state.overflowX <= 1) {
                        bestCols = mid;
                        lowCols = mid + 1;
                    } else {
                        highCols = mid - 1;
                    }
                    colsIters += 1;
                }

                if (minColsPreferred > 1 && bestCols < minColsPreferred) {
                    let preferredSize = currentSize;
                    let preferredState = tryRender(minColsPreferred, preferredSize, minColsPreferred);
                    if (preferredState.overflowX > 1) {
                        for (let i = 0; i < 4; i += 1) {
                            preferredSize = Math.max(minSize, preferredSize - step);
                            preferredState = tryRender(minColsPreferred, preferredSize, minColsPreferred);
                            if (preferredState.overflowX <= 1) {
                                break;
                            }
                        }
                    }
                    if (preferredState.overflowX <= 1) {
                        bestCols = minColsPreferred;
                        currentSize = preferredSize;
                    }
                }

                // Passo B: com colunas fixas, cresce fonte ate encostar no limite vertical.
                let low = currentSize;
                let high = Math.max(currentSize, Math.min(maxSize, maxSizeCap));
                let bestSize = currentSize;
                let sizeIters = 0;
                while (low <= high && sizeIters < 4) {
                    const mid = Math.round(((low + high) / 2) / step) * step;
                    const state = tryRender(bestCols, mid);
                    const fits = state.overflowX <= 1 && state.heightUsage <= scrollTarget;
                    if (fits) {
                        bestSize = mid;
                        low = mid + step;
                    } else {
                        high = mid - step;
                    }
                    sizeIters += 1;
                }

                // Render final com o melhor tamanho e colunas fixas.
                let finalCols = bestCols;
                let finalSize = bestSize;
                let finalState = tryRender(finalCols, finalSize, minForcedCols);
                let safetyIters = 0;

                while (finalState.overflowX > 1 && finalCols > 1 && safetyIters < 2) {
                    finalCols -= 1;
                    finalState = tryRender(finalCols, finalSize, minForcedCols);
                    safetyIters += 1;
                }

                let sizeAdjustIters = 0;
                while (finalState.overflowX > 1 && finalSize > minSize && sizeAdjustIters < 4) {
                    finalSize = Math.max(minSize, finalSize - step);
                    finalState = tryRender(finalCols, finalSize, minForcedCols);
                    sizeAdjustIters += 1;
                }

                let needsScroll = finalState.overflowY > 1 || finalState.heightUsage > scrollTarget;
                let fillIters = 0;
                const fillTarget = finalCols === 1 ? 0.82 : 0.70;
                while (!needsScroll && finalState.heightUsage < fillTarget && fillIters < 6) {
                    const nextSize = Math.min(maxSizeCap, finalSize + step);
                    if (nextSize <= finalSize + 0.001) break;
                    finalSize = nextSize;
                    finalState = tryRender(finalCols, finalSize, minForcedCols);
                    if (finalState.overflowX > 1) {
                        finalSize = Math.max(minSize, finalSize - step);
                        finalState = tryRender(finalCols, finalSize, minForcedCols);
                        break;
                    }
                    needsScroll = finalState.overflowY > 1 || finalState.heightUsage > scrollTarget;
                    fillIters += 1;
                }

                cifraDiv.dataset.forceMaxColumns = '';
                cifraDiv.dataset.forceMinColumns = '';
                cifraDiv.style.overflowY = needsScroll ? 'auto' : 'hidden';
                setBodyScrollLock(!needsScroll);
            }

            function layoutToFill() {
                layoutToFillFast();
            }

                        function getBottomOverlayHeight() {
                                let h = 0;

                                const playBar = document.getElementById('mostrarbtnplay');
                                const playVisible = playBar && playBar.offsetParent !== null;
                                if (playVisible) {
                                        h = Math.max(h, Math.ceil(playBar.getBoundingClientRect().height) + 10);
                                }

                                const extraBottomSafety = playVisible ? 50 : 22;
                                return h + extraBottomSafety;
                        }


       function getLayoutAvailableHeight() {
  const base = getAvailableHeight();
  const viewportWidth = window.visualViewport ? window.visualViewport.width : document.documentElement.clientWidth;
  const heightSafety = viewportWidth <= 1024 ? 16 : 8;
  return Math.max(80, base - heightSafety);
}


            function getAvailableHeight() {
                const rect = cifraDiv.getBoundingClientRect();
                const viewportHeight = window.visualViewport ? window.visualViewport.height : document.documentElement.clientHeight;
                const viewportTop = window.visualViewport ? window.visualViewport.offsetTop : 0;
                const padding = 16;
                const top = rect.top - viewportTop;
                const bottomOverlay = getBottomOverlayHeight();
                return Math.max(80, viewportHeight - top - padding - bottomOverlay);
            }

            function getAvailableWidth() {
                const rect = cifraDiv.getBoundingClientRect();
                const viewportWidth = window.visualViewport ? window.visualViewport.width : document.documentElement.clientWidth;
                const viewportLeft = window.visualViewport ? window.visualViewport.offsetLeft : 0;
                const parentWidth = cifraDiv.parentElement ? cifraDiv.parentElement.clientWidth : document.documentElement.clientWidth;

                const padding = 16;

                const isNarrowViewport = viewportWidth <= 1024;
                const vvHeight = window.visualViewport ? window.visualViewport.height : document.documentElement.clientHeight;
                const isLandscapeNarrow = isNarrowViewport && vvHeight < viewportWidth;

                // ✅ segurança mínima (antes estava enorme e “comia” a tela)
                const safety = isLandscapeNarrow ? 24 : (isNarrowViewport ? 16 : 12);

                const left = rect.left - viewportLeft;

                const viewportAvailable = viewportWidth - left - padding - safety;
                const parentAvailable = parentWidth - safety;

                return Math.max(120, Math.min(viewportAvailable, parentAvailable));
            }

            function shrinkToFit() { }

            function validateLayout() {
                const overflowX = cifraDiv.scrollWidth > getAvailableWidth();
                const overflowY = cifraDiv.scrollHeight > getAvailableHeight() * 0.98;
                const currentSize = parseFloat(window.getComputedStyle(cifraDiv, null).getPropertyValue('font-size'));
                const widthConstrained = cifraDiv.dataset.widthConstrained === '1';

                if (overflowX && !widthConstrained && baseFontSize !== null && currentSize > baseFontSize) {
                    cifraDiv.style.fontSize = baseFontSize + 'px';
                    renderColumnsFromRaw();
                }

                // Layout musica com overflow - monitored but not logged
            }

            if (song) {
                $('#song-title').text(song.nome);
                $('#artist-name').text(song.artista);

                const tomPlaylist = normalizarTomPlaylist(urlParams.get('playlistTom'));
                const sanitizedCifra = sanitizeCifraHtml(song.cifra);
                const tomDetectadoOriginal = identificarTom(sanitizedCifra);
                const cifraInicial = aplicarTomDaPlaylist(sanitizedCifra, tomPlaylist);

                // Render inicial
                setCifraHtml(cifraInicial);

                // Guarda original
                window.__cifraOriginalHtml = cifraInicial;
                window.__modoSomenteLetra = false;

                const savedMode = localStorage.getItem('modoSomenteLetra') === '1';
                if (savedMode) {
                    window.__modoSomenteLetra = true;
                    const letraHtml = stripChordLinesKeepTags(window.__cifraOriginalHtml);
                    setCifraHtml(letraHtml);
                    $("#tom").text('');
                } else {
                    $("#tom").text(identificarTom(cifraInicial));
                }

                if (tomPlaylist) {
                    if (indiceTomPlaylist(tomDetectadoOriginal) < 0) {
                        setTomInfo('Tom da playlist: ' + tomPlaylist + ' | tom original nao identificado com seguranca', 'waiting');
                    } else {
                        setTomInfo('Tom da playlist: ' + tomPlaylist + ' | original detectado: ' + tomDetectadoOriginal, 'follow');
                    }
                } else {
                    setTomInfo('Tom original detectado: ' + (tomDetectadoOriginal || 'nao identificado'), tomDetectadoOriginal ? 'host' : 'waiting');
                }

                $("#linkYou").attr("href", "https://www.youtube.com/results?search_query=" +
                    encodeURIComponent(song.nome + ' ' + song.artista));

                if (!song.bit) song.bit = 120;
                document.getElementById('bpmValue').textContent = song.bit;
                document.getElementById('bpmValue').value = song.bit;
                document.getElementById('bpmSlider').value = song.bit;

                if (!navigator.onLine) {
                    $("#mostrarbtnplay").hide();
                }

            } else {
                $('body').html('<div class="container"><h1>Música não encontrada</h1></div>');
                return;
            }

            // ajuste colunas no load e resize
            adjustColumns();
            setTimeout(validateLayout, 100);
            window.addEventListener('resize', adjustColumns);
            window.addEventListener('resize', validateLayout);

            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', () => {
                    adjustColumns();
                    validateLayout();
                });
            }

            // Fonte A+ / A-
            increaseBtn.addEventListener('click', () => {
                const currentSize = parseFloat(window.getComputedStyle(cifraDiv, null).getPropertyValue('font-size'));
                cifraDiv.style.fontSize = (currentSize + 1) + 'px';
                adjustColumns();
                setTimeout(adjustColumns, 50);
            });

            decreaseBtn.addEventListener('click', () => {
                const currentSize = parseFloat(window.getComputedStyle(cifraDiv, null).getPropertyValue('font-size'));
                cifraDiv.style.fontSize = (currentSize - 1) + 'px';
                adjustColumns();
                setTimeout(adjustColumns, 50);
            });

            // Tom + / -
            increaseBtnTom.addEventListener('click', () => {
                if (window.__modoSomenteLetra) return; // sem cifra, não transpõe
                for (let tentativa = 0; tentativa < 12; tentativa += 1) {
                    var cifraAtual = getRawCifraHtml();
                    var tom = identificarTom(cifraAtual);
                    var cifraTransposta = transporCifraHtml(cifraAtual, 1);
                    var tomnovo = identificarTom(cifraTransposta);
                    if (tom == tomnovo) continue;
                    setCifraHtml(cifraTransposta);
                    window.__cifraOriginalHtml = cifraTransposta;
                    $("#tom").text(tomnovo);
                    setTomInfo('Tom ajustado manualmente: ' + tomnovo + ' | nao salva na playlist automaticamente', 'waiting');
                    break;
                }
            });

            decreaseBtnTom.addEventListener('click', () => {
                if (window.__modoSomenteLetra) return; // sem cifra, não transpõe
                for (let tentativa = 0; tentativa < 12; tentativa += 1) {
                    var cifraAtual = getRawCifraHtml();
                    var tom = identificarTom(cifraAtual);
                    var cifraTransposta = transporCifraHtml(cifraAtual, -1);
                    var tomnovo = identificarTom(cifraTransposta);
                    if (tom == tomnovo) continue;
                    setCifraHtml(cifraTransposta);
                    window.__cifraOriginalHtml = cifraTransposta;
                    $("#tom").text(tomnovo);
                    setTomInfo('Tom ajustado manualmente: ' + tomnovo + ' | nao salva na playlist automaticamente', 'waiting');
                    break;
                }
            });

            // Toggle colunas automáticas
            const btnAutoCols = document.getElementById('toggle-columns');
            btnAutoCols.classList.add('active');
            btnAutoCols.textContent = 'Desativar ajuste automático';
            btnAutoCols.addEventListener('click', () => {
                cifraDiv.classList.toggle('auto-columns');
                btnAutoCols.classList.toggle('active');

                btnAutoCols.textContent = cifraDiv.classList.contains('auto-columns')
                    ? 'Desativar ajuste automático'
                    : 'Ativar ajuste automático';

                if (cifraDiv.classList.contains('auto-columns')) {
                    adjustColumns();
                } else {
                    cifraDiv.innerHTML = getRawCifraHtml();
                    cifraDiv.style.columnCount = '';
                    cifraDiv.style.height = '';
                    cifraDiv.style.maxHeight = '';
                    cifraDiv.style.width = '';
                    cifraDiv.style.maxWidth = '';
                    cifraDiv.style.columnFill = '';
                    cifraDiv.style.overflowX = '';
                    cifraDiv.style.overflowY = '';
                    setBodyScrollLock(false);
                    $('#song-cifra').css("max-width", "");
                }
            });

            function resetAutoColumns() {
                if (!cifraDiv || !cifraDiv.classList.contains('auto-columns')) return;
                layoutToFill();
            }

            // Toggle cifra/letra
            const btnToggle = document.getElementById('toggle-cifra-letra');

            function updateToggleLabel() {
                if (window.__modoSomenteLetra) {
                    btnToggle.textContent = 'Mostrar cifra';
                    btnToggle.classList.add('active');
                } else {
                    btnToggle.textContent = 'Somente letra';
                    btnToggle.classList.remove('active');
                }
            }

            updateToggleLabel();

            btnToggle.addEventListener('click', () => {
                const btnAuto = document.getElementById('toggle-columns');

                window.__modoSomenteLetra = !window.__modoSomenteLetra;
                localStorage.setItem('modoSomenteLetra', window.__modoSomenteLetra ? '1' : '0');

                if (window.__modoSomenteLetra) {
                    const letraHtml = stripChordLinesKeepTags(window.__cifraOriginalHtml);
                    setCifraHtml(letraHtml);



                    $("#tom").text('');
                } else {
                    setCifraHtml(window.__cifraOriginalHtml);
                    $("#tom").text(identificarTom(window.__cifraOriginalHtml));
                }

                updateToggleLabel();
                adjustColumns();
                setTimeout(resetAutoColumns, 0);
            });


            if (window.LiveMode) {
                window.LiveMode.atualizarPaginaHost(false);
            }
        });

        let __lastPlayVisible = null;

        function setPlayBarVisible(visible) {
            if (__lastPlayVisible === visible) return false;
            __lastPlayVisible = visible;
            if (visible) {
                $("#mostrarbtnplay").show();
            } else {
                $("#mostrarbtnplay").hide();
            }
            return true;
        }

        window.addEventListener('offline', () => {
            const changed = setPlayBarVisible(false);
            if (changed && window.__reflowCifra) window.__reflowCifra();
        });

        window.addEventListener('online', () => {
            if (window.LiveMode) window.LiveMode.consultarStatus();
        });

        // ==========================
        //  METRÔNOMO
        // ==========================
        let metronomeInterval = null;
        let audioCtx = null;
        let tapTimes = [];

        function playClick() {
            if (!audioCtx) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(750, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.05);
        }

        function startMetronome(bpm) {
            stopMetronome();
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            const intervalMs = 60000 / bpm;

            metronomeInterval = setInterval(() => {
                playClick();
            }, intervalMs);
        }

        function stopMetronome() {
            if (metronomeInterval) {
                clearInterval(metronomeInterval);
                metronomeInterval = null;
            }
            if (audioCtx) {
                audioCtx.close();
                audioCtx = null;
            }
        }

        function updateBpm(bpm) {
            const slider = document.getElementById('bpmSlider');
            const bpmValue = document.getElementById('bpmValue');
            slider.value = bpm;
            bpmValue.textContent = bpm;

            if (metronomeInterval) {
                startMetronome(bpm);
            }
        }

        document.getElementById('bpmSlider').addEventListener('input', function () {
            document.getElementById('bpmValue').textContent = this.value;
            if (metronomeInterval) {
                startMetronome(Number(this.value));
            }
        });

        document.getElementById('startMetronome').addEventListener('click', function () {
            const bpm = Number(document.getElementById('bpmSlider').value);
            startMetronome(bpm);
        });

        document.getElementById('stopMetronome').addEventListener('click', function () {
            stopMetronome();
        });

        document.getElementById('tapTempo').addEventListener('click', function () {
            const now = Date.now();

            tapTimes.push(now);
            if (tapTimes.length > 5) tapTimes.shift();

            if (tapTimes.length >= 2) {
                let intervals = [];
                for (let i = 1; i < tapTimes.length; i++) {
                    intervals.push(tapTimes[i] - tapTimes[i - 1]);
                }

                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                let bpm = Math.round(60000 / avgInterval);

                if (bpm < 40) bpm = 40;
                if (bpm > 300) bpm = 300;

                updateBpm(bpm);
            }
        });

        // Modal playlists - fechar clicando fora
        window.onclick = function (event) {
            const modal = document.getElementById("modalPlaylists");
            if (event.target === modal) {
                document.getElementById("modalPlaylists").style.display = "none";
            }
        };
    </script>
</body>

</html>
