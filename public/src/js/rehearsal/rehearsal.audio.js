(function () {
    "use strict";

    function createWaveform(options) {
        const container = options.container;
        const onSeek = options.onSeek;
        const onRegionChange = options.onRegionChange;
        const onStatus = options.onStatus || function () { };

        if (!window.WaveSurfer) {
            onStatus("WaveSurfer not available.");
            return null;
        }

        const ws = window.WaveSurfer.create({
            container: container,
            height: 96,
            normalize: true,
            barWidth: 2,
            barGap: 2,
            cursorColor: "#ffffff",
            waveColor: "#2d2d2d",
            progressColor: "#00c27a",
            interact: true
        });

        let regionsPlugin = null;
        if (window.WaveSurfer.Regions && typeof window.WaveSurfer.Regions.create === "function") {
            regionsPlugin = ws.registerPlugin(window.WaveSurfer.Regions.create({
                dragSelection: true,
                dragSelectionColor: "rgba(0, 194, 122, 0.2)"
            }));
        } else {
            onStatus("Regions plugin not available. A/B buttons still work.");
        }

        ws.on("interaction", function () {
            if (typeof onSeek === "function") {
                onSeek(ws.getCurrentTime());
            }
        });

        ws.on("region-created", function (region) {
            if (!region || region.id !== "loop-region") return;
            if (typeof onRegionChange === "function") {
                onRegionChange(region.start, region.end);
            }
        });

        ws.on("region-updated", function (region) {
            if (!region || region.id !== "loop-region") return;
            if (typeof onRegionChange === "function") {
                onRegionChange(region.start, region.end);
            }
        });

        function loadBlob(fileOrBlob) {
            return ws.loadBlob(fileOrBlob);
        }

        function setRegion(start, end) {
            if (!regionsPlugin || !ws) return;
            const safeStart = Math.max(0, start);
            const safeEnd = Math.max(safeStart, end);
            let region = ws.getRegion && ws.getRegion("loop-region");
            if (region) {
                region.setOptions({ start: safeStart, end: safeEnd });
            } else if (regionsPlugin.addRegion) {
                regionsPlugin.addRegion({
                    id: "loop-region",
                    start: safeStart,
                    end: safeEnd,
                    color: "rgba(0, 194, 122, 0.25)",
                    drag: true,
                    resize: true
                });
            }
        }

        function clearRegion() {
            if (!ws) return;
            if (ws.clearRegions) {
                ws.clearRegions();
            } else if (ws.getRegion) {
                const region = ws.getRegion("loop-region");
                if (region) region.remove();
            }
        }

        function setTime(seconds) {
            if (!ws || !ws.getDuration) return;
            const duration = ws.getDuration();
            if (!duration || duration <= 0) return;
            const ratio = Math.max(0, Math.min(1, seconds / duration));
            if (typeof ws.setTime === "function") {
                ws.setTime(seconds);
            } else {
                ws.seekTo(ratio);
            }
        }

        function getDuration() {
            return ws.getDuration ? ws.getDuration() : 0;
        }

        function isReady() {
            return ws.isReady ? ws.isReady : Boolean(getDuration());
        }

        return {
            wavesurfer: ws,
            loadBlob,
            setRegion,
            clearRegion,
            setTime,
            getDuration,
            isReady
        };
    }

    window.Rehearsal = window.Rehearsal || {};
    window.Rehearsal.audio = {
        createWaveform
    };
})();
