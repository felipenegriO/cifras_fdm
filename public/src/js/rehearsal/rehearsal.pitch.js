(function () {
    "use strict";

    function resolveSoundTouch() {
        const root = window;
        const SoundTouch = root.SoundTouch || (root.soundtouchjs && root.soundtouchjs.SoundTouch) || (root.soundtouch && root.soundtouch.SoundTouch);
        const SimpleFilter = root.SimpleFilter || (root.soundtouchjs && root.soundtouchjs.SimpleFilter) || (root.soundtouch && root.soundtouch.SimpleFilter);
        const BufferSource = root.BufferSource || (root.soundtouchjs && root.soundtouchjs.BufferSource) || (root.soundtouch && root.soundtouch.BufferSource);
        const getWebAudioNode = root.getWebAudioNode || (root.soundtouchjs && root.soundtouchjs.getWebAudioNode) || (root.soundtouch && root.soundtouch.getWebAudioNode);
        return { SoundTouch, SimpleFilter, BufferSource, getWebAudioNode };
    }

    function toPitchFactor(semitones) {
        return Math.pow(2, semitones / 12);
    }

    function createPitchPlayer(options) {
        const onTimeUpdate = options && options.onTimeUpdate ? options.onTimeUpdate : function () { };
        const onEnded = options && options.onEnded ? options.onEnded : function () { };
        const onStatus = options && options.onStatus ? options.onStatus : function () { };

        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        let buffer = null;
        let pitchSemitones = 0;
        let playing = false;
        let currentTime = 0;
        let node = null;
        let source = null;
        let nativeSource = null;
        let rafId = null;
        let playbackStartTime = 0;
        let usingSoundTouch = false;

        function cleanupNode() {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            if (node) {
                try {
                    node.disconnect();
                } catch (err) {
                    // ignore
                }
                node = null;
            }
            if (nativeSource) {
                try {
                    nativeSource.onended = null;
                    nativeSource.stop(0);
                } catch (err) {
                    // ignore
                }
                nativeSource = null;
            }
            source = null;
        }

        function updateTimeLoop() {
            if (!playing || !buffer) return;
            if (usingSoundTouch && source && typeof source.position === "number") {
                currentTime = Math.min(buffer.duration, source.position / buffer.sampleRate);
            } else {
                const elapsed = ctx.currentTime - playbackStartTime;
                const rate = usingSoundTouch ? 1 : toPitchFactor(pitchSemitones);
                currentTime = Math.min(buffer.duration, currentTime + elapsed * rate);
            }

            onTimeUpdate(currentTime);
            if (currentTime >= buffer.duration - 0.01) {
                stopInternal(true);
                onEnded();
                return;
            }
            rafId = requestAnimationFrame(updateTimeLoop);
        }

        function buildSoundTouchNode(startSeconds) {
            const stLib = resolveSoundTouch();
            if (!stLib.SoundTouch || !stLib.SimpleFilter || !stLib.BufferSource || !stLib.getWebAudioNode) {
                return null;
            }

            const soundTouch = new stLib.SoundTouch(buffer.sampleRate);
            soundTouch.pitch = toPitchFactor(pitchSemitones);

            const soundSource = new stLib.BufferSource(buffer);
            soundSource.position = Math.max(0, Math.floor(startSeconds * buffer.sampleRate));

            const filter = new stLib.SimpleFilter(soundSource, soundTouch);
            const processor = stLib.getWebAudioNode(ctx, filter);
            if (!processor) return null;

            usingSoundTouch = true;
            source = soundSource;
            return processor;
        }

        function buildFallbackNode(startSeconds) {
            usingSoundTouch = false;
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.playbackRate.value = toPitchFactor(pitchSemitones);
            nativeSource = src;
            src.onended = function () {
                if (!playing) return;
                stopInternal(true);
                onEnded();
            };
            src.start(0, startSeconds);
            return src;
        }

        function startFrom(seconds) {
            if (!buffer) return;
            cleanupNode();

            const startSeconds = Math.max(0, Math.min(buffer.duration, seconds));
            currentTime = startSeconds;
            playbackStartTime = ctx.currentTime;

            node = buildSoundTouchNode(startSeconds);
            if (!node) {
                onStatus("Pitch advanced disabled (SoundTouch not available). Using fallback audio.");
                node = buildFallbackNode(startSeconds);
            }

            node.connect(ctx.destination);
            playing = true;
            rafId = requestAnimationFrame(updateTimeLoop);
        }

        function stopInternal(keepPosition) {
            if (!playing) return;
            playing = false;
            if (!keepPosition) {
                currentTime = 0;
            }
            cleanupNode();
        }

        async function loadFile(fileOrBlob) {
            const arrayBuffer = await fileOrBlob.arrayBuffer();
            buffer = await ctx.decodeAudioData(arrayBuffer);
            currentTime = 0;
            onStatus("Audio loaded. Ready to play.");
            return buffer;
        }

        function play() {
            if (!buffer) return;
            if (playing) return;
            startFrom(currentTime);
        }

        function pause() {
            if (!playing) return;
            if (usingSoundTouch && source && typeof source.position === "number") {
                currentTime = Math.min(buffer.duration, source.position / buffer.sampleRate);
            }
            stopInternal(true);
        }

        function toggle() {
            if (playing) {
                pause();
            } else {
                play();
            }
        }

        function seek(seconds) {
            if (!buffer) return;
            const next = Math.max(0, Math.min(buffer.duration, seconds));
            currentTime = next;
            if (playing) {
                startFrom(next);
            } else {
                onTimeUpdate(currentTime);
            }
        }

        function setPitchSemitones(nextSemitones) {
            pitchSemitones = Math.max(-12, Math.min(12, Number(nextSemitones) || 0));
            if (playing) {
                startFrom(currentTime);
            }
        }

        function getPitchSemitones() {
            return pitchSemitones;
        }

        function getCurrentTime() {
            return currentTime;
        }

        function getDuration() {
            return buffer ? buffer.duration : 0;
        }

        function isPlaying() {
            return playing;
        }

        return {
            loadFile,
            play,
            pause,
            toggle,
            seek,
            setPitchSemitones,
            getPitchSemitones,
            getCurrentTime,
            getDuration,
            isPlaying
        };
    }

    window.Rehearsal = window.Rehearsal || {};
    window.Rehearsal.pitch = {
        createPitchPlayer
    };
})();
