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

        if (fdm_rate_limit('register', 5, 300)) {
            $erro = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
            render_view('register', compact('erro', 'success'));
            return;
        }

        $nome      = trim($_POST['nome']       ?? '');
        $email     = strtolower(trim($_POST['email']     ?? ''));
        $bandaNome = trim($_POST['banda_nome'] ?? '');

        if (!$nome || !$email || !$bandaNome) {
            $erro = 'Todos os campos são obrigatórios.';
            render_view('register', compact('erro', 'success'));
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $erro = 'E-mail inválido.';
            render_view('register', compact('erro', 'success'));
            return;
        }

        // Username = part before @ of email
        $username = preg_replace('/[^a-zA-Z0-9._-]/', '', explode('@', $email)[0]);
        if (!$username) $username = 'user' . bin2hex(random_bytes(3));

        // Check duplicates
        if ($this->userRepo->findByEmail($email) || $this->userRepo->findByUsername($username)) {
            $erro = 'Este e-mail já está cadastrado.';
            render_view('register', compact('erro', 'success'));
            return;
        }

        $pdo = Database::getConnection();
        try {
            $pdo->beginTransaction();

            $userId  = bin2hex(random_bytes(16));
            $bandaId = bin2hex(random_bytes(16));
            $trialExpira = date('Y-m-d', strtotime('+30 days'));

            // Create user (inactive until password is set)
            $this->userRepo->save([
                'id'             => $userId,
                'nome'           => $nome,
                'username'       => $username,
                'email'          => $email,
                'senha_hash'     => null,
                'perfil'         => 'usuario',
                'ativo'          => 0,
                'validade'       => null,
                'plano'          => 'trial',
                'trial_expira_em'=> $trialExpira,
            ]);

            // Create band on gratuito plan (30-day free, with resource limits)
            $this->bandaRepo->save([
                'id'             => $bandaId,
                'nome'           => $bandaNome,
                'ativo'          => 1,
                'plano'          => 'gratuito',
                'trial_expira_em'=> $trialExpira,
            ]);

            // Link user → band as administrator
            $this->userRepo->importToBanda($userId, $bandaId, 'administrador');

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
                ['nome' => $nome, 'email' => $email, 'username' => $username],
                ['nome' => $bandaNome],
                $token
            );
        } catch (Exception $e) {
            // Log but don't block user — they can request resend later
        }

        $success = true;
        render_view('register', compact('erro', 'success', 'email'));
    }
}
