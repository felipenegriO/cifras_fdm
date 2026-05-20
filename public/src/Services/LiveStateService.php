<?php
/**
 * LiveStateService — orchestrates live mode state.
 *
 * Accepts either a LiveStateRepository (MySQL, recommended) or a legacy
 * $filePath string (file-based, kept for backwards compat).
 */
class LiveStateService {
    private $repo;           // LiveStateRepository (MySQL path)
    private $filePath;       // legacy file path (null when using repo)
    private int $hostTimeoutSeconds = 60;

    public function __construct($backendOrFilePath) {
        if ($backendOrFilePath instanceof LiveStateRepository) {
            $this->repo     = $backendOrFilePath;
            $this->filePath = null;
        } else {
            $this->repo     = null;
            $this->filePath = (string)$backendOrFilePath;
        }
    }

    // ------------------------------------------------------------------ //
    //  Public API
    // ------------------------------------------------------------------ //

    public function assumirHost(string $salaId, array $usuario = []): array {
        try { $salaId = $this->validarSalaId($salaId); }
        catch (InvalidArgumentException $e) { return $this->err400($e->getMessage()); }

        $hostId = $this->novoHostId();
        $now    = gmdate('c');

        return $this->withState($salaId, LOCK_EX, function ($state) use ($salaId, $hostId, $usuario, $now) {
            $state['hostId']       = $hostId;
            $state['hostUserId']   = (string)($usuario['id']       ?? '');
            $state['hostUsername'] = (string)($usuario['username'] ?? '');
            $state['hostNome']     = (string)($usuario['nome']     ?? '');
            $state['updatedAt']    = $now;
            $state['version']      = ((int)($state['version'] ?? 0)) + 1;
            return [
                'state'  => $state,
                'result' => [
                    'success'      => true,
                    'hostId'       => $hostId,
                    'hostNome'     => $state['hostNome'],
                    'hostUsername' => $state['hostUsername'],
                    'message'      => 'Voce agora e o host',
                ],
            ];
        });
    }

    public function atualizar(string $salaId, string $hostId, $cifraAtual, $paginaAtual, bool $keepAlive = false, $scrollTop = null, $scrollPercent = null, $canSyncScroll = null): array {
        try {
            $salaId = $this->validarSalaId($salaId);
            $hostId = $this->validarHostId($hostId);
        } catch (InvalidArgumentException $e) { return $this->err400($e->getMessage()); }

        $somenteKeepAlive = $keepAlive && $cifraAtual === null && $paginaAtual === null;

        if (!$somenteKeepAlive) {
            try {
                $cifraAtual  = $this->validarCifraAtual($cifraAtual);
                $paginaAtual = $this->validarPaginaAtual($paginaAtual, $cifraAtual);
            } catch (InvalidArgumentException $e) { return $this->err400($e->getMessage()); }
        }

        $now          = gmdate('c');
        $scrollTop    = $scrollTop    === null ? null : max(0, (int)$scrollTop);
        $scrollPercent= $scrollPercent=== null ? null : max(0, min(1, (float)$scrollPercent));

        return $this->withState($salaId, LOCK_EX, function ($state) use ($salaId, $hostId, $cifraAtual, $paginaAtual, $keepAlive, $somenteKeepAlive, $now, $scrollTop, $scrollPercent, $canSyncScroll) {
            if (($state['hostId'] ?? '') === '' || !hash_equals((string)$state['hostId'], $hostId)) {
                http_response_code(403);
                return ['state' => $state, 'result' => ['success' => false, 'message' => 'Apenas o host atual pode atualizar a live']];
            }

            $changed = !$somenteKeepAlive && (
                (string)($state['cifraAtual'] ?? '') !== (string)$cifraAtual
                || (string)($state['paginaAtual'] ?? '') !== (string)$paginaAtual
            );

            if ($changed) {
                $state['cifraAtual']  = $cifraAtual;
                $state['paginaAtual'] = $paginaAtual;
                $state['version']     = ((int)($state['version'] ?? 0)) + 1;
            }
            if ($canSyncScroll !== null) $state['canSyncScroll'] = (bool)$canSyncScroll;
            if ($scrollTop    !== null)  $state['scrollTop']     = $scrollTop;
            if ($scrollPercent!== null)  $state['scrollPercent'] = $scrollPercent;
            if ($changed || $keepAlive) $state['updatedAt'] = $now;

            return [
                'state'  => $state,
                'result' => [
                    'success'       => true,
                    'salaId'        => $salaId,
                    'cifraAtual'    => (string)($state['cifraAtual']  ?? ''),
                    'paginaAtual'   => (string)($state['paginaAtual'] ?? ''),
                    'updatedAt'     => (string)($state['updatedAt']   ?? ''),
                    'version'       => (int)($state['version']        ?? 0),
                    'scrollTop'     => (int)($state['scrollTop']      ?? 0),
                    'scrollPercent' => (float)($state['scrollPercent']?? 0),
                    'canSyncScroll' => !empty($state['canSyncScroll']),
                    'hostNome'      => (string)($state['hostNome']    ?? ''),
                    'hostUsername'  => (string)($state['hostUsername']?? ''),
                ],
            ];
        });
    }

