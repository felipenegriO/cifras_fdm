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
        render_view('register', compact('erro', 'success'));
    }

    public function handle(): void {
        $erro    = '';
        $success = false;

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            render_view('register', compact('erro', 'success'));
            return;
        }

        require_csrf();

        $email = strtolower(trim($_POST['email'] ?? ''));
        if (cifro_rate_limit('register', 5, 300, $email)) {
            $erro = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
            render_view('register', compact('erro', 'success'));
            return;
        }

        $nome      = trim($_POST['nome']       ?? '');
        $bandaNome = trim($_POST['banda_nome'] ?? '');
        $legalAccepted = ($_POST['legal_acceptance'] ?? '') === '1';

        if (!$nome || !$email || !$bandaNome) {
            $erro = 'Todos os campos são obrigatórios.';
            render_view('register', compact('erro', 'success'));
            return;
        }

        if (!$legalAccepted) {
            $erro = 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.';
            render_view('register', compact('erro', 'success'));
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $erro = 'E-mail inválido.';
            render_view('register', compact('erro', 'success'));
            return;
        }

        if ($this->userRepo->findByEmail($email)) {
            $erro = 'Este e-mail já está cadastrado.';
            render_view('register', compact('erro', 'success'));
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

            $this->bandaRepo->save([
                'id'             => $bandaId,
                'nome'           => $bandaNome,
                'ativo'          => 1,
                'plano'          => 'gratuito',
                'trial_expira_em'=> null,
            ]);

            // Link user → band as administrator
            $this->userRepo->importToBanda($userId, $bandaId, 'administrador');

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
        } catch (Exception $e) {
            $pdo->rollBack();
            $erro = 'Erro ao criar conta. Tente novamente.';
            render_view('register', compact('erro', 'success'));
            return;
        }

        // Send welcome email
        try {
            MailService::sendWelcome(
                ['nome' => $nome, 'email' => $email],
                ['nome' => $bandaNome],
                $token
            );
        } catch (Exception $e) {
            // Log but don't block user — they can request resend later
        }

        $success = true;
        $activationToken = env('APP_ENV', 'production') === 'test' ? $token : null;
        OperationalLogger::log('info', 'activation.registration_completed', ['operation' => 'register', 'result' => 'success']);
        render_view('register', compact('erro', 'success', 'email', 'activationToken'));
    }
}
