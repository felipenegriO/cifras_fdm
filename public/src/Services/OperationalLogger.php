<?php
class OperationalLogger
{
    public static function log(string $level, string $event, array $context = []): void
    {
        $allowed = ['duration_ms', 'status', 'provider', 'operation', 'result', 'error_type', 'http_status'];
        $safe = array_intersect_key($context, array_flip($allowed));
        $userId = (string) ($_SESSION['usuario']['id'] ?? '');
        $bandId = function_exists('current_band_id') ? current_band_id() : '';
        $key = (string) env('ENCRYPTION_KEY', 'local-observability-key');
        $record = array_merge([
            'timestamp' => gmdate('c'),
            'level' => in_array($level, ['debug', 'info', 'warning', 'error'], true) ? $level : 'info',
            'event' => preg_replace('/[^a-z0-9_.-]/i', '', $event),
            'request_id' => function_exists('request_id') ? request_id() : null,
            'actor' => $userId === '' ? null : substr(hash_hmac('sha256', $userId, $key), 0, 16),
            'band' => $bandId === '' ? null : substr(hash_hmac('sha256', $bandId, $key), 0, 16),
        ], $safe);
        error_log(json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }
}
