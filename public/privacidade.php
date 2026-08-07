<?php
require_once __DIR__ . '/src/backend/bootstrap.php';
$version   = (string) env('LEGAL_PRIVACY_VERSION', '2026-08-03');
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
  <title>Política de Privacidade — Cifrô</title>
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
    table { width:100%;border-collapse:collapse;margin-top:12px;font-size:14.5px; }
    th, td { text-align:left;padding:9px 10px;border-bottom:1px solid #2a2a2a;vertical-align:top; }
    th { color:#8f8f8f;font-weight:600; }
  </style>
</head>
<body>
<main>
  <h1>Política de Privacidade</h1>
  <p class="meta">Versão <?= e($version) ?> · Cifrô — cifro.online</p>

  <div class="box">
    <strong>Quem é o controlador dos seus dados.</strong>
    O Cifrô é um projeto independente, em beta, mantido por <?= e($responsavel) ?><?= $ownerCity !== '' ? ', ' . e($ownerCity) : '' ?>,
    atuando como pessoa física. <strong>Ainda não há CNPJ constituído.</strong>
    Para os fins da LGPD (Lei 13.709/2018), essa mesma pessoa é o <strong>controlador</strong> e também o canal de
    atendimento ao titular: <a href="mailto:<?= e($support) ?>"><?= e($support) ?></a>.
  </div>

  <h2>1. Que dados tratamos</h2>
  <table>
    <tr><th>Dado</th><th>Para quê</th><th>Base legal</th></tr>
    <tr><td>Nome e e-mail</td><td>Criar e identificar sua conta, enviar ativação e recuperação de senha</td><td>Execução de contrato</td></tr>
    <tr><td>Senha (guardada como hash, nunca em texto)</td><td>Autenticar você</td><td>Execução de contrato</td></tr>
    <tr><td>Nome da banda e vínculo dos integrantes</td><td>Separar o conteúdo de cada banda e controlar permissões</td><td>Execução de contrato</td></tr>
    <tr><td>Conteúdo que você cadastra (cifras, repertórios, anotações)</td><td>Prestar o serviço</td><td>Execução de contrato</td></tr>
    <tr><td>Registros técnicos de acesso e erro</td><td>Manter o serviço no ar, investigar falhas e abusos</td><td>Legítimo interesse e obrigação legal</td></tr>
    <tr><td>Dados de assinatura (plano, situação, identificador da cobrança)</td><td>Controlar o que você contratou</td><td>Execução de contrato</td></tr>
  </table>
  <p><strong>Não recebemos e não armazenamos números de cartão de crédito.</strong> O pagamento com cartão acontece
  dentro da Stripe, que trata esses dados como controladora própria.</p>
  <p>Se você entrar com o Google, recebemos do Google apenas nome, e-mail e identificador da conta — nunca sua senha.</p>

  <h2>2. O que não fazemos</h2>
  <p>Não vendemos seus dados. Não repassamos para anunciantes. Não usamos seu conteúdo para treinar modelos.
  Não há rastreadores de publicidade nem redes sociais embutidas no site.</p>

  <h2>3. Quem mais tem acesso</h2>
  <p>Apenas prestadores necessários para o serviço funcionar, e estritamente para executar a função contratada:</p>
  <table>
    <tr><th>Prestador</th><th>Função</th></tr>
    <tr><td>Hostinger</td><td>Hospedagem da aplicação e do banco de dados</td></tr>
    <tr><td>Stripe</td><td>Processamento de pagamento com cartão</td></tr>
    <tr><td>Google</td><td>Login com conta Google, quando você opta por ele</td></tr>
    <tr><td>Servidor de e-mail (SMTP)</td><td>Envio de ativação, recuperação de senha e avisos do serviço</td></tr>
  </table>

  <h2>4. Por quanto tempo guardamos</h2>
  <p>Enquanto sua conta existir. Após a exclusão da conta, os dados pessoais e o conteúdo são removidos; registros
  técnicos e informações necessárias ao cumprimento de obrigações legais podem ser mantidos pelo prazo exigido em lei.</p>

  <h2>5. Seus direitos</h2>
  <p>A LGPD garante a você confirmação de tratamento, acesso, correção, anonimização, portabilidade, informação
  sobre compartilhamento e eliminação dos dados. Na prática, dentro do Cifrô:</p>
  <ul>
    <li>Em <strong>Configurações</strong> você <strong>exporta todos os seus dados</strong> a qualquer momento.</li>
    <li>Em <strong>Configurações</strong> você <strong>exclui sua conta</strong> e o conteúdo associado.</li>
    <li>Para qualquer outro pedido, escreva para <a href="mailto:<?= e($support) ?>"><?= e($support) ?></a>. Respondemos em até 15 dias.</li>
  </ul>

  <h2>6. Segurança</h2>
  <p>Senhas são guardadas como hash. O acesso é feito por HTTPS. O conteúdo é isolado por banda e verificado a cada
  requisição. Sendo honesto sobre o estágio: este é um projeto pequeno em beta, mantido por uma pessoa — não há
  certificação de segurança nem auditoria externa. Se você identificar uma vulnerabilidade, avise pelo e-mail acima
  e será tratada com prioridade.</p>

  <h2>7. Cookies</h2>
  <p>Usamos apenas o cookie de sessão necessário para manter você autenticado, e armazenamento local no seu próprio
  aparelho para preferências (tema, tamanho de fonte) e para o funcionamento offline. Não há cookie de publicidade
  nem de rastreamento de terceiros.</p>

  <h2>8. Menores de idade</h2>
  <p>O serviço não é direcionado a menores de 16 anos. Sendo comum que adolescentes participem de bandas e
  ministérios, o cadastro nesses casos deve ser feito com consentimento e supervisão dos pais ou responsáveis.</p>

  <h2>9. Mudanças nesta política</h2>
  <p>Alterações relevantes serão comunicadas por e-mail ou dentro do aplicativo, com atualização da versão indicada
  no topo desta página.</p>

  <h2>10. Contato do titular</h2>
  <p>Qualquer pedido relacionado aos seus dados: <a href="mailto:<?= e($support) ?>"><?= e($support) ?></a>.</p>

  <p style="margin-top:36px"><a href="/landing.php">Voltar para a página inicial</a> · <a href="/register.php">Criar conta</a></p>
</main>
</body>
</html>
