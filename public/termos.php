<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
if (!headers_sent()) header('Cache-Control: public, max-age=300, s-maxage=3600');
$version   = (string) env('LEGAL_TERMS_VERSION', '2026-08-03');
$support   = (string) env('SUPPORT_EMAIL', 'contato@cifro.online');
$ownerName = trim((string) env('OWNER_NAME', ''));
$ownerCity = trim((string) env('OWNER_LOCATION', ''));
$responsavel = $ownerName !== '' ? $ownerName : 'a pessoa física responsável pelo projeto';
?>
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Termos de Uso — Cifrô</title>
  <meta name="robots" content="index, follow">
  <link href="/src/css/fonts.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
  <style>
    body { font-family:'Inter',system-ui,sans-serif; }
    main { max-width:760px;margin:40px auto;padding:24px;line-height:1.7; }
    h1 { margin-bottom:4px; }
    h2 { margin-top:34px;font-size:19px; }
    .meta { color:#8f8f8f;font-size:14px;margin-top:0; }
    .box { border:1px solid #2a2a2a;border-radius:10px;padding:16px 18px;margin:22px 0;font-size:15px; }
    a { color:#a78bfa; }
    dl { margin:0; } dt { font-weight:600;margin-top:10px; } dd { margin:2px 0 0; }
  </style>
</head>
<body>
<main>
  <h1>Termos de Uso</h1>
  <p class="meta">Versão <?= e($version) ?> · Cifrô — cifro.online</p>

  <div class="box">
    <strong>Quem é o responsável por este serviço.</strong>
    O Cifrô é um projeto independente, em estágio beta, mantido por <?= e($responsavel) ?><?= $ownerCity !== '' ? ', ' . e($ownerCity) : '' ?>,
    atuando como pessoa física. <strong>Não há pessoa jurídica constituída (CNPJ) neste momento.</strong>
    Todo contato, incluindo reclamações, pedidos de cancelamento e de reembolso, é feito diretamente por
    <a href="mailto:<?= e($support) ?>"><?= e($support) ?></a>, e respondido por quem desenvolve o serviço.
  </div>

  <h2>1. O que o Cifrô faz</h2>
  <p>O Cifrô organiza cifras, repertórios e roteiros de músicas para bandas, permite transposição de tom,
  leitura em tela para apresentação, um modo ao vivo que sincroniza a tela dos integrantes e ferramentas de ensaio
  com vídeos do YouTube.</p>
  <p>Duas limitações declaradas desde já, para não haver dúvida:
  <strong>o modo ao vivo, o ensaio com YouTube e a sincronização de alterações exigem conexão com a internet</strong>;
  a leitura de cifras e repertórios previamente preparados funciona sem conexão.</p>

  <h2>2. Estágio beta</h2>
  <p>O serviço está em beta. Isso significa que recursos podem mudar, apresentar falhas ou ficar temporariamente
  indisponíveis, e que manutenções podem ocorrer sem aviso prévio. Recomendamos que você mantenha uma exportação
  dos seus dados, disponível a qualquer momento em Configurações.</p>

  <h2>3. Sua conta</h2>
  <p>Você é responsável por manter a confidencialidade da sua senha e pelas ações praticadas com a sua conta.
  Cada banda enxerga apenas o próprio conteúdo. É proibido usar o serviço para violar direitos de terceiros,
  comprometer a segurança da plataforma ou tentar acessar dados de outras contas ou bandas.</p>

  <h2>4. Conteúdo que você cadastra</h2>
  <p>As cifras, letras e anotações que você cadastra continuam sendo suas e o Cifrô não reivindica propriedade
  sobre elas. Você declara possuir as autorizações necessárias para utilizar o conteúdo que insere. Obras musicais
  são protegidas por direito autoral e o uso que você faz delas é de sua responsabilidade.</p>

  <h2>5. Planos e pagamento</h2>
  <dl>
    <dt>Gratuito — R$ 0, sem prazo</dt>
    <dd>1 banda, até 10 músicas, 1 repertório e apenas o usuário titular.</dd>
    <dt>Mensal — R$ 9,90 por mês</dt>
    <dd>Músicas, repertórios e membros ilimitados.</dd>
    <dt>Semestral — R$ 49,90 a cada 6 meses</dt>
    <dd>Mesmos recursos do mensal.</dd>
    <dt>Anual — R$ 89,90 por ano</dt>
    <dd>Mesmos recursos do mensal.</dd>
  </dl>
  <p>O plano é da banda, não por integrante. Os pagamentos com cartão são processados pela Stripe, que recebe os
  dados do cartão diretamente — o Cifrô não armazena número de cartão. Também aceitamos Pix, com confirmação manual.
  Preços podem ser alterados no futuro, sempre com aviso prévio e sem efeito sobre o período já pago.</p>

  <h2>6. Cancelamento</h2>
  <p>Você pode cancelar quando quiser: não há fidelidade, prazo mínimo nem multa.</p>
  <p><strong>Assinatura no cartão:</strong> o cancelamento é feito por você mesmo, na tela de Plano, pelo botão
  “Cancelar assinatura”. O efeito é imediato sobre a cobrança — nenhuma nova cobrança é gerada — e o acesso
  permanece até o fim do período já pago.</p>
  <p><strong>Pagamento por Pix:</strong> não há cobrança recorrente. O acesso vale até o fim do período contratado e
  simplesmente não é renovado; se preferir avisar, há um botão de solicitação na mesma tela.</p>
  <p>Em ambos os casos, ao fim do período a conta volta aos limites do plano gratuito.
  <strong>Seu conteúdo não é apagado por cancelamento.</strong></p>

  <h2>7. Direito de arrependimento e reembolso</h2>
  <p>Conforme o artigo 49 do Código de Defesa do Consumidor, você tem <strong>7 dias corridos a contar da
  contratação</strong> para desistir e receber a devolução integral do valor pago, sem precisar justificar.
  Basta escrever para <a href="mailto:<?= e($support) ?>"><?= e($support) ?></a>. O estorno é feito pelo mesmo meio
  de pagamento.</p>
  <p>Fora desse prazo, se o serviço ficar indisponível por falha nossa por período relevante, avalie conosco pelo
  mesmo canal — tratamos caso a caso e de boa-fé.</p>

  <h2>8. Encerramento da conta</h2>
  <p>Você pode excluir sua conta a qualquer momento em Configurações, o que remove seus dados conforme descrito na
  <a href="<?= e((string) env('PRIVACY_URL', '/privacidade.php')) ?>">Política de Privacidade</a>. Podemos suspender
  contas que violem estes Termos, com aviso sempre que possível.</p>

  <h2>9. Limitação de responsabilidade</h2>
  <p>O serviço é fornecido no estado em que se encontra. Não nos responsabilizamos por perdas decorrentes de
  indisponibilidade, falhas de conexão do seu local de uso ou perda de conteúdo que você não tenha exportado.
  Nada aqui afasta os direitos que a legislação consumerista brasileira garante a você.</p>

  <h2>10. Alterações e foro</h2>
  <p>Alterações relevantes nestes Termos serão comunicadas por e-mail ou dentro do aplicativo. Aplica-se a
  legislação brasileira e fica eleito o foro do domicílio do consumidor para dirimir eventuais controvérsias.</p>

  <h2>11. Contato</h2>
  <p>Dúvidas, reclamações, cancelamento ou reembolso: <a href="mailto:<?= e($support) ?>"><?= e($support) ?></a>.</p>

  <p style="margin-top:36px"><a href="/landing.php">Voltar para a página inicial</a> · <a href="/register.php">Criar conta</a></p>
</main>
</body>
</html>
