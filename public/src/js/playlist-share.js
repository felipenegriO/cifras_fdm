(function () {
  function itemId(item) {
    return typeof item === 'object' && item !== null ? item.id : item;
  }

  function itemTom(item, song) {
    var selected = typeof item === 'object' && item !== null ? (item.tom || '') : '';
    var chords = window.CifroChords;
    var normalized = chords ? chords.normalizeKey(selected) : selected;
    var detected = song && chords ? (chords.normalizeKey(song.tom) || chords.identifyKey(song.cifra)?.key || '') : '';
    if (normalized && detected) {
      return chords.tonicOf(normalized) + (chords.modeOf(detected) === 'minor' ? 'm' : '');
    }
    return normalized || detected || 'Tom não definido';
  }

  function format(playlist, songs) {
    var musicas = Array.isArray(songs) ? songs : [];
    var linhas = (playlist.itens || []).map(function (item, index) {
      var id = itemId(item);
      var song = musicas.find(function (candidate) { return String(candidate.id) === String(id); });
      var nome = song?.nome || ('Música ' + id);
      return (index + 1) + '. ' + nome + '\n   🎼 Tom: *' + itemTom(item, song) + '*';
    });
    return [
      '🎶 REPERTÓRIO',
      '*' + (playlist.nome || 'Sem nome') + '*',
      '',
      '📋 *Músicas na ordem:*',
      '',
      linhas.length ? linhas.join('\n\n') : '_Nenhuma música adicionada._',
      '',
      '🎸 Compartilhado pelo Cifrô',
      window.location.origin + (window.APP_BASE || '') + '/landing.php'
    ].join('\n');
  }

  function isMobile() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
      return navigator.userAgentData.mobile;
    }
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }

  async function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }

  async function share(playlist, songs) {
    var text = format(playlist, songs);
    if (isMobile() && navigator.share) {
      try {
        await navigator.share({ title: playlist.nome || 'Repertório', text: text });
        return 'shared';
      } catch (error) {
        if (error && error.name === 'AbortError') return 'cancelled';
        throw error;
      }
    }
    await copy(text);
    return 'copied';
  }

  window.CifroPlaylistShare = { format: format, share: share };
})();
