<?php
session_start();
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
if (!isset($_SESSION['autenticado']) || $_SESSION['autenticado'] !== true) {
    header('Location: login.php');
    exit;
}
?>
<style>
  .topnav{
    position: sticky;
    top: 0;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    padding: 10px 14px;
    background: #0b0b0b !important;
    border-bottom: 1px solid #2a2a2a;
    box-shadow: 0 6px 20px rgba(0,0,0,.35);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }

  .topnav-left{
    display:flex;
    align-items:center;
    gap:10px;
    background: transparent !important;
    min-width: 120px;
  }

  .topnav-badge{
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display:flex;
    align-items:center;
    justify-content:center;
    background: #13ff1340 !important;
    border: 1px solid #2e7d32;
    font-weight: 800;
    color: #fff;
    user-select:none;
  }

  .topnav-title{
    display:flex;
    flex-direction:column;
    line-height:1.05;
    background: transparent !important;
  }

  .topnav-title strong{
    font-size: 14px;
    letter-spacing: .3px;
    background: transparent !important;
  }

  .topnav-title span{
    font-size: 12px;
    opacity: .75;
    background: transparent !important;
  }

  .topnav-right{
    display:flex;
    align-items:center;
    gap: 10px;
    background: transparent !important;
    overflow:auto;
  }

  .topnav-right a{
    text-decoration: none;
    color: #fff !important;
    font-size: 14px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid transparent;
    background: transparent !important;
    white-space: nowrap;

    transition: transform .08s ease, background .15s ease, border-color .15s ease;
  }

  .topnav-right a:hover{
    background: #141414 !important;
    border-color: #2a2a2a;
  }

  .topnav-right a:active{
    transform: scale(.98);
  }

  /* Botão hambúrguer (só mobile) */
  .topnav-btn{
    display:none;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid #2a2a2a;
    background: #111 !important;
    color:#fff;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  /* Mobile: esconde links e mostra botão ☰ */
  @media (max-width: 720px){
    .topnav-right a{ display:none; }
    .topnav-btn{ display:inline-flex; }
  }
</style>

<nav class="topnav">
      <div class="topnav-left">
    <div class="topnav-title">
      <span></span>
    </div>
  </div>
  <?php
    $perfil = strtolower(trim((string)($_SESSION['usuario']['perfil'] ?? 'administrador')));
    $isAdmin = $perfil === 'administrador';
  ?>
  <div class="topnav-right">
    <a href="/index.php">Musicas</a>
    <?php if ($isAdmin): ?>
    <a href="editorplaylist.php">Playlists</a>
    <a href="editor.php">Editor Musicas</a>
    <a href="roteiro.php">Editor Roteiros</a>
    <a href="/src/backend/users/editoruser.php">Usuários</a>
    <?php endif; ?>
    <!-- no mobile, aparece -->
    <button class="topnav-btn" type="button" id="menuButtonTop" aria-label="Abrir menu">☰</button>
  </div>
</nav>

<script>
  // Opcional: ligar o botão ☰ ao seu menu lateral existente (menusideMenu)
  (function(){
    const btn = document.getElementById('menuButtonTop');
    if(!btn) return;
    btn.addEventListener('click', function(){
      const menu = document.getElementById('menusideMenu');
      if(menu) menu.style.right = '0';
    });
  })();
</script>