    public function status(string $salaId): array {
        try { $salaId = $this->validarSalaId($salaId); }
        catch (InvalidArgumentException $e) { return $this->err400($e->getMessage()); }

        return $this->withState($salaId, LOCK_SH, function ($state) use ($salaId) {
            $hasHost = $this->hostAindaAtivo($state);
            return [
                'state'  => $state,
                'result' => [
                    'success'       => true,
                    'salaId'        => $salaId,
                    'cifraAtual'    => (string)($state['cifraAtual']  ?? ''),
                    'paginaAtual'   => (string)($state['paginaAtual'] ?? ''),
                    'updatedAt'     => (string)($state['updatedAt']   ?? ''),
                    'version'       => (int)($state['version']        ?? 0),
                    'hasHost'       => $hasHost,
                    'scrollTop'     => (int)($state['scrollTop']      ?? 0),
                    'scrollPercent' => (float)($state['scrollPercent']?? 0),
                    'canSyncScroll' => !empty($state['canSyncScroll']),
                    'hostNome'      => $hasHost ? (string)($state['hostNome']    ?? '') : '',
                    'hostUsername'  => $hasHost ? (string)($state['hostUsername']?? '') : '',
                ],
            ];
        });
    }

    // ------------------------------------------------------------------ //
    //  Backend dispatch
    // ------------------------------------------------------------------ //

    private function withState(string $salaId, int $lockType, callable $cb): array {
        if ($this->repo) {
            return $this->withRepoState($salaId, $cb);
        }
        return $this->withLockedFileState($salaId, $lockType, $cb);
    }

    private function withRepoState(string $salaId, callable $cb): array {
        $raw   = $this->repo->get($salaId);
        $state = $this->normaliseRepoRow($raw);

        try {
            $out    = $cb($state);
            $newState = $out['state'] ?? $state;
            $result   = $out['result'] ?? null;

            // Persist only on write operations
            if (isset($out['state'])) {
                $this->repo->update($salaId, $this->stateToRepoFields($newState));
            }
            return $result;
        } catch (Throwable $e) {
            http_response_code(500);
            return ['success' => false, 'message' => 'Erro ao processar a live'];
        }
    }

    private function normaliseRepoRow(array $row): array {
        return [
            'hostId'        => $row['host_id']        ?? '',
            'hostUserId'    => $row['host_user_id']   ?? '',
            'hostUsername'  => $row['host_username']  ?? '',
            'hostNome'      => $row['host_nome']      ?? '',
            'cifraAtual'    => $row['cifra_atual']    ?? '',
            'paginaAtual'   => $row['pagina_atual']   ?? 'index.php',
            'scrollTop'     => (int)($row['scrollTop'] ?? $row['scroll_top'] ?? 0),
            'scrollPercent' => (float)($row['scrollPercent'] ?? $row['scroll_percent'] ?? 0),
            'canSyncScroll' => (bool)($row['can_sync_scroll'] ?? true),
            'updatedAt'     => $row['updated_at'] ?? '',
            'version'       => (int)($row['version'] ?? 0),
        ];
    }

    private function stateToRepoFields(array $state): array {
        return [
            'host_id'        => $state['hostId']       ?? null,
            'host_user_id'   => $state['hostUserId']   ?? null,
            'host_username'  => $state['hostUsername'] ?? null,
            'host_nome'      => $state['hostNome']     ?? null,
            'cifra_atual'    => $state['cifraAtual']   ?? '',
            'pagina_atual'   => $state['paginaAtual']  ?? 'index.php',
            'scroll_top'     => (int)($state['scrollTop']    ?? 0),
            'scroll_percent' => (float)($state['scrollPercent']?? 0),
            'can_sync_scroll'=> isset($state['canSyncScroll']) ? (int)(bool)$state['canSyncScroll'] : 1,
        ];
    }

    // ------------------------------------------------------------------ //
    //  Legacy file-based backend (kept for fallback)
    // ------------------------------------------------------------------ //

