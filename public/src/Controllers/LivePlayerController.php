<?php
class LivePlayerController {
    private $filePath;

    public function __construct($filePath) {
        $this->filePath = $filePath;
    }

    public function read() {
        require_auth();
        if (file_exists($this->filePath)) {
            echo file_get_contents($this->filePath);
            return;
        }

        echo '0';
    }

    public function save() {
        require_auth();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo 'Método não permitido.';
            return;
        }

        $numero = $_POST['numero'] ?? null;
        if ($numero !== null) {
            file_put_contents($this->filePath, $numero);
            echo 'OK';
            return;
        }

        http_response_code(400);
        echo 'Número não enviado.';
    }
}
