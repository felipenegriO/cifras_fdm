<?php
class SongController {
    private $songsFile;

    public function __construct($songsFile) {
        $this->songsFile = $songsFile;
    }

    public function save() {
        require_auth();
        header('Content-Type: application/json');

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            echo json_encode([
                'ok' => false,
                'error' => 'Erro ao decodificar JSON da requisição: ' . json_last_error_msg(),
                'raw' => $raw
            ]);
            return;
        }

        if (!isset($data['nome'], $data['cifra'])) {
            echo json_encode(['ok' => false, 'error' => 'Dados incompletos']);
            return;
        }

        $conteudo = file_get_contents($this->songsFile);
        $conteudo = trim($conteudo);
        $conteudo = preg_replace('/^var\s+songs\s*=\s*/', '', $conteudo);
        $conteudo = preg_replace('/;\s*$/', '', $conteudo);

        $conteudo = preg_replace('/(\b\w+\b)\s*:/', '"$1":', $conteudo);

        $conteudo = preg_replace_callback(
            "/'((?:[^'\\\\]|\\\\.)*)'/s",
            function($matches) {
                $str = $matches[1];
                $str = str_replace("\\'", "'", $str);
                $str = str_replace("\\\\", "\\", $str);
                $str = json_encode($str);
                $str = substr($str, 1, -1);
                return '"' . $str . '"';
            },
            $conteudo
        );

        $songs = json_decode($conteudo, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            echo json_encode([
                'ok' => false,
                'error' => 'Erro ao decodificar o conteúdo do arquivo: ' . json_last_error_msg(),
                'conteudo' => $conteudo
            ]);
            return;
        }

        $encontrado = false;
        $maiorId = 0;
        foreach ($songs as &$musica) {
            if (isset($musica['id']) && is_numeric($musica['id']) && $musica['id'] > $maiorId) {
                $maiorId = $musica['id'];
            }
            if ($musica['id'] == $data['id']) {
                $musica['nome'] = $data['nome'];
                $musica['cifra'] = $data['cifra'];
                $musica['bit'] = $data['bit'];
                $musica['artista'] = $data['artista'];
                $musica['classificacao'] = $data['classificacao'];
                $encontrado = true;
                break;
            }
        }

        if (!$encontrado) {
            $data['id'] = $maiorId + 1;
            $songs[] = $data;
        }

        $novoConteudo = json_encode($songs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $novoConteudo = preg_replace('/"(\w+)"\s*:/', '$1:', $novoConteudo);

        $novoConteudo = preg_replace_callback(
            '/"(.*?)"/s',
            function ($m) {
                $str = $m[1];
                $str = str_replace("'", "\\'", $str);
                $str = str_replace('\\"', '"', $str);
                return "'$str'";
            },
            $novoConteudo
        );

        $novoConteudo = 'var songs = ' . $novoConteudo . ';';
        file_put_contents($this->songsFile, $novoConteudo);

        echo json_encode(['ok' => true]);
    }
}
