<?php
class LiveStateRepository {
    private $pdo;

    public function __construct() {
        $this->pdo = Database::getConnection();
    }

    public function get(string $bandaId): array {
        $stmt = $this->pdo->prepare('SELECT * FROM live_state WHERE banda_id=?');
        $stmt->execute([$bandaId]);
        $row = $stmt->fetch();
        if (!$row) {
            return $this->defaultState($bandaId);
        }
        return $row;
    }

    public function update(string $bandaId, array $data): void {
        $stmt = $this->pdo->prepare('SELECT 1 FROM live_state WHERE banda_id=?');
        $stmt->execute([$bandaId]);
        $exists = $stmt->fetchColumn();

        if (!$exists) {
            $stmt = $this->pdo->prepare(
                'INSERT INTO live_state (banda_id, host_id, host_user_id, host_username, host_nome,
                  cifra_atual, pagina_atual, scroll_top, scroll_percent, can_sync_scroll, version)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute([
                $bandaId,
                $data['host_id'] ?? null,
                $data['host_user_id'] ?? null,
                $data['host_username'] ?? null,
                $data['host_nome'] ?? null,
                $data['cifra_atual'] ?? '',
                $data['pagina_atual'] ?? 'index.php',
                $data['scroll_top'] ?? 0,
                $data['scroll_percent'] ?? 0,
                isset($data['can_sync_scroll']) ? (int)$data['can_sync_scroll'] : 1,
                1,
            ]);
            return;
        }

        $sets = [];
        $params = [];
        $allowed = ['host_id','host_user_id','host_username','host_nome','cifra_atual',
                    'pagina_atual','scroll_top','scroll_percent','can_sync_scroll'];
        foreach ($allowed as $k) {
            if (array_key_exists($k, $data)) {
                $sets[] = "$k=?";
                $params[] = $data[$k];
            }
        }
        if (empty($sets)) return;

        $sets[] = 'version=version+1';
        $params[] = $bandaId;
        $sql = 'UPDATE live_state SET ' . implode(',', $sets) . ' WHERE banda_id=?';
        $this->pdo->prepare($sql)->execute($params);
    }

    private function defaultState(string $bandaId): array {
        return [
            'banda_id'       => $bandaId,
            'host_id'        => null,
            'host_user_id'   => null,
            'host_username'  => null,
            'host_nome'      => null,
            'cifra_atual'    => '',
            'pagina_atual'   => 'index.php',
            'scroll_top'     => 0,
            'scroll_percent' => 0,
            'can_sync_scroll'=> 1,
            'version'        => 0,
        ];
    }
}
