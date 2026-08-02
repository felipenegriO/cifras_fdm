<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login — StageBox</title>

  <!-- Bootstrap CSS -->
  <script src="/src/js/fdm-theme.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/bootstrap.min.css" rel="stylesheet" />
  <link href="/src/css/theme.css" rel="stylesheet">

  <!-- Google Fonts (Poppins) -->
  <link href="/src/css/fontlogin.css" rel="stylesheet" />

  <style>
    body {
      font-family: 'Poppins', sans-serif;
      background: linear-gradient(135deg, #000000 0%, #282828 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      color: #fff;
    }
    .card {
      background: #fff;
      color: #333;
      border-radius: 1rem;
      box-shadow: 0 8px 24px rgba(85, 66, 193, 0.3);
      max-width: 420px;
      width: 100%;
      padding: 2rem;
      border: 0;
    }
    h2 {
      font-weight: 600;
      margin-bottom: 1.5rem;
      color: #2a2a2a;
      text-align: center;
    }
    label {
      font-weight: 600;
      color: #2a2a2a;
    }
    .form-control {
      border-radius: 0.5rem;
      box-shadow: none;
      border: 1.5px solid #2a2a2a;
      transition: border-color 0.3s ease;
    }
    .form-control:focus {
      border-color: #2a2a2a;
      box-shadow: 0 0 5px rgba(45, 47, 168, 0.5);
    }
    .btn-primary {
      background-color: #2a2a2a;
      border: none;
      font-weight: 600;
      padding: 0.75rem;
      border-radius: 0.75rem;
      width: 100%;
      transition: background-color 0.3s ease;
    }
    .btn-primary:hover {
      background-color: #000000;
    }
    .text-danger {
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }
    .senha-wrap {
      position: relative;
    }
    .senha-toggle {
      position: absolute;
      right: 4px;
      top: 50%;
      transform: translateY(-50%);
      border: 0;
      background: transparent;
      color: #555;
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      font-size: 1.1rem;
      cursor: pointer;
      border-radius: 6px;
    }
    .senha-toggle:hover { background: rgba(0,0,0,.05); }
    .senha-toggle:focus-visible { outline: 2px solid #2a2a2a; outline-offset: 2px; }
    .senha-wrap .form-control {
      padding-right: 3rem;
    }
    .form-control { font-size: 1rem; min-height: 44px; }
    .text-danger { font-size: 0.9rem; }
  </style>
</head>

<body>

  <div class="card">
    <h2>Login</h2>

    <?php if (!empty($erro)): ?>
      <div class="alert alert-danger py-2" role="alert" aria-live="polite">
        <?= htmlspecialchars($erro, ENT_QUOTES, 'UTF-8') ?>
      </div>
    <?php endif; ?>

    <?php $googleConfigured = trim((string) env('GOOGLE_CLIENT_ID', '')) !== ''; ?>
    <?php if ($googleConfigured): ?>
      <a href="/api/auth/google/start.php" class="btn btn-google" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:44px;background:#fff;color:#3c4043;border:1px solid #dadce0;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin-bottom:16px;">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
        Continuar com Google
      </a>
      <div style="text-align:center;margin-bottom:16px;color:#666;font-size:12px">ou entre com e-mail</div>
    <?php endif; ?>

    <form method="post" id="loginForm" novalidate>
      <div class="mb-3">
        <label for="username" class="form-label">Usuário</label>
        <input
          type="text"
          class="form-control"
          id="username"
          name="username"
          placeholder="username"
          required
          autocomplete="username"
        >
      </div>

      <div class="mb-4">
        <label for="senha" class="form-label">Senha</label>
        <div class="senha-wrap">
          <input
            type="password"
            class="form-control"
            id="senha"
            name="senha"
            placeholder="Digite sua senha"
            required
            autofocus
            autocomplete="current-password"
          >
          <button type="button" id="toggleSenha" class="senha-toggle" aria-label="Mostrar senha" title="Mostrar senha">
            <svg id="iconEye" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>

      <button type="submit" class="btn btn-primary">Entrar</button>

      <div style="text-align:center;margin-top:14px;font-size:13px;color:#888">
        <a href="/esqueci-senha.php" style="color:#888;text-decoration:none">Esqueci minha senha</a>
        &nbsp;·&nbsp;
        <a href="/register.php" style="color:#888;text-decoration:none">Criar conta</a>
      </div>
    </form>
  </div>

  <script>
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const senha = document.getElementById('senha');
    const username = document.getElementById('username');
    const toggleSenha = document.getElementById('toggleSenha');

    function showError(input, message) {
      removeError(input);
      const div = document.createElement('div');
      div.className = 'text-danger';
      div.innerText = message;
      input.parentNode.appendChild(div);
    }

    function removeError(input) {
      const parent = input.parentNode;
      const error = parent.querySelector('.text-danger');
      if (error) parent.removeChild(error);
    }

    form.addEventListener('submit', (e) => {
      removeError(username);
      removeError(senha);

      let valid = true;
      if (!username.value.trim()) {
        showError(username, 'Informe o usuário.');
        valid = false;
      }
      if (!senha.value.trim()) {
        showError(senha, 'Informe a senha.');
        valid = false;
      }

      if (!valid) e.preventDefault();
    });

    if (toggleSenha) {
      const eyePath = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      const eyeOffPath = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
      toggleSenha.addEventListener('click', () => {
        const hidden = senha.type === 'password';
        senha.type = hidden ? 'text' : 'password';
        toggleSenha.setAttribute('aria-label', hidden ? 'Ocultar senha' : 'Mostrar senha');
        toggleSenha.setAttribute('title', hidden ? 'Ocultar senha' : 'Mostrar senha');
        const icon = document.getElementById('iconEye');
        if (icon) icon.innerHTML = hidden ? eyeOffPath : eyePath;
      });
    }
  });
  </script>
</body>

</html>
