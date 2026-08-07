(function (root) {
  const STORAGE_PREFIX = 'cifroYoutubePanel:';
  const VALID_STATES = ['open', 'minimized', 'hidden'];

  function storageKey(musicaId) {
    return STORAGE_PREFIX + String(musicaId);
  }

  function parseStored(raw) {
    if (!raw) return null;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.videoId !== 'string' || parsed.videoId === '') return null;
    if (typeof parsed.state !== 'string' || !VALID_STATES.includes(parsed.state)) return null;
    return {
      videoId: parsed.videoId,
      title: typeof parsed.title === 'string' ? parsed.title : '',
      state: parsed.state
    };
  }

  function serialize(entry) {
    return JSON.stringify({
      videoId: entry.videoId,
      title: typeof entry.title === 'string' ? entry.title : '',
      state: entry.state
    });
  }

  root.CifroYoutubePanelState = {
    VALID_STATES: VALID_STATES.slice(),
    storageKey,
    parseStored,
    serialize
  };
})(typeof window !== 'undefined' ? window : globalThis);
