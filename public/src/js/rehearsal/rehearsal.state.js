(function () {
    "use strict";

    const DEFAULT_STATE = {
        youtubeVideoId: "",
        youtubeUrl: "",
        youtubeTitle: "",
        audioFileName: "",
        pitchSemitones: 0,
        loopEnabled: false,
        region: { A: null, B: null },
        lastPositionSeconds: 0
    };

    function clampNumber(value, min, max, fallback) {
        if (typeof value !== "number" || Number.isNaN(value)) return fallback;
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    function normalizeState(raw) {
        const state = Object.assign({}, DEFAULT_STATE, raw || {});
        state.youtubeVideoId = typeof state.youtubeVideoId === "string" ? state.youtubeVideoId : "";
        state.youtubeUrl = typeof state.youtubeUrl === "string" ? state.youtubeUrl : "";
        state.youtubeTitle = typeof state.youtubeTitle === "string" ? state.youtubeTitle : "";
        state.audioFileName = typeof state.audioFileName === "string" ? state.audioFileName : "";
        state.pitchSemitones = clampNumber(state.pitchSemitones, -12, 12, 0);
        state.loopEnabled = Boolean(state.loopEnabled);
        state.lastPositionSeconds = clampNumber(state.lastPositionSeconds, 0, Number.MAX_SAFE_INTEGER, 0);

        const region = state.region || {};
        const regionA = clampNumber(region.A, 0, Number.MAX_SAFE_INTEGER, null);
        const regionB = clampNumber(region.B, 0, Number.MAX_SAFE_INTEGER, null);
        state.region = { A: regionA, B: regionB };
        return state;
    }

    function getStorageKey(musicId) {
        return "rehearsal:" + String(musicId || "unknown");
    }

    function loadState(musicId) {
        const key = getStorageKey(musicId);
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return normalizeState(null);
            return normalizeState(JSON.parse(raw));
        } catch (err) {
            return normalizeState(null);
        }
    }

    function saveState(musicId, state) {
        const key = getStorageKey(musicId);
        try {
            const payload = JSON.stringify(normalizeState(state));
            localStorage.setItem(key, payload);
        } catch (err) {
            // Silent fail - localStorage may be full or disabled
        }
    }

    window.Rehearsal = window.Rehearsal || {};
    window.Rehearsal.state = {
        DEFAULT_STATE,
        loadState,
        saveState,
        normalizeState
    };
})();
