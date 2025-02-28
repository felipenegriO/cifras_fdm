function AddRebanhao(){
    
    LimparPlaylist("Rebanhão")
    AddNovaPlaysList("Rebanhão");
    AddNovaMusicaPlaysList("Rebanhão", 26);
    AddNovaMusicaPlaysList("Rebanhão", 103);
    AddNovaMusicaPlaysList("Rebanhão", 74);
    AddNovaMusicaPlaysList("Rebanhão", 123);
    AddNovaMusicaPlaysList("Rebanhão", 14);
    AddNovaMusicaPlaysList("Rebanhão", 77);
    AddNovaMusicaPlaysList("Rebanhão", 10);
    AddNovaMusicaPlaysList("Rebanhão", 5);
    AddNovaMusicaPlaysList("Rebanhão", 7);
    AddNovaMusicaPlaysList("Rebanhão", 13);
    AddNovaMusicaPlaysList("Rebanhão", 41);
    AddNovaMusicaPlaysList("Rebanhão", 114);
    AddNovaMusicaPlaysList("Rebanhão", 115);
    AddNovaMusicaPlaysList("Rebanhão", 58);
    AddNovaMusicaPlaysList("Rebanhão", 112);
    AddNovaMusicaPlaysList("Rebanhão", 112);
    AddNovaMusicaPlaysList("Rebanhão", 23);

    LimparPlaylist("Missa rebanhão")
    AddNovaPlaysList("Missa rebanhão");
    AddNovaMusicaPlaysList("Missa rebanhão", 117);
    AddNovaMusicaPlaysList("Missa rebanhão", 118);
    AddNovaMusicaPlaysList("Missa rebanhão", 119);
    AddNovaMusicaPlaysList("Missa rebanhão", 124);
    AddNovaMusicaPlaysList("Missa rebanhão", 82);
    AddNovaMusicaPlaysList("Missa rebanhão", 83);
    AddNovaMusicaPlaysList("Missa rebanhão", 84);
    AddNovaMusicaPlaysList("Missa rebanhão", 122);
    AddNovaMusicaPlaysList("Missa rebanhão", 86);
    AddNovaMusicaPlaysList("Missa rebanhão", 85);
    AddNovaMusicaPlaysList("Missa rebanhão", 86);
    AddNovaMusicaPlaysList("Missa rebanhão", 120);
    AddNovaMusicaPlaysList("Missa rebanhão", 121);
    AddNovaMusicaPlaysList("Missa rebanhão", 90);
}



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
function RemoverMusicaPlaysList(playlist, idMusica) {
    var musicas = JSON.parse(sessionStorage.getItem(playlist)) || [];
    musicas = musicas.filter(musica => musica !== idMusica); // Remove a música da lista
    sessionStorage.setItem(playlist, JSON.stringify(musicas));
}
function LimparPlaylist(playlist) {
    sessionStorage.removeItem(playlist); // Remove a playlist do sessionStorage
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
  ul.style=" overflow: scroll; height: 80vh;";
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
    debugger;
    sessionStorage.removeItem('playsLists');
    sessionStorage.setItem('playsLists', JSON.stringify([])); 
    AddRebanhao();

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