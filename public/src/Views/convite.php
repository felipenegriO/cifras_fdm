<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php csrf_meta(); ?>
  <title>Convite — Cifrô</title>
  <script src="<?= asset_url('/src/js/cifro-theme.js') ?>"></script>
  <link href="<?= asset_url('/src/css/fonts.css') ?>" rel="stylesheet">
  <link href="<?= asset_url('/src/css/theme.css') ?>" rel="stylesheet">
  <style>
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:linear-gradient(135deg,#0f0f0f 0%,#1a1a2e 100%); padding:20px; box-sizing:border-box; font-family:var(--font-ui,sans-serif); }
    .card { background:var(--bg-2,#1e1e1e); border:1px solid var(--border-1,#333); border-radius:16px; padding:36px 32px; max-width:440px; width:100%; box-shadow:0 12px 40px rgba(0,0,0,.5); text-align:center; }
    .brand img { width:132px; height:auto; margin-bottom:22px; }
    h1 { margin:0 0 10px; font-size:20px; color:#fff; }
    .banda { color:#a78bfa; font-weight:600; }
    p { color:#aaa; font-size:14px; line-height:1.6; margin:0 0 18px; }
    .acao { display:flex; align-items:center; justify-content:center; gap:10px; width:100%; height:44px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600; border:0; cursor:pointer; box-sizing:border-box; margin-bottom:10px; }
    .acao--google { background:#fff; color:#3c4043; border:1px solid #dadce0; }
    .acao--principal { background:#7c3aed; color:#fff; }
    .acao--secundaria { background:transparent; color:#a78bfa; border:1px solid #444; }
    .erro { background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.4); color:#f87171; border-radius:8px; padding:10px 14px; font-size:13px; margin-bottom:14px; }
    .rodape { margin-top:18px; font-size:13px; color:#666; }
    .rodape a { color:#7c3aed; text-decoration:none; }
    .consentimento { display:flex; gap:9px; align-items:flex-start; text-align:left; color:#aaa; font-size:12px; line-height:1.45; margin-top:16px; }
    .consentimento input { width:16px; height:16px; flex:0 0 auto; margin-top:2px; }
    .consentimento a { color:#a78bfa; }
  </style>
</head>
<body>
  <div class="card" data-convite-estado="<?= e($estado) ?>">
    <div class="brand"><img src="<?= asset_url('/src/images/cifro-logo.svg') ?>" alt="Cifrô"></div>

    <?php if ($erro): ?>
      <div class="erro"><?= e($erro) ?></div>
    <?php endif; ?>

    <?php if ($estado === 'invalido'): ?>
      <h1>Convite indisponível</h1>
      <p>Este convite não é mais válido. Peça um novo ao administrador da banda.</p>
      <a class="acao acao--secundaria" href="<?= e(base_url('/login.php')) ?>">Ir para o Cifrô</a>

    <?php elseif ($estado === 'visitante'): ?>
      <h1>Você foi convidado para a <span class="banda"><?= e($bandaNome) ?></span></h1>
      <p>Crie sua conta para ver o repertório da banda. Leva menos de um minuto.</p>

      <?php if (google_oauth_configured()): ?>
        <?php /*
          O aceite legal precisa acompanhar o botão do Google, igual em
          register.php. start.php só grava google_legal_acceptance quando
          recebe source=register E legal_acceptance=1 (start.php:13-22) — um
          source=convite passaria direto e o convidado entraria sem nunca ter
          aceitado os termos. Por isso o source aqui é 'register' mesmo.

          O legal_acceptance=1 NÃO sai no href: quem o injeta é o JS, e só
          depois de conferir o checkbox (igual register.php). Fixo no href, um
          clique com JS desligado — ou do meio, ou um prefetch — gravaria
          google_legal_acceptance na sessão sem ninguém ter marcado nada, e o
          callback.php persistiria esse aceite falso via recordLegalAcceptance().
          Sem o parâmetro, start.php responde 422 "Aceite legal obrigatório".
        */ ?>
        <a class="acao acao--google" id="conviteGoogle"
           href="<?= e(base_url('/api/auth/google/start.php?source=register')) ?>">
          Continuar com Google
        </a>
      <?php endif; ?>

      <a class="acao acao--principal" id="conviteCriarConta" href="<?= e(base_url('/register.php')) ?>">Criar conta com e-mail</a>
      <a class="acao acao--secundaria" id="conviteJaTenhoConta" href="<?= e(base_url('/login.php')) ?>">Já tenho conta</a>

      <label class="consentimento" for="legal_acceptance">
        <input type="checkbox" id="legal_acceptance">
        <span>Li e aceito os
          <a href="<?= e((string) env('TERMS_URL', base_url('/termos.php'))) ?>" target="_blank" rel="noopener">Termos de Uso</a> e a
          <a href="<?= e((string) env('PRIVACY_URL', base_url('/privacidade.php'))) ?>" target="_blank" rel="noopener">Política de Privacidade</a>.
        </span>
      </label>

    <?php elseif ($estado === 'ja-membro'): ?>
      <h1>Você já faz parte da <span class="banda"><?= e($bandaNome) ?></span></h1>
      <p>Nada a fazer aqui — é só seguir tocando.</p>
      <a class="acao acao--principal" href="<?= e(base_url('/index.php')) ?>">Abrir o Cifrô</a>

    <?php else: ?>
      <h1>Entrar na <span class="banda"><?= e($bandaNome) ?></span>?</h1>
      <p>Você entra como músico da banda e passa a ver o repertório dela.</p>
      <form method="post" action="<?= e(base_url('/convite.php')) ?>">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
        <input type="hidden" name="t" value="<?= e($token) ?>">
        <button type="submit" class="acao acao--principal" id="conviteEntrar">Entrar na banda</button>
      </form>
      <a class="acao acao--secundaria" href="<?= e(base_url('/index.php')) ?>">Agora não</a>
    <?php endif; ?>

    <div class="rodape">
      <a href="<?= e(base_url('/landing.php')) ?>">O que é o Cifrô?</a>
    </div>
  </div>

  <script>
    // Mesma trava do register.php: o Google só sai daqui com o aceite marcado,
    // porque o cadastro por Google não passa por nenhum outro formulário onde
    // o consentimento pudesse ser pedido. Quem escolhe "criar conta com
    // e-mail" encontra o checkbox obrigatório do próprio register.php.
    document.getElementById('conviteGoogle')?.addEventListener('click', evento => {
      if (!document.getElementById('legal_acceptance')?.checked) {
        evento.preventDefault();
        alert('Aceite os Termos de Uso e a Política de Privacidade para continuar.');
        return;
      }
      evento.currentTarget.href = '<?= base_url('/api/auth/google/start.php') ?>?source=register&legal_acceptance=1';
    });
  </script>
</body>
</html>
