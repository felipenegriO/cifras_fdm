<?php
/**
 * Porta de entrada do convite por link (ROLE-003).
 *
 * Existe como página própria, e não como parâmetro em register.php, porque
 * aquele arquivo manda todo usuário autenticado direto para index.php (linhas
 * 4-6) — um convite anexado à URL de cadastro seria engolido em silêncio.
 *
 * Qualquer falha mostra a MESMA tela neutra e nunca o nome da banda: senão o
 * endereço vira uma sonda para descobrir que bandas existem.
 */
require_once __DIR__ . '/src/backend/bootstrap.php';

$convites = new BandaConviteRepository();
$logado   = (($_SESSION['autenticado'] ?? false) === true);
$usuarioId = (string) ($_SESSION['usuario']['id'] ?? '');

// No POST o token vem do formulário; no GET, da URL.
$token = trim((string) ($_SERVER['REQUEST_METHOD'] === 'POST' ? ($_POST['t'] ?? '') : ($_GET['t'] ?? '')));

$convite = $token !== '' ? $convites->buscarPorToken($token) : null;
$valido  = BandaConvitePolicy::estaValido($convite);

$banda = null;
if ($valido) {
    $banda = (new BandaRepository())->findById((string) $convite['banda_id']);
    // Banda apagada ou desativada não recebe ninguém.
    if (!$banda || !($banda['ativo'] ?? 0)) {
        $valido = false;
        $banda  = null;
    }
}

$erro = '';

// ── Aceite: POST com CSRF, nunca GET ─────────────────────────────────────────
// Um GET que vincula seria disparado por prefetch de navegador e por qualquer
// pré-visualização de link — o WhatsApp abre todo link que passa por ele.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $valido && $logado) {
    require_csrf();

    if (cifro_rate_limit('convite_aceite', 10, 300, $usuarioId)) {
        $erro = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    } else {
        $resultado = (new BandaConviteFlow())->aceitar($token, $usuarioId);

        if ($resultado['ok']) {
            // A banda vem do próprio aceite (resolvida pelo token lá dentro).
            $banda = $resultado['banda'];

            // Entra já com a banda convidada selecionada, senão o músico cai
            // na banda antiga e acha que o convite não funcionou.
            //
            // O perfil precisa vir do banco, da banda DO CONVITE — não da
            // sessão, que reflete a banda atualmente selecionada (que pode
            // ser outra). Senão um administrador de uma banda A que já é
            // básico na banda B do convite "vira" administrador de B ao
            // aceitar.
            $perfil = BandaConvitePolicy::PERFIL;
            if ($resultado['ja_era_membro']) {
                $pdo  = Database::getConnection();
                $stmt = $pdo->prepare('SELECT perfil FROM usuario_banda WHERE usuario_id = ? AND banda_id = ?');
                $stmt->execute([$usuarioId, $banda['id']]);
                $perfil = $stmt->fetchColumn() ?: BandaConvitePolicy::PERFIL;
            }

            if (!BandaSelectionHelper::isBandaJaNaLista($_SESSION['usuario']['bandas'] ?? [], $banda['id'])) {
                $_SESSION['usuario']['bandas'][] = ['id' => $banda['id'], 'perfil' => $perfil];
            }
            $_SESSION['banda_atual'] = BandaSelectionHelper::buildBandaAtualSession($banda, $perfil);
            (new UserRepository())->updateConfig($usuarioId, ['banda_atual' => $banda['id']]);
            $_SESSION['usuario']['config']['banda_atual'] = $banda['id'];

            BandaConviteFlow::limparSessao();
            OperationalLogger::log('info', 'convite.aceito', ['operation' => 'convite_aceitar', 'result' => 'success']);

            header('Location: ' . base_url('/index.php'));
            exit;
        }

        $erro = $resultado['erro'] === 'plano_limite'
            ? 'Esta banda atingiu o limite de músicos do plano. Peça ao administrador para fazer upgrade.'
            : 'Este convite não é mais válido. Peça um novo ao administrador da banda.';
    }
}

// ── Estado da tela ───────────────────────────────────────────────────────────
if (!$valido) {
    $estado = 'invalido';
} elseif (!$logado) {
    $estado = 'visitante';
    // Guarda o convite para register.php e para o callback do Google lerem.
    BandaConviteFlow::guardarNaSessao($token, (string) $banda['id'], (string) $banda['nome']);
} elseif ((new UserRepository())->belongsToBanda($usuarioId, (string) $banda['id'])) {
    $estado = 'ja-membro';
} else {
    $estado = 'entrar';
}

$bandaNome = $valido ? (string) $banda['nome'] : '';

render_view('convite', compact('estado', 'bandaNome', 'token', 'erro'));
