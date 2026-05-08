<?php
class LiveStateService {
    private $filePath;
    private $hostTimeoutSeconds = 60;

    public function __construct($filePath) {
        $this->filePath = $filePath;
    }

    public function assumirHost($salaId, $usuario = []) {
        try {
            $salaId = $this->validarSalaId($salaId);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            return ['success' => false, 'message' => $e->getMessage()];
        }

        $hostId = $this->novoHostId();
        $now = gmdate('c');

        return $this->withLockedState(LOCK_EX, function ($data) use ($salaId, $hostId, $usuario, $now) {
            $state = $this->getSalaState($data, $salaId);
            $state['hostId'] = $hostId;
            $state['hostUserId'] = (string)($usuario['id'] ?? '');
            $state['hostUsername'] = (string)($usuario['username'] ?? '');
            $state['updatedAt'] = $now;
            $state['version'] = ((int)($state['version'] ?? 0)) + 1;

            $data['salas'][$salaId] = $state;

            return [
                'data' => $data,
                'result' => [
                    'success' => true,
                    'hostId' => $hostId,
                    'message' => 'Voce agora e o host'
                ]
            ];
        });
    }

    public function atualizar($salaId, $hostId, $cifraAtual, $paginaAtual, $keepAlive = false) {
        try {
            $salaId = $this->validarSalaId($salaId);
            $hostId = $this->validarHostId($hostId);
            $cifraAtual = $this->validarCifraAtual($cifraAtual);
            $paginaAtual = $this->validarPaginaAtual($paginaAtual, $cifraAtual);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            return ['success' => false, 'message' => $e->getMessage()];
        }

        $keepAlive = (bool) $keepAlive;
        $now = gmdate('c');

        return $this->withLockedState(LOCK_EX, function ($data) use ($salaId, $hostId, $cifraAtual, $paginaAtual, $keepAlive, $now) {
            $state = $this->getSalaState($data, $salaId);

            if (($state['hostId'] ?? '') === '' || !hash_equals((string)$state['hostId'], $hostId)) {
                http_response_code(403);
                return [
                    'data' => $data,
                    'result' => [
                        'success' => false,
                        'message' => 'Apenas o host atual pode atualizar a live'
                    ]
                ];
            }

            $changed = (string)($state['cifraAtual'] ?? '') !== $cifraAtual
                || (string)($state['paginaAtual'] ?? '') !== $paginaAtual;

            if ($changed) {
                $state['cifraAtual'] = $cifraAtual;
                $state['paginaAtual'] = $paginaAtual;
                $state['version'] = ((int)($state['version'] ?? 0)) + 1;
            }

            if ($changed || $keepAlive) {
                $state['updatedAt'] = $now;
            }

            $data['salas'][$salaId] = $state;

            return [
                'data' => $data,
                'result' => [
                    'success' => true,
                    'salaId' => $salaId,
                    'cifraAtual' => $state['cifraAtual'],
                    'paginaAtual' => $state['paginaAtual'],
                    'updatedAt' => $state['updatedAt'],
                    'version' => (int)$state['version']
                ]
            ];
        });
    }

    public function status($salaId) {
        try {
            $salaId = $this->validarSalaId($salaId);
        } catch (InvalidArgumentException $e) {
            http_response_code(400);
            return ['success' => false, 'message' => $e->getMessage()];
        }

        return $this->withLockedState(LOCK_SH, function ($data) use ($salaId) {
            $state = $this->getSalaState($data, $salaId);
            $hasHost = $this->hostAindaAtivo($state);

            return [
                'data' => $data,
                'result' => [
                    'success' => true,
                    'salaId' => $salaId,
                    'cifraAtual' => (string)($state['cifraAtual'] ?? ''),
                    'paginaAtual' => (string)($state['paginaAtual'] ?? ''),
                    'updatedAt' => (string)($state['updatedAt'] ?? ''),
                    'version' => (int)($state['version'] ?? 0),
                    'hasHost' => $hasHost
                ]
            ];
        });
    }

