<?php
class ErrorLogger {
    /**
     * Registra um erro na tabela app_error_logs.
     *
     * @param string     $descricao  Descrição resumida (ex: "Falha ao enviar e-mail de boas-vindas")
     * @param string     $referencia Arquivo:linha ou classe::método de origem
     * @param string     $nivel      'error' | 'warning' | 'info'
     * @param array|null $detalhes   Dados extras (exception, contexto, etc.)
     */
    public static function log(
        string $descricao,
        string $referencia = '',
        string $nivel = 'error',
        ?array $detalhes = null
    ): void {
        try {
            try {
                self::limparAntigos(max(1, (int) env('ERROR_LOG_RETENTION_DAYS', '30')));
            } catch (Throwable) {
            }
            $pdo  = Database::getConnection();
            $stmt = $pdo->prepare(
                'INSERT INTO app_error_logs (nivel, referencia, descricao, detalhes)
                 VALUES (?, ?, ?, ?)'
            );
            $stmt->execute([
                $nivel,
                mb_substr($referencia, 0, 255),
                mb_substr($descricao,  0, 500),
                $detalhes !== null ? json_encode($detalhes, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            ]);
        } catch (Throwable) {
            // Silencia — não pode logar erro do logger
            error_log('[ErrorLogger] falha ao gravar log: ' . $descricao);
        }
    }

    public static function fromThrowable(
        Throwable $e,
        string $descricao,
        string $referencia = '',
        string $nivel = 'error'
    ): void {
        self::log($descricao, $referencia ?: ($e->getFile() . ':' . $e->getLine()), $nivel, [
            'exception' => get_class($e),
            'message'   => $e->getMessage(),
            'file'      => $e->getFile(),
            'line'      => $e->getLine(),
        ]);
    }

    public static function limparAntigos(int $dias = 30): int
    {
        $dias = max(1, min(3650, $dias));
        $stmt = Database::getConnection()->prepare(
            "DELETE FROM app_error_logs WHERE criado_em < DATE_SUB(UTC_TIMESTAMP(), INTERVAL {$dias} DAY)"
        );
        $stmt->execute();
        return $stmt->rowCount();
    }
}
