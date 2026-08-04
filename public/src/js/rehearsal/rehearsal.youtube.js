(function () {
    "use strict";

    function extractYoutubeVideoId(input) {
        if (!input) return null;
        const trimmed = String(input).trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
            return trimmed;
        }

        let url;
        try {
            url = new URL(trimmed);
        } catch (err) {
            return null;
        }

        const host = url.hostname.replace(/^www\./, "");
        if (host === "youtu.be") {
            const id = url.pathname.split("/").filter(Boolean)[0];
            return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
        }

        if (host.endsWith("youtube.com")) {
            const pathname = url.pathname || "";
            if (pathname.startsWith("/watch")) {
                const id = url.searchParams.get("v");
                return /^[a-zA-Z0-9_-]{11}$/.test(id || "") ? id : null;
            }
            if (pathname.startsWith("/shorts/")) {
                const id = pathname.split("/").filter(Boolean)[1];
                return /^[a-zA-Z0-9_-]{11}$/.test(id || "") ? id : null;
            }
            if (pathname.startsWith("/embed/")) {
                const id = pathname.split("/").filter(Boolean)[1];
                return /^[a-zA-Z0-9_-]{11}$/.test(id || "") ? id : null;
            }
        }

        return null;
    }

    function buildSearchUrl(title) {
        const query = encodeURIComponent(String(title || "").trim());
        return "https://www.youtube.com/results?search_query=" + query;
    }

    function getThumbnailUrl(videoId) {
        if (!videoId) return "";
        return "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg";
    }

    async function fetchYoutubeMeta(videoId) {
        if (!videoId) return null;
        const oembedUrl = "https://www.youtube.com/oembed?format=json&url=" +
            encodeURIComponent("https://www.youtube.com/watch?v=" + videoId);
        try {
            const resp = await fetch(oembedUrl, { method: "GET" });
            if (!resp.ok) return null;
            const data = await resp.json();
            return {
                title: data.title || "",
                thumbnailUrl: data.thumbnail_url || getThumbnailUrl(videoId)
            };
        } catch (err) {
            return null;
        }
    }

    window.Rehearsal = window.Rehearsal || {};
    window.Rehearsal.youtube = {
        extractYoutubeVideoId,
        buildSearchUrl,
        getThumbnailUrl,
        fetchYoutubeMeta
    };
})();
