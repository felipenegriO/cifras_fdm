<?php
class UsersController {
    private $usersFile;

    public function __construct($usersFile) {
        $this->usersFile = $usersFile;
    }

    public function showEditor() {
        require_admin();
        render_view('users/editoruser');
    }

    public function handleSave() {
        require_admin();
        header('Content-Type: application/json; charset=utf-8');

        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            if (!file_exists($this->usersFile)) {
                echo json_encode([]);
                return;
            }

            $json = file_get_contents($this->usersFile);
            $data = json_decode($json, true);
            if (!is_array($data)) $data = [];

            echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            return;
        }

        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);

        if (!$payload || !isset($payload['usuarios']) || !is_array($payload['usuarios'])) {
            echo json_encode(['sucesso' => false, 'mensagem' => 'Payload inválido.']);
            return;
        }

        $usuarios = $payload['usuarios'];
        $usuariosFinal = [];

        foreach ($usuarios as $u) {
            $id = $u['id'] ?? null;
            $nome = trim((string) ($u['nome'] ?? ''));
            $username = trim((string) ($u['username'] ?? ''));
            $ativo = (bool) ($u['ativo'] ?? false);
            $validade = trim((string) ($u['validade'] ?? ''));
            $perfil = strtolower(trim((string) ($u['perfil'] ?? 'administrador')));

            if (!$id) $id = bin2hex(random_bytes(16));

            if ($nome === '' || $username === '') {
                echo json_encode(['sucesso' => false, 'mensagem' => 'Nome e username são obrigatórios.']);
                return;
            }

            if (preg_match('/\s/', $username) || !preg_match('/^[a-zA-Z0-9._-]+$/', $username)) {
                echo json_encode(['sucesso' => false, 'mensagem' => "Username inválido: {$username}"]);
                return;
            }

            if (!in_array($perfil, ['administrador', 'musico', 'externo'], true)) {
                echo json_encode(['sucesso' => false, 'mensagem' => "Perfil invalido para {$username}."]);
                return;
            }

            if ($perfil === 'externo' && $validade === '') {
                echo json_encode(['sucesso' => false, 'mensagem' => "Usuario externo precisa de data de validade: {$username}."]);
                return;
            }

            if ($validade !== '' && !$this->isValidDate($validade)) {
                echo json_encode(['sucesso' => false, 'mensagem' => "Data de validade invalida para {$username}."]);
                return;
            }

            $senhaHash = $u['senhaHash'] ?? null;
            $senhaPlain = $u['_senhaPlain'] ?? null;
            if (is_string($senhaPlain) && trim($senhaPlain) !== '') {
                $senhaHash = password_hash($senhaPlain, PASSWORD_DEFAULT);
            }

            $usuariosFinal[] = [
                'id' => $id,
                'nome' => $nome,
                'username' => $username,
                'ativo' => $ativo,
                'validade' => $validade,
                'perfil' => $perfil,
                'senhaHash' => $senhaHash
            ];
        }

        $usernames = [];
        foreach ($usuariosFinal as $u) {
            $key = strtolower($u['username']);
            if (isset($usernames[$key])) {
                echo json_encode(['sucesso' => false, 'mensagem' => "Username duplicado: {$u['username']}"]);
                return;
            }
            $usernames[$key] = true;
        }

        $json = json_encode($usuariosFinal, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($json === false) {
            echo json_encode(['sucesso' => false, 'mensagem' => 'Falha ao gerar JSON.']);
            return;
        }

        fdm_backup_file($this->usersFile);
        $ok = file_put_contents($this->usersFile, $json, LOCK_EX);
        if ($ok === false) {
            echo json_encode(['sucesso' => false, 'mensagem' => 'Falha ao salvar arquivo. Verifique permissões.']);
            return;
        }

        fdm_bump_cache_version();
        echo json_encode(['sucesso' => true, 'mensagem' => 'Usuários salvos com sucesso!']);
    }

    private function isValidDate($value) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return false;
        }

        [$year, $month, $day] = array_map('intval', explode('-', $value));
        return checkdate($month, $day, $year);
    }
}
