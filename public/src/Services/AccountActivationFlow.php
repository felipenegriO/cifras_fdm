<?php
/**
 * AccountActivationFlow — orchestrates public/definir-senha.php's GET/POST
 * logic (token check, activation, auto-login session build, redirect
 * target), extracted so the branching is unit testable with mocked repos.
 */
class AccountActivationFlow
{
    private UserRepository $users;
    private BandaRepository $bandas;

    public function __construct(UserRepository $users, ?BandaRepository $bandas = null)
    {
        $this->users = $users;
        $this->bandas = $bandas ?? new BandaRepository();
    }

    /** GET: is the token still valid to show the form? Returns an error message, or null if OK. */
    public function checkTokenForDisplay(string $token): ?string
    {
        if (!$token || !$this->users->peekToken($token)) {
            return 'Link inválido ou expirado. Solicite um novo.';
        }
        return null;
    }

    /**
     * POST: validates the new password, activates the account, and builds
     * the session data for auto-login.
     * @return array{erro: ?string, ok: bool, session: ?array, redirect: ?string}
     */
    public function handleSubmit(string $token, string $senha, string $senha2): array
    {
        $erro = PasswordResetValidator::validateNewPassword($senha, $senha2);
        if ($erro !== null) {
            return ['erro' => $erro, 'ok' => false, 'session' => null, 'redirect' => null];
        }

        $userId = $this->users->consumeToken($token);
        if (!$userId) {
            return ['erro' => 'Link inválido ou expirado. Solicite um novo.', 'ok' => false, 'session' => null, 'redirect' => null];
        }

        $hash = password_hash($senha, PASSWORD_DEFAULT);
        $this->users->activate($userId, $hash);

        $user = $this->users->findById($userId);
        if (!$user) {
            return ['erro' => null, 'ok' => true, 'session' => null, 'redirect' => null];
        }

        $bandasDoUsuario = $this->users->getBandasDoUsuario($userId);
        $session = [
            'autenticado' => true,
            'usuario' => [
                'id'       => $user['id'],
                'nome'     => $user['nome'],
                'email'    => $user['email'] ?? '',
                'perfil'   => $user['perfil'],
                'validade' => $user['validade'] ?? '',
                'config'   => $user['config'] ?? [],
                'bandas'   => array_map(fn($b) => ['id' => $b['id'], 'perfil' => $b['usuario_perfil']], $bandasDoUsuario),
            ],
        ];

        $redirect = '/select-banda.php';
        if (count($bandasDoUsuario) === 1) {
            $redirect = '/index.php';
            $banda = $this->bandas->findById($bandasDoUsuario[0]['id']);
            if ($banda) {
                $session['banda_atual'] = [
                    'id'              => $banda['id'],
                    'nome'            => $banda['nome'],
                    'perfil'          => $bandasDoUsuario[0]['usuario_perfil'],
                    'plano'           => $banda['plano'],
                    'trial_expira_em' => $banda['trial_expira_em'],
                    'logo'            => $banda['logo'] ?? null,
                ];
            }
        }

        return ['erro' => null, 'ok' => true, 'session' => $session, 'redirect' => $redirect];
    }
}
