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

        if ($this->isExpired($user)) {
            return [
                'user' => null,
                'error' => 'Usuario temporario expirado.'
            ];
        }

        if ($this->isExternalWithoutExpiration($user)) {
            return [
                'user' => null,
                'error' => 'Usuario externo sem validade configurada.'
            ];
        }

        return [
            'user' => $user,
            'error' => null
        ];
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
