<?php
class PlaylistController {
    private $outputPath;

    public function __construct($outputPath) {
        $this->outputPath = $outputPath;
    }

    public function save(?string $requestBody = null) {
        require_admin();
        if (!headers_sent()) header('Content-Type: application/json');

        $entrada = $requestBody ?? file_get_contents('php://input');
        $data = json_decode($entrada, true);

        if (!$data) {
            http_response_code(400);
            echo json_encode(["sucesso" => false, "mensagem" => "JSON inválido."]);
            return;
        }

        $dadosParaSalvar = [];
        if (isset($data['playlists']) && is_array($data['playlists'])) {
            $dadosParaSalvar = $data['playlists'];
        } elseif (is_array($data)) {
            $playlistsFormatadas = [];
            foreach ($data as $nome => $itens) {
                if (is_array($itens)) {
                    $playlistsFormatadas[] = ["nome" => $nome, "itens" => $itens];
                }
            }
            $dadosParaSalvar = $playlistsFormatadas;
        } else {
            http_response_code(400);
            echo json_encode(["sucesso" => false, "mensagem" => "Estrutura inválida."]);
            return;
        }

        $conteudoJs = "const playlistsSalvas = " . json_encode($dadosParaSalvar, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . ";";
        cifro_backup_file($this->outputPath);
        $sucessoJs = @file_put_contents($this->outputPath, $conteudoJs);

        if ($sucessoJs !== false) {
            cifro_bump_cache_version();
            echo json_encode(["sucesso" => true, "mensagem" => "Playlists salvas com sucesso!"]);
            return;
        }

        http_response_code(500);
        echo json_encode(["sucesso" => false, "mensagem" => "Erro ao salvar o arquivo JS."]);
    }
}
