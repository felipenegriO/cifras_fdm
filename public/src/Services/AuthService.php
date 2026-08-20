<?php
class AuthService {
    private $userRepository;

    public function __construct(UserRepository $userRepository) {
        $this->userRepository = $userRepository;
    }

    public function authenticate($login, $password) {
        $user = $this->userRepository->findByEmail($login);
        if (!$user) {
            return [
                'user' => null,
                'error' => 'Usuário ou senha inválidos.'
            ];
        }

        $ativo = (bool)($user['ativo'] ?? false);
        $hash = $user['senhaHash'] ?? null;

        if (!$ativo) {
            return [
                'user' => null,
                'error' => 'Usuário inativo.'
            ];
        }

        if (!$hash || !password_verify($password, $hash)) {
            return [
                'user' => null,
                'error' => 'Usuário ou senha inválidos.'
            ];
        }

        $barreira = $this->motivoParaRecusarConta($user);
        if ($barreira !== null) {
            return ['user' => null, 'error' => $barreira];
        }

        return [
            'user' => $user,
            'error' => null
        ];
    }

    /**
     * Barreiras de conta que valem para QUALQUER forma de autenticar, não só
     * senha: conta desativada, usuário temporário vencido, externo sem validade.
     * Público porque o login por token "lembrar-me" (bootstrap.php) precisa
     * aplicar exatamente as mesmas regras — sem isso, desativar um músico não
     * tiraria o acesso dele.
     *
     * @return string|null mensagem do motivo, ou null se a conta pode entrar
     */
    public function motivoParaRecusarConta($user): ?string {
        if (!(bool)($user['ativo'] ?? false)) {
            return 'Usuário inativo.';
        }
        if ($this->isExpired($user)) {
            return 'Usuario temporario expirado.';
        }
        if ($this->isExternalWithoutExpiration($user)) {
            return 'Usuario externo sem validade configurada.';
        }
        return null;
    }

    private function isExpired($user) {
        $validade = trim((string)($user['validade'] ?? ''));
        if ($validade === '') {
            return false;
        }

        $timezone = new DateTimeZone('America/Sao_Paulo');
        $dataValidade = DateTimeImmutable::createFromFormat('!Y-m-d', $validade, $timezone);
        if (!$dataValidade) {
            return false;
        }

        $hoje = new DateTimeImmutable('today', $timezone);
        return $dataValidade < $hoje;
    }

    private function isExternalWithoutExpiration($user) {
        $perfil = strtolower(trim((string)($user['perfil'] ?? 'administrador')));
        $validade = trim((string)($user['validade'] ?? ''));
        return $perfil === 'externo' && $validade === '';
    }
}
