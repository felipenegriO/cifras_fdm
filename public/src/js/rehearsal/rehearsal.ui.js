(function () {
    "use strict";

    function qs(id) {
        return document.getElementById(id);
    }

    function initUI(handlers) {
        const btnToggle = qs("btnAtivarEnsaio");
        const panel = qs("modo-ensaio");
        const btnOpenYoutube = qs("btnAbrirYoutube");
        const inputYoutubeUrl = qs("inputYoutubeUrl");
        const btnBindYoutube = qs("btnVincularYoutube");
        const inputAudio = qs("inputAudio");

        const controls = {
            btnInicio: qs("btnInicio"),
            btnMinus1: qs("btnMinus1"),
            btnPlayPause: qs("btnPlayPause"),
            btnPlus1: qs("btnPlus1"),
            btnLoop: qs("btnLoop"),
            btnSetA: qs("btnSetA"),
            btnSetB: qs("btnSetB"),
            btnClearAB: qs("btnClearAB"),
            btnPitchDown: qs("btnPitchDown"),
            btnPitchUp: qs("btnPitchUp"),
            btnPitchReset: qs("btnPitchReset")
        };

        if (btnToggle && panel) {
            // Check if already bound by music.php (execute earlier)
            if (!btnToggle.dataset.ensaioListenerAdded) {
                // Mark that we've added a listener
                btnToggle.dataset.ensaioListenerAdded = 'true';
                btnToggle.addEventListener("click", function () {
                    const isActive = panel.classList.toggle("is-active");
                    panel.setAttribute("aria-hidden", String(!isActive));
                    btnToggle.classList.toggle("active", isActive);
                    if (handlers && handlers.onToggle) {
                        handlers.onToggle(isActive);
                    }
                });
            }
        }

        if (btnOpenYoutube && handlers && handlers.onOpenYoutube) {
            btnOpenYoutube.addEventListener("click", handlers.onOpenYoutube);
        }

        if (btnBindYoutube && handlers && handlers.onBindYoutube) {
            btnBindYoutube.addEventListener("click", function () {
                handlers.onBindYoutube(inputYoutubeUrl ? inputYoutubeUrl.value : "");
            });
        }

        if (inputAudio && handlers && handlers.onAudioFile) {
            inputAudio.addEventListener("change", function (event) {
                const file = event.target.files && event.target.files[0];
                handlers.onAudioFile(file || null);
            });
        }

        function bindControl(id, handler) {
            const btn = controls[id];
            if (btn && handler) {
                btn.addEventListener("click", handler);
            }
        }

        bindControl("btnInicio", handlers && handlers.onStart);
        bindControl("btnMinus1", handlers && handlers.onBack1);
        bindControl("btnPlayPause", handlers && handlers.onPlayPause);
        bindControl("btnPlus1", handlers && handlers.onForward1);
        bindControl("btnLoop", handlers && handlers.onToggleLoop);
        bindControl("btnSetA", handlers && handlers.onSetA);
        bindControl("btnSetB", handlers && handlers.onSetB);
        bindControl("btnClearAB", handlers && handlers.onClearAB);
        bindControl("btnPitchDown", handlers && handlers.onPitchDown);
        bindControl("btnPitchUp", handlers && handlers.onPitchUp);
        bindControl("btnPitchReset", handlers && handlers.onPitchReset);

        return {
            panel,
            inputYoutubeUrl,
            inputAudio,
            controls
        };
    }

    function setLoopActive(isActive) {
        const btnLoop = qs("btnLoop");
        if (!btnLoop) return;
        btnLoop.classList.toggle("is-active", Boolean(isActive));
    }

    function setPlayState(isPlaying) {
        const btn = qs("btnPlayPause");
        if (!btn) return;
        btn.textContent = isPlaying ? "Pause" : "Play";
        btn.classList.toggle("is-active", Boolean(isPlaying));
    }

    function setPitchLabel(semitones) {
        const label = qs("pitchLabel");
        if (!label) return;
        const value = Number(semitones) || 0;
        const prefix = value > 0 ? "+" : "";
        label.textContent = prefix + value + " semitons";
    }

    function setYoutubePreview(meta) {
        const thumb = qs("ytThumb");
        const title = qs("ytTitle");
        if (thumb && meta && meta.thumbUrl) {
            thumb.src = meta.thumbUrl;
            thumb.alt = meta.title || "YouTube";
            thumb.classList.toggle("is-visible", true);
        }
        if (title && meta) {
            title.textContent = meta.title || "";
        }
    }

    function setAudioFileName(name) {
        const el = qs("audioFileName");
        if (!el) return;
        el.textContent = name ? "Arquivo: " + name : "";
    }

    function showMessage(text, type) {
        const el = qs("rehearsalMessage");
        if (!el) return;
        el.textContent = text || "";
        el.classList.toggle("is-error", type === "error");
        el.classList.toggle("is-success", type === "success");
    }

    function setControlsEnabled(enabled) {
        const controlIds = [
            "btnInicio",
            "btnMinus1",
            "btnPlayPause",
            "btnPlus1",
            "btnLoop",
            "btnSetA",
            "btnSetB",
            "btnClearAB",
            "btnPitchDown",
            "btnPitchUp",
            "btnPitchReset"
        ];
        controlIds.forEach(function (id) {
            const btn = qs(id);
            if (btn) btn.disabled = !enabled;
        });
    }

    function setPlaybackControlsEnabled(enabled) {
        // Only disable playback controls, leave YouTube controls enabled
        const playbackControlIds = [
            "btnInicio",
            "btnMinus1",
            "btnPlayPause",
            "btnPlus1",
            "btnLoop",
            "btnSetA",
            "btnSetB",
            "btnClearAB",
            "btnPitchDown",
            "btnPitchUp",
            "btnPitchReset"
        ];
        playbackControlIds.forEach(function (id) {
            const btn = qs(id);
            if (btn) btn.disabled = !enabled;
        });
    }

    window.Rehearsal = window.Rehearsal || {};
    window.Rehearsal.ui = {
        initUI,
        setLoopActive,
        setPlayState,
        setPitchLabel,
        setYoutubePreview,
        setAudioFileName,
        showMessage,
        setControlsEnabled,
        setPlaybackControlsEnabled
    };
})();
