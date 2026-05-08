<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login</title>

  <!-- Bootstrap CSS -->
  <link href="/src/css/bootstrap.min.css" rel="stylesheet" />

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
  </style>
</head>

<body>

  <div class="card">
    <h2>Login</h2>

    <?php if (!empty($erro)): ?>
      <div class="alert alert-danger py-2" role="alert">
        <?= htmlspecialchars($erro, ENT_QUOTES, 'UTF-8') ?>
      </div>
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
      </div>

      <button type="submit" class="btn btn-primary">Entrar</button>
    </form>
  </div>

  <script>
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const senha = document.getElementById('senha');
    const username = document.getElementById('username');

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
  });
  </script>
</body>

</html>
