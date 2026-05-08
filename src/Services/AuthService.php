<?php
class AuthService {
    private $userRepository;

    public function __construct(UserRepository $userRepository) {
        $this->userRepository = $userRepository;
    }

    public function authenticate($username, $password) {
        $user = $this->userRepository->findByUsername($username);
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

        return [
            'user' => $user,
            'error' => null
        ];
    }
}
