<?php
/**
 * PasswordResetFlow — orchestrates public/reset-senha.php's GET/POST logic,
 * extracted so the branching (validation, token consumption, session reset)
 * is unit testable with a mocked UserRepository.
 */
class PasswordResetFlow
{
    private UserRepository $repo;
    private ?AuthTokenRepository $authTokens;

    public function __construct(UserRepository $repo, ?AuthTokenRepository $authTokens = null)
    {
        $this->repo = $repo;
        $this->authTokens = $authTokens;
    }

    /** GET: is the token still valid to show the form? Returns an error message, or null if OK. */
    public function checkTokenForDisplay(string $token): ?string
    {
        if (!$token || !$this->repo->peekToken($token)) {
            return 'Link inválido ou expirado.';
        }
        return null;
    }

    /**
     * POST: validates the new password, consumes the token, and updates it.
     * @return array{erro: ?string, ok: bool, userId: ?string, tokenInvalido: bool}
     */
    public function handleSubmit(string $token, string $senha, string $senha2): array
    {
        $erro = PasswordResetValidator::validateNewPassword($senha, $senha2);
        if ($erro !== null) {
            return ['erro' => $erro, 'ok' => false, 'userId' => null, 'tokenInvalido' => false];
        }

        $userId = $this->repo->consumeToken($token);
        if (!$userId) {
            return ['erro' => 'Link inválido ou expirado. Solicite um novo.', 'ok' => false, 'userId' => null, 'tokenInvalido' => true];
        }

        $this->repo->updatePassword($userId, password_hash($senha, PASSWORD_DEFAULT));

        // Trocar a senha derruba os "lembrar-me" de todos os aparelhos: é a
        // expectativa de quem troca a senha justamente por suspeitar de acesso
        // indevido.
        ($this->authTokens ?? new AuthTokenRepository())->revogarTodosDoUsuario($userId);

        return ['erro' => null, 'ok' => true, 'userId' => $userId, 'tokenInvalido' => false];
    }
}