    private function withLockedState($lockType, callable $callback) {
        $dir = dirname($this->filePath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $handle = fopen($this->filePath, 'c+');
        if (!$handle) {
            http_response_code(500);
            return ['success' => false, 'message' => 'Nao foi possivel abrir o estado da live'];
        }

        try {
            if (!flock($handle, $lockType)) {
                http_response_code(500);
                return ['success' => false, 'message' => 'Nao foi possivel bloquear o estado da live'];
            }

            rewind($handle);
            $raw = stream_get_contents($handle);
            $data = $this->decodeState($raw);

            $callbackResult = $callback($data);
            $newData = $callbackResult['data'] ?? $data;
            $result = $callbackResult['result'] ?? null;

            if ($lockType === LOCK_EX) {
                rewind($handle);
                ftruncate($handle, 0);
                fwrite($handle, json_encode($newData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
                fflush($handle);
            }

            flock($handle, LOCK_UN);
            fclose($handle);

            return $result;
        } catch (InvalidArgumentException $e) {
            flock($handle, LOCK_UN);
            fclose($handle);
            http_response_code(400);
            return ['success' => false, 'message' => $e->getMessage()];
        } catch (Throwable $e) {
            flock($handle, LOCK_UN);
            fclose($handle);
            http_response_code(500);
            return ['success' => false, 'message' => 'Erro ao processar a live'];
        }
    }

    private function decodeState($raw) {
        if (trim((string)$raw) === '') {
            return ['salas' => []];
        }

        $data = json_decode($raw, true);
        if (!is_array($data)) {
            return ['salas' => []];
        }

        if (!isset($data['salas']) || !is_array($data['salas'])) {
            return ['salas' => []];
        }

        return $data;
    }

    private function getSalaState($data, $salaId) {
        $state = $data['salas'][$salaId] ?? [];
        if (!is_array($state)) {
            $state = [];
        }

        return array_merge([
            'salaId' => $salaId,
            'hostId' => '',
            'hostUserId' => '',
            'hostUsername' => '',
            'cifraAtual' => '',
            'paginaAtual' => 'index.php',
            'updatedAt' => '',
            'version' => 0
        ], $state);
    }

    private function hostAindaAtivo($state) {
        if (($state['hostId'] ?? '') === '' || ($state['updatedAt'] ?? '') === '') {
            return false;
        }

        $updatedAt = strtotime((string)$state['updatedAt']);
        if (!$updatedAt) {
            return false;
        }

        return (time() - $updatedAt) <= $this->hostTimeoutSeconds;
    }

    private function validarSalaId($value) {
        $value = trim((string)$value);
        if ($value === '') {
            $value = 'default';
        }

        if (!preg_match('/^[a-zA-Z0-9_-]{1,40}$/', $value)) {
            throw new InvalidArgumentException('Sala invalida');
        }

        return $value;
    }

    private function validarHostId($value) {
        $value = trim((string)$value);
        if (!preg_match('/^[a-f0-9]{32,64}$/i', $value)) {
            throw new InvalidArgumentException('Host invalido');
        }

        return $value;
    }

    private function validarCifraAtual($value) {
        $value = trim((string)$value);
        if ($value === '') {
            return '';
        }

        if (!preg_match('/^\d{1,8}$/', $value)) {
            throw new InvalidArgumentException('Cifra invalida');
        }

        return $value;
    }

    private function validarPaginaAtual($value, $cifraAtual) {
        $value = trim((string)$value);
        $value = str_replace('\\', '/', $value);

        if ($value === '') {
            return $cifraAtual !== '' ? 'music.php?id=' . $cifraAtual : 'index.php';
        }

        if (strpos($value, '..') !== false || strpos($value, '/') !== false || preg_match('/^[a-z]+:/i', $value)) {
            throw new InvalidArgumentException('Pagina invalida');
        }

        if ($value === 'index.php') {
            if ($cifraAtual !== '') {
                throw new InvalidArgumentException('Pagina e cifra nao conferem');
            }
            return $value;
        }

        if (preg_match('/^music\.php\?id=(\d{1,8})$/', $value, $matches)) {
            if ($cifraAtual !== '' && $cifraAtual !== $matches[1]) {
                throw new InvalidArgumentException('Pagina e cifra nao conferem');
            }
            return $value;
        }

        if (preg_match('/^roteiro\.php\?id=\d{1,8}$/', $value)) {
            if ($cifraAtual !== '') {
                throw new InvalidArgumentException('Pagina e cifra nao conferem');
            }
            return $value;
        }

        throw new InvalidArgumentException('Pagina invalida');
    }

    private function novoHostId() {
        if (function_exists('random_bytes')) {
            return bin2hex(random_bytes(16));
        }

        return md5(uniqid('', true));
    }
}
