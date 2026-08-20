<?php
class RegisterController {
    private UserRepository  $userRepo;
    private BandaRepository $bandaRepo;

    public function __construct() {
        $this->userRepo  = new UserRepository();
        $this->bandaRepo = new BandaRepository();
    }

    public function showForm(): void {
        $erro    = '';
        $success = false;
        $convite = BandaConviteFlow::pendente();
        render_view('register', compact('erro', 'success', 'convite'));
    }

    public function handle(): void {
        $erro    = '';
        $success = false;

        // Convite pendente na sessão (gravado por convite.php): quem chega por
        // um convite entra na banda que convidou, em vez de criar uma própria.
        $convite = BandaConviteFlow::pendente();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        }

        require_csrf();

        $email = strtolower(trim($_POST['email'] ?? ''));
        if (cifro_rate_limit('register', 5, 300, $email)) {
            $erro = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        }

        $nome      = trim($_POST['nome']       ?? '');
        $bandaNome = trim($_POST['banda_nome'] ?? '');
        $legalAccepted = ($_POST['legal_acceptance'] ?? '') === '1';

        if (!$nome || !$email || (!$convite && !$bandaNome)) {
            $erro = 'Todos os campos são obrigatórios.';
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        }

        if (!$legalAccepted) {
            $erro = 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.';
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $erro = 'E-mail inválido.';
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        }

        if ($this->userRepo->findByEmail($email)) {
            $erro = 'Este e-mail já está cadastrado.';
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        }

        $pdo = Database::getConnection();
        try {
            $pdo->beginTransaction();

            $userId  = bin2hex(random_bytes(16));
            $bandaId = bin2hex(random_bytes(16));

            // Create user (inactive until password is set)
            $this->userRepo->save([
                'id'             => $userId,
                'nome'           => $nome,
                'email'          => $email,
                'senha_hash'     => null,
                'perfil'         => 'usuario',
                'ativo'          => 0,
                'validade'       => null,
            ]);

            if ($convite) {
                // Aceite dentro da MESMA transação: se o convite tiver morrido
                // ou a banda estiver cheia, o cadastro inteiro volta atrás e
                // não sobra usuário sem banda nenhuma.
                $resultado = (new BandaConviteFlow())->aceitar($convite['token'], $userId);
                if (!$resultado['ok']) {
                    throw new ConviteRecusadoException($resultado['erro']);
                }
                $bandaId = $convite['banda_id'];
            } else {
                $this->bandaRepo->save([
                    'id'             => $bandaId,
                    'nome'           => $bandaNome,
                    'ativo'          => 1,
                    'plano'          => 'gratuito',
                    'trial_expira_em'=> null,
                    'criador_id'     => $userId,
                ]);
                $this->userRepo->importToBanda($userId, $bandaId, 'administrador');
            }

            $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
            $this->userRepo->recordLegalAcceptance(
                $userId,
                (string) env('LEGAL_TERMS_VERSION', '2026-08-03'),
                (string) env('LEGAL_PRIVACY_VERSION', '2026-08-03'),
                $ip === '' ? null : hash_hmac('sha256', $ip, (string) env('ENCRYPTION_KEY', 'local-test-key'))
            );

            // Create activation token (48h)
            $token = $this->userRepo->createToken($userId, 172800);

            $pdo->commit();
        } catch (ConviteRecusadoException $e) {
            $pdo->rollBack();
            // Convite recusado (morto, ou banda no teto do plano): tirar da
            // sessão nos DOIS casos. Mantê-la prenderia o visitante num loop
            // onde a view segue escondendo o campo "Nome da banda" e toda nova
            // tentativa recusa de novo — quem ainda não tem conta ficaria sem
            // conseguir se cadastrar em banda nenhuma até a sessão morrer.
            BandaConviteFlow::limparSessao();
            $convite = null;
            if ($e->motivo === 'plano_limite') {
                $erro = 'Esta banda já atingiu o limite de músicos do plano. Peça ao administrador para liberar espaço ou fazer upgrade. Enquanto isso, você pode criar sua própria banda abaixo.';
            } else {
                $erro = 'Este convite não é mais válido. Peça um novo ao administrador da banda ou crie sua própria banda abaixo.';
            }
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        } catch (Exception $e) {
            $pdo->rollBack();
            ErrorLogger::fromThrowable($e, 'Falha na transação de cadastro (usuário/banda/vínculo)', 'RegisterController::handle');
            $erro = 'Erro ao criar conta. Tente novamente.';
            render_view('register', compact('erro', 'success', 'convite'));
            return;
        }

        // Send welcome email
        try {
            MailService::sendWelcome(
                ['nome' => $nome, 'email' => $email],
                ['nome' => $convite ? $convite['banda_nome'] : $bandaNome],
                $token
            );
        } catch (Throwable $e) {
            ErrorLogger::fromThrowable($e, 'Falha ao enviar e-mail de boas-vindas no cadastro', 'RegisterController::handle');
        }

        if ($convite) BandaConviteFlow::limparSessao();

        $success = true;
        $activationToken = env('APP_ENV', 'production') === 'test' ? $token : null;
        OperationalLogger::log('info', 'activation.registration_completed', ['operation' => 'register', 'result' => 'success']);
        render_view('register', compact('erro', 'success', 'email', 'activationToken', 'convite'));
    }
}
