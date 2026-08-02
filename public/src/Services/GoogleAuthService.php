<?php
/**
 * GoogleAuthService — token exchange + login-or-signup decision for
 * "Continuar com Google". Mirrors RegisterController's account+band
 * creation so both signup paths stay in sync.
 */
class GoogleAuthService
{
    private UserRepository $users;
    private BandaRepository $bandas;

    public function __construct(UserRepository $users, BandaRepository $bandas)
    {
        $this->users = $users;
        $this->bandas = $bandas;
    }

    /**
     * @param callable|null $httpPost fn(string $url, array $formFields): array — decoded JSON response.
     */
    public function exchangeCodeForIdToken(string $code, string $clientId, string $clientSecret, string $redirectUri, ?callable $httpPost = null): string
    {
        $httpPost = $httpPost ?? [$this, 'postFormReal'];
        $response = $httpPost('https://oauth2.googleapis.com/token', [
            'code' => $code,
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri' => $redirectUri,
            'grant_type' => 'authorization_code',
        ]);

        if (empty($response['id_token'])) {
            throw new \RuntimeException('Google não retornou um id_token válido.');
        }
        return $response['id_token'];
    }

    /**
     * @param array $googlePayload verified GoogleJwtVerifier payload (sub, email, email_verified, name).
     * @return array user row shaped like UserRepository::findByEmail()'s return.
     */
    public function resolveOrCreateUser(array $googlePayload): array
    {
        if (($googlePayload['email_verified'] ?? false) !== true) {
            throw new \RuntimeException('E-mail do Google não verificado.');
        }

        $sub = (string) $googlePayload['sub'];
        $email = strtolower(trim((string) $googlePayload['email']));
        $name = trim((string) ($googlePayload['name'] ?? $email));

        $byGoogleSub = $this->users->findByGoogleSub($sub);
        if ($byGoogleSub) {
            return $byGoogleSub;
        }

        $byEmail = $this->users->findByEmail($email);
        if ($byEmail) {
            $this->users->linkGoogleSub($byEmail['id'], $sub);
            return $byEmail;
        }

        return $this->createUserAndBanda($sub, $email, $name);
    }

    private function createUserAndBanda(string $sub, string $email, string $name): array
    {
        $userId = bin2hex(random_bytes(16));
        $bandaId = bin2hex(random_bytes(16));
        $bandaNome = $name !== '' ? $name . "'s Band" : 'Minha Banda';

        $this->users->save([
            'id' => $userId,
            'nome' => $name !== '' ? $name : $email,
            'email' => $email,
            'senha_hash' => null,
            'perfil' => 'usuario',
            'ativo' => 1,
            'validade' => null,
            'google_sub' => $sub,
            'bandas' => [['id' => $bandaId, 'perfil' => 'administrador']],
        ]);

        $this->bandas->save([
            'id' => $bandaId,
            'nome' => $bandaNome,
            'ativo' => 1,
            'plano' => 'gratuito',
            'trial_expira_em' => null,
        ]);

        return [
            'id' => $userId,
            'nome' => $name !== '' ? $name : $email,
            'email' => $email,
            'perfil' => 'usuario',
            'validade' => '',
            'config' => [],
            'bandas' => [['id' => $bandaId, 'perfil' => 'administrador']],
        ];
    }

    private function postFormReal(string $url, array $formFields): array
    {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query($formFields),
            'timeout' => 10,
            'ignore_errors' => true,
        ]]);
        $raw = @file_get_contents($url, false, $context);
        $decoded = $raw ? json_decode($raw, true) : null;
        return is_array($decoded) ? $decoded : [];
    }
}
