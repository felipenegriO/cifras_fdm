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
    private BandaConviteRepository $convites;

    public function __construct(UserRepository $users, BandaRepository $bandas, ?BandaConviteRepository $convites = null)
    {
        $this->users = $users;
        $this->bandas = $bandas;
        $this->convites = $convites ?? new BandaConviteRepository();
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
     * @param array $googlePayload payload já verificado por GoogleJwtVerifier (sub, email, email_verified, name).
     * @param array{token: string, banda_id: string}|null $convite convite pendente já validado
     *        (BandaConviteFlow::bandaAbertaParaConvite) por quem chama; quando presente, um
     *        usuário novo entra NELA em vez de ganhar uma banda própria.
     * @return array user row shaped like UserRepository::findByEmail()'s return.
     */
    public function resolveOrCreateUser(array $googlePayload, ?array $convite = null): array
    {
        if (($googlePayload['email_verified'] ?? false) !== true) {
            throw new \RuntimeException('E-mail do Google não verificado.');
        }

        $sub = (string) $googlePayload['sub'];
        $email = strtolower(trim((string) $googlePayload['email']));
        $name = trim((string) ($googlePayload['name'] ?? $email));

        $byGoogleSub = $this->users->findByGoogleSub($sub);
        if ($byGoogleSub) {
            if (!($byGoogleSub['ativo'] ?? 1)) {
                throw new \RuntimeException('Conta desativada.');
            }
            return $byGoogleSub;
        }

        $byEmail = $this->users->findByEmail($email);
        if ($byEmail) {
            if (!($byEmail['ativo'] ?? 1)) {
                throw new \RuntimeException('Conta desativada.');
            }
            $this->users->linkGoogleSub($byEmail['id'], $sub);
            return $byEmail;
        }

        return $this->createUserAndBanda($sub, $email, $name, $convite);
    }

    private function createUserAndBanda(string $sub, string $email, string $name, ?array $convite = null): array
    {
        $userId = bin2hex(random_bytes(16));
        $nome = $name !== '' ? $name : $email;
        $conviteBandaId = $convite['banda_id'] ?? null;

        // Convite: entra na banda que convidou, como básico. Sem convite:
        // ganha a própria banda e é administrador dela.
        if ($conviteBandaId !== null && $conviteBandaId !== '') {
            $bandas = [['id' => $conviteBandaId, 'perfil' => BandaConvitePolicy::PERFIL]];
        } else {
            $bandaId = bin2hex(random_bytes(16));
            $bandaNome = $name !== '' ? $name . "'s Band" : 'Minha Banda';

            // A banda precisa existir antes do vínculo por causa da FK de usuario_banda.
            $this->bandas->save([
                'id' => $bandaId,
                'nome' => $bandaNome,
                'ativo' => 1,
                'plano' => 'gratuito',
                'trial_expira_em' => null,
            ]);
            $bandas = [['id' => $bandaId, 'perfil' => 'administrador']];
        }

        $this->users->save([
            'id' => $userId,
            'nome' => $nome,
            'email' => $email,
            'senha_hash' => null,
            'perfil' => 'usuario',
            'ativo' => 1,
            'validade' => null,
            'google_sub' => $sub,
            'bandas' => $bandas,
        ]);

        if ($conviteBandaId === null || $conviteBandaId === '') {
            $this->bandas->definirCriador($bandas[0]['id'], $userId);
        } else {
            $this->convites->registrarUso((string) $convite['token']);
        }

        return [
            'id' => $userId,
            'nome' => $nome,
            'email' => $email,
            'perfil' => 'usuario',
            'validade' => '',
            'config' => [],
            'bandas' => $bandas,
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