    private function withLockedFileState(string $salaId, int $lockType, callable $cb): array {
        $dir = dirname($this->filePath);
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        $handle = fopen($this->filePath, 'c+');
        if (!$handle) { http_response_code(500); return ['success' => false, 'message' => 'Nao foi possivel abrir o estado da live']; }

        try {
            if (!flock($handle, $lockType)) { http_response_code(500); return ['success' => false, 'message' => 'Lock falhou']; }

            rewind($handle);
            $raw  = stream_get_contents($handle);
            $data = $this->decodeFileState($raw);
            $state = $this->getSalaState($data, $salaId);

            $out      = $cb($state);
            $newState = $out['state'] ?? $state;
            $result   = $out['result'] ?? null;

            if ($lockType === LOCK_EX) {
                $data['salas'][$salaId] = $newState;
                rewind($handle);
                ftruncate($handle, 0);
                fwrite($handle, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
                fflush($handle);
            }

            flock($handle, LOCK_UN);
            fclose($handle);
            return $result;
        } catch (Throwable $e) {
            flock($handle, LOCK_UN);
            fclose($handle);
            http_response_code(500);
            return ['success' => false, 'message' => 'Erro ao processar a live'];
        }
    }

    private function decodeFileState(string $raw): array {
        if (trim($raw) === '') return ['salas' => []];
        $data = json_decode($raw, true);
        return (is_array($data) && isset($data['salas'])) ? $data : ['salas' => []];
    }

    private function getSalaState(array $data, string $salaId): array {
        $state = $data['salas'][$salaId] ?? [];
        return array_merge([
            'hostId' => '', 'hostUserId' => '', 'hostUsername' => '', 'hostNome' => '',
            'cifraAtual' => '', 'paginaAtual' => 'index.php',
            'scrollTop' => 0, 'scrollPercent' => 0, 'canSyncScroll' => false,
            'updatedAt' => '', 'version' => 0,
        ], is_array($state) ? $state : []);
    }

    // ------------------------------------------------------------------ //
    //  Validation
    // ------------------------------------------------------------------ //

    private function hostAindaAtivo(array $state): bool {
        if (($state['hostId'] ?? '') === '' || ($state['updatedAt'] ?? '') === '') return false;
        $ts = strtotime((string)$state['updatedAt']);
        return $ts && (time() - $ts) <= $this->hostTimeoutSeconds;
    }

    private function validarSalaId(string $value): string {
        $value = trim($value);
        if ($value === '') $value = 'default';
        if (!preg_match('/^[a-zA-Z0-9_-]{1,40}$/', $value)) throw new InvalidArgumentException('Sala invalida');
        return $value;
    }

    private function validarHostId(string $value): string {
        $value = trim($value);
        if (!preg_match('/^[a-f0-9]{32,64}$/i', $value)) throw new InvalidArgumentException('Host invalido');
        return $value;
    }

    private function validarCifraAtual($value): string {
        $value = trim((string)$value);
        if ($value === '') return '';
        if (!preg_match('/^\d{1,8}$/', $value)) throw new InvalidArgumentException('Cifra invalida');
        return $value;
    }

    private function validarPaginaAtual($value, string $cifraAtual): string {
        $value = str_replace('\\', '/', trim((string)$value));
        if ($value === '') return $cifraAtual !== '' ? 'music.php?id=' . $cifraAtual : 'index.php';
        if (strpos($value, '..') !== false || strpos($value, '/') !== false || preg_match('/^[a-z]+:/i', $value)) throw new InvalidArgumentException('Pagina invalida');
        if ($value === 'index.php') { if ($cifraAtual !== '') throw new InvalidArgumentException('Pagina e cifra nao conferem'); return $value; }
        if (preg_match('/^music\.php\?id=(\d{1,8})(?:&playlistTom=([A-G](?:%23|#|b)?))?$/', $value, $m)) {
            if ($cifraAtual !== '' && $cifraAtual !== $m[1]) throw new InvalidArgumentException('Pagina e cifra nao conferem');
            return 'music.php?id=' . $m[1] . (!empty($m[2]) ? '&playlistTom=' . str_replace('#', '%23', $m[2]) : '');
        }
        if (preg_match('/^roteiro\.php\?id=\d{1,8}$/', $value)) { if ($cifraAtual !== '') throw new InvalidArgumentException('Pagina e cifra nao conferem'); return $value; }
        throw new InvalidArgumentException('Pagina invalida');
    }

    private function novoHostId(): string {
        return bin2hex(random_bytes(16));
    }

    private function err400(string $msg): array {
        http_response_code(400);
        return ['success' => false, 'message' => $msg];
    }
}
