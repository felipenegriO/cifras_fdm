function addSectionTitle(title, idLista) {
  var list = document.getElementById(idLista);
  var li = document.createElement('li');
  li.className = 'playlist-section-title';
  li.textContent = title;
  list.appendChild(li);
}

function addRoteiroItem(roteiro, idLista) {
  var list = document.getElementById(idLista);
  var li = document.createElement('li');
  li.className = 'liRoteiro';
  var a = document.createElement('a');
  a.textContent = roteiro.titulo || 'Roteiro';
  a.href = 'roteiro.php?id=' + roteiro.id;
  li.appendChild(a);
  list.appendChild(li);
}

function isRoteiroVisibleMenu(roteiro) {
  if (!roteiro || !roteiro.visivel_ate) return true;
  const parts = String(roteiro.visivel_ate).split('-');
  if (parts.length !== 3) return true;
  const date = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() >= Date.now();
}

function isPlaylistVisibleMenu(playlist) {
  if (!playlist || !playlist.visivel_ate) return true;
  const parts = String(playlist.visivel_ate).split('-');
  if (parts.length !== 3) return true;
  const date = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() >= Date.now();
}

function getPlaylistItemId(item) {
  return typeof item === 'object' && item !== null ? item.id : item;
}

function getPlaylistItemTom(item, song) {
  var selected = typeof item === 'object' && item !== null ? (item.tom || '') : '';
  var normalized = window.CifroChords ? window.CifroChords.normalizeKey(selected) : selected;
  var detected = song && window.CifroChords ? window.CifroChords.identifyKey(song.cifra)?.key || '' : '';
  if (normalized && detected) {
    return window.CifroChords.tonicOf(normalized) + (window.CifroChords.modeOf(detected) === 'minor' ? 'm' : '');
  }
  if (normalized) return normalized;
  if (detected) return detected;
  return '';
}

function addListItem(content, idLista, musicasArray) {
  var list = document.getElementById(idLista);
  var newItem = document.createElement('li');
  newItem.className = 'liPlaylist';
  var newItemA = document.createElement('a');
  newItemA.textContent = content;
  newItem.appendChild(newItemA);

  var ul = document.createElement('ul');
  ul.className = 'sub-list';
  ul.style = 'overflow: auto; height: 100%; border: none; height: 50vh;';

  var shareItem = document.createElement('li');
  shareItem.className = 'playlist-share-item';
  var shareButton = document.createElement('button');
  shareButton.type = 'button';
  shareButton.className = 'playlist-share-button';
  shareButton.textContent = 'Compartilhar repertório';
  shareButton.addEventListener('click', async function (event) {
    event.preventDefault();
    event.stopPropagation();
    try {
      var result = await window.CifroPlaylistShare.share({ nome: content, itens: musicasArray }, typeof songs !== 'undefined' ? songs : []);
      if (result === 'copied' && window.cifroToast) cifroToast('Repertório copiado para a área de transferência.', 'success');
    } catch (error) {
      if (window.cifroToast) cifroToast('Não foi possível compartilhar o repertório.', 'error');
    }
  });
  shareItem.appendChild(shareButton);
  ul.appendChild(shareItem);

  // Serializa a setlist completa para uso no modo apresentação
  var setlistItems = musicasArray.map(function (item) {
    var id = getPlaylistItemId(item);
    var song = (typeof songs !== 'undefined' ? songs : []).find(function (s) { return s.id == id; });
    var tom = getPlaylistItemTom(item, song);
    return {
      id: id,
      tom: tom || '',
      nome: (song && song.nome) || ('Música ' + id)
    };
  });

  musicasArray.forEach(function (item, index) {
    var element = getPlaylistItemId(item);
    var song = (typeof songs !== 'undefined' ? songs : []).find(function (s) { return s.id == element; });
    var tom = getPlaylistItemTom(item, song);
    var musica = document.createElement('li');
    var musicaA = document.createElement('a');
    musicaA.className = 'liPlaylist-musica';

    var params = new URLSearchParams();
    params.set('id', element);
    if (tom) {
      params.set('playlistTom', tom);
    }
    musicaA.href = 'music.php?' + params.toString();

    musicaA.addEventListener('click', function () {
      try {
        sessionStorage.setItem('cifroSetlist', JSON.stringify({
          name: content,
          items: setlistItems,
          currentIndex: index
        }));
      } catch (e) { /* ignora */ }
    });

    musicaA.textContent = song?.nome || 'Musica ' + element;
    if (tom) {
      musicaA.textContent += ' [' + tom + ']';
    }

    musica.appendChild(musicaA);
    ul.appendChild(musica);
  });

  newItem.appendChild(ul);
  list.appendChild(newItem);
}

function toggleSubList(event) {
  var subList = $(event.target).siblings('.sub-list');
  if (subList.length > 0) {
      subList.css('display', subList.css('display') === 'none' ? 'block' : 'none');
      $(event.target).toggleClass('active');
  }
}

function renderPlaylistsMenu() {
  var list = document.getElementById('lista-playlists');
  if (!list) return;
  list.innerHTML = '';

  if (typeof roteirosSalvos !== 'undefined' && Array.isArray(roteirosSalvos)) {
    const roteirosVisiveis = roteirosSalvos.filter(isRoteiroVisibleMenu);
    if (roteirosVisiveis.length > 0) {
      addSectionTitle('Roteiros', 'lista-playlists');
      roteirosVisiveis.forEach(function(roteiro) {
        addRoteiroItem(roteiro, 'lista-playlists');
      });
    }
  }

  if (typeof playlistsSalvas !== 'undefined') {
    const playlistsVisiveis = playlistsSalvas.filter(isPlaylistVisibleMenu);
    if (playlistsVisiveis.length > 0) {
      addSectionTitle('Repertórios', 'lista-playlists');
      playlistsVisiveis.forEach(function(playlist) {
        addListItem(playlist.nome, 'lista-playlists', playlist.itens);
      });

      document.querySelectorAll('.liPlaylist').forEach(function(item) {
        item.addEventListener('click', toggleSubList);
      });
    }
  }
}

window.renderPlaylistsMenu = renderPlaylistsMenu;

$(document).ready(async function() {
  renderPlaylistsMenu();
});
