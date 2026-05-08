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

function addListItem(content, idLista, musicasArray) {
  var list = document.getElementById(idLista);
  var newItem = document.createElement('li');
  newItem.className = "liPlaylist";
  var newItemA = document.createElement('a');
  newItemA.textContent = content;
  newItem.appendChild(newItemA);

  var ul = document.createElement('ul');
  ul.className ="sub-list";
  ul.style= "overflow: auto;    height: 100%;    border: none;    height: 50vh;";
  
  musicasArray.forEach(element => {
    var musica = document.createElement('li');
    var musicaA = document.createElement('a');
    musicaA.className = "liPlaylist-musica";

    musicaA.href = "music.php?id="+element;
    const filteredSongs = songs.filter(song => song.id == element);
    musicaA.textContent = filteredSongs[0]?.nome || "Música " + element;
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
      addSectionTitle('Playlists', 'lista-playlists');
      playlistsVisiveis.forEach(function(playlist) {
        addListItem(playlist.nome, "lista-playlists", playlist.itens);
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