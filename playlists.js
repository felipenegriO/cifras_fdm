
function ObterPlaysLists(){
    return  JSON.parse(sessionStorage.getItem('playsLists')) || [];
}
function AddNovaPlaysList(playlist){
    var playsLists =  JSON.parse(sessionStorage.getItem('playsLists')) || [];
    playsLists.push(playlist);
    sessionStorage.setItem('playsLists', JSON.stringify(playsLists));
}

function ObterMusicasPlaysList(playlist){
    return JSON.parse(sessionStorage.getItem(playlist)) || [];
}
function AddNovaMusicaPlaysList(playlist,idMusica){
    var musicas =  JSON.parse(sessionStorage.getItem(playlist)) || [];
    musicas.push(idMusica);
    sessionStorage.setItem(playlist, JSON.stringify(musicas));
}


function addListItem(content,idLista) {
  var list = document.getElementById(idLista);
  var newItem = document.createElement('li');
  newItem.className = "liPlaylist";
  var newItemA = document.createElement('a');
  newItemA.textContent = content;
  newItem.appendChild(newItemA);

  var ul = document.createElement('ul');
  ul.className ="sub-list";
  ObterMusicasPlaysList(content).forEach(element => {
    var musica = document.createElement('li');
    var musicaA = document.createElement('a');
    musicaA.className = "liPlaylist-musica";

    musicaA.href = "music.html?id="+element;
    const filteredSongs = songs.filter(song => song.id == element);
    musicaA.textContent = filteredSongs[0].nome;
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

$(document).ready(function() {
    var playLists = ObterPlaysLists();

    playLists.forEach(function(item) {
        addListItem(item ,"lista-playlists");
    });

    $("#salvarPlayList").click(function(e){
        AddNovaPlaysList($("#playlistnome").val());
        $("#addPlayList").hide();
    });
    
    document.querySelectorAll('.liPlaylist').forEach(function(item) {
        item.addEventListener('click', toggleSubList);
    });
});