(function () {
    "use strict";

    // IIFE is executing
    window.bootstrapEntered = true;

    async function bootstrap() {
        const params = new URLSearchParams(window.location.search);
        const musicId = params.get("id");

        if (!musicId) {
            return;
        }

        const stateModule = window.Rehearsal && window.Rehearsal.state;
        const youtubeModule = window.Rehearsal && window.Rehearsal.youtube;
        const pitchModule = window.Rehearsal && window.Rehearsal.pitch;
        const audioModule = window.Rehearsal && window.Rehearsal.audio;
        const uiModule = window.Rehearsal && window.Rehearsal.ui;

        if (!stateModule || !youtubeModule || !pitchModule || !audioModule || !uiModule) {
            return;
        }

        let state = stateModule.loadState(musicId);
        let waveform = null;
        let player = null;
        let statusInterval = null;
        let autoSaveInterval = null;

        function saveCurrentState() {
            stateModule.saveState(musicId, state);
        }

        function updateRegionFromAB() {
            if (!waveform || !waveform.wavesurfer) return;
            if (state.region.A !== null && state.region.B !== null) {
                const start = Math.min(state.region.A, state.region.B);
                const end = Math.max(state.region.A, state.region.B);
                waveform.setRegion(start, end);
            }
        }

        function handleToggle(isActive) {
            if (!isActive) {
                saveCurrentState();
            }
        }

        function handleOpenYoutube() {
            const title = document.getElementById("song-title");
            const defaultTitle = title ? title.textContent : "song";
            const searchUrl = youtubeModule.buildSearchUrl(defaultTitle);
            window.open(searchUrl, "_blank");
        }

        async function handleBindYoutube(youtubeUrl) {
            if (!youtubeUrl) {
                uiModule.showMessage("Enter a YouTube URL or video ID", "error");
                return;
            }

            const videoId = youtubeModule.extractYoutubeVideoId(youtubeUrl);
            if (!videoId) {
                uiModule.showMessage("Invalid YouTube URL or video ID", "error");
                return;
            }

            uiModule.showMessage("Fetching metadata...", "");
            const meta = await youtubeModule.fetchYoutubeMeta(videoId);
            if (!meta) {
                uiModule.showMessage("Could not fetch video info", "error");
                return;
            }

            state.youtubeVideoId = videoId;
            state.youtubeUrl = youtubeUrl;
            state.youtubeTitle = meta.title || "";

            uiModule.setYoutubePreview({
                thumbUrl: meta.thumbnailUrl || youtubeModule.getThumbnailUrl(videoId),
                title: meta.title
            });

            saveCurrentState();

            uiModule.showMessage("Converting audio (this may take 30-60s)...", "");
            try {
                const response = await fetch("/src/backend/download-yt-audio.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ videoId: videoId })
                });
                
                const result = await response.json();
                
                if (result.error) {
                    // Show helpful fallback message with alternative link
                    const fallbackConverterUrl = "https://y2mate.com/";
                    const youtubeSearchUrl = "https://www.youtube.com/watch?v=" + videoId;
                    uiModule.showMessage(
                        "Conversão automática indisponível. Clique aqui para converter manualmente: " + fallbackConverterUrl,
                        "error"
                    );
                    return;
                }

                const audioPath = result.audioPath;
                const audioBlob = await fetch(audioPath).then(r => r.blob());

                if (player) {
                    await player.loadFile(audioBlob);
                }

                state.audioFileName = result.fileName || "audio.mp3";
                saveCurrentState();

                uiModule.setAudioFileName(state.audioFileName);
                uiModule.showMessage("Audio loaded! Ready to play.", "success");
            } catch (err) {
                console.error("[rehearsal] Download error:", err);
                uiModule.showMessage("Failed to download audio: " + (err.message || "Unknown error"), "error");
            }
        }

        async function handleAudioFile(file) {
            if (!file) return;

            try {
                if (!player) {
                    player = pitchModule.createPitchPlayer({
                        onTimeUpdate: function (time) {
                            if (waveform && waveform.wavesurfer) {
                                waveform.wavesurfer.setTime(time);
                            }
                            updateAutoSave();
                        },
                        onEnded: function () {
                            updateUIFromState();
                        },
                        onStatus: function (msg) {
                            // Status callback - silent
                        }
                    });
                }

                await player.loadFile(file);
                state.audioFileName = file.name || "uploaded";
                saveCurrentState();

                uiModule.setAudioFileName(state.audioFileName);
                uiModule.showMessage("Audio loaded!", "success");
                uiModule.setPlaybackControlsEnabled(true);

                if (waveform) {
                    updateRegionFromAB();
                }
            } catch (err) {
                console.error("[rehearsal] Audio load error:", err);
                uiModule.showMessage("Failed to load audio", "error");
            }
        }

        function handleStart() {
            if (!player) return;
            player.seek(0);
        }

        function handleBack1() {
            if (!player) return;
            const t = Math.max(0, player.getCurrentTime() - 1);
            player.seek(t);
        }

        function handlePlayPause() {
            if (!player) return;
            player.toggle();
            updateUIFromState();
        }

        function handleForward1() {
            if (!player) return;
            const t = Math.min(player.getDuration(), player.getCurrentTime() + 1);
            player.seek(t);
        }

        function handleToggleLoop() {
            state.loopEnabled = !state.loopEnabled;
            uiModule.setLoopActive(state.loopEnabled);
            saveCurrentState();
        }

        function handleSetA() {
            if (!player) return;
            state.region.A = player.getCurrentTime();
            if (state.region.B !== null && state.region.B > state.region.A) {
                updateRegionFromAB();
            }
            saveCurrentState();
        }

        function handleSetB() {
            if (!player) return;
            state.region.B = player.getCurrentTime();
            if (state.region.A !== null && state.region.B > state.region.A) {
                updateRegionFromAB();
            }
            saveCurrentState();
        }

        function handleClearAB() {
            state.region = { A: null, B: null };
            if (waveform) {
                waveform.clearRegion();
            }
            saveCurrentState();
        }

        function getPlayer() {
            return player || window.mockPlayer;
        }

        function handlePitchDown() {
            const p = getPlayer();
            if (!p) {
                return;
            }
            const next = p.getPitchSemitones() - 1;
            p.setPitchSemitones(next);
            const actual = p.getPitchSemitones();
            state.pitchSemitones = actual;
            uiModule.setPitchLabel(actual);
            saveCurrentState();
        }

        function handlePitchUp() {
            const p = getPlayer();
            if (!p) {
                return;
            }
            const next = p.getPitchSemitones() + 1;
            p.setPitchSemitones(next);
            const actual = p.getPitchSemitones();
            state.pitchSemitones = actual;
            uiModule.setPitchLabel(actual);
            saveCurrentState();
        }

        function handlePitchReset() {
            const p = getPlayer();
            if (!p) {
                return;
            }
            p.setPitchSemitones(0);
            const actual = p.getPitchSemitones();
            state.pitchSemitones = actual;
            uiModule.setPitchLabel(actual);
            saveCurrentState();
        }

        function updateUIFromState() {
            if (player) {
                uiModule.setPlayState(player.isPlaying());
            }
            uiModule.setLoopActive(state.loopEnabled);
            uiModule.setPitchLabel(state.pitchSemitones);
            uiModule.setYoutubePreview({
                thumbUrl: youtubeModule.getThumbnailUrl(state.youtubeVideoId),
                title: state.youtubeTitle
            });
            uiModule.setAudioFileName(state.audioFileName);
        }

        function updateAutoSave() {
            if (!player) return;
            state.lastPositionSeconds = player.getCurrentTime();
        }

        const handlers = {
            onToggle: handleToggle,
            onOpenYoutube: handleOpenYoutube,
            onBindYoutube: handleBindYoutube,
            onAudioFile: handleAudioFile,
            onStart: handleStart,
            onBack1: handleBack1,
            onPlayPause: handlePlayPause,
            onForward1: handleForward1,
            onToggleLoop: handleToggleLoop,
            onSetA: handleSetA,
            onSetB: handleSetB,
            onClearAB: handleClearAB,
            onPitchDown: handlePitchDown,
            onPitchUp: handlePitchUp,
            onPitchReset: handlePitchReset
        };

        const uiElements = uiModule.initUI(handlers);
        if (!uiElements || !uiElements.panel) {
            return;
        }

        const waveformContainer = document.getElementById("waveform");
        if (waveformContainer) {
            waveform = audioModule.createWaveform({
                container: waveformContainer,
                onSeek: function (seconds) {
                    if (player) {
                        player.seek(seconds);
                    }
                },
                onRegionChange: function (start, end) {
                    state.region = { A: start, B: end };
                    saveCurrentState();
                }
            });
        }

        uiModule.setPlaybackControlsEnabled(false);
        updateUIFromState();

        autoSaveInterval = setInterval(function () {
            const currentTime = player ? player.getCurrentTime() : 0;
            if (Math.abs(currentTime - state.lastPositionSeconds) > 0.1) {
                state.lastPositionSeconds = currentTime;
                saveCurrentState();
            }
        }, 2000);

        window.addEventListener("beforeunload", saveCurrentState);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            try {
                bootstrap();
            } catch (error) {
                console.error("[rehearsal.bootstrap] Error in bootstrap:", error);
            }
        });
    } else {
        try {
            bootstrap();
        } catch (error) {
            console.error("[rehearsal.bootstrap] Error in bootstrap:", error);
        }
    }
})();
