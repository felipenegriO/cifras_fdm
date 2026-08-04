<?php
// Lightweight .env loader without external dependencies.
function load_env_file($path) {
    if (!file_exists($path) || !is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0) {
            continue;
        }

        $parts = explode('=', $trimmed, 2);
        if (count($parts) !== 2) {
            continue;
        }

        $key = trim($parts[0]);
        $value = trim($parts[1]);

        if ($value !== '' && ($value[0] === '"' || $value[0] === "'")) {
            $value = trim($value, "\"'");
        }

        $previousFileKeys = array_filter(explode(',', (string)getenv('CIFRO_FILE_ENV_KEYS')));
        $loadedThisRequest = $GLOBALS['cifro_file_env_loaded'] ?? [];
        $testMutableKeys = [
            'PAYMENT_PIX_PHONE', 'PAYMENT_PIX_RECIPIENT', 'PAYMENT_WHATSAPP_PHONE',
            'STRIPE_SECRET_KEY', 'STRIPE_LINK_MENSAL', 'STRIPE_LINK_SEMESTRAL', 'STRIPE_LINK_ANUAL',
            'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI',
        ];
        $testOverride = getenv('APP_ENV') === 'test' && in_array($key, $testMutableKeys, true);
        if ($key !== '' && !isset($loadedThisRequest[$key]) && ($testOverride || getenv($key) === false || in_array($key, $previousFileKeys, true))) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
            $GLOBALS['cifro_file_env_loaded'][$key] = true;
            $previousFileKeys[] = $key;
            putenv('CIFRO_FILE_ENV_KEYS=' . implode(',', array_unique($previousFileKeys)));
        }
    }
}

if (!function_exists('env')) {
    function env($key, $default = null) {
        $value = getenv($key);
        if ($value === false) {
            return $default;
        }
        return $value;
    }
}

// Variáveis do processo têm precedência; local sobrescreve arquivos compartilhados.
load_env_file(__DIR__ . '/../../.env.local');
load_env_file(__DIR__ . '/../.env');
if (!getenv('DB_HOST')) {
    load_env_file(__DIR__ . '/../../.env');
}

if (!function_exists('validate_production_env')) {
    function validate_production_env(): void {
        if (strtolower((string) env('APP_ENV', 'production')) !== 'production') return;
        $missing = [];
        foreach (['DB_HOST', 'DB_NAME', 'DB_USER', 'ENCRYPTION_KEY'] as $key) {
            if (trim((string) env($key, '')) === '') $missing[] = $key;
        }
        if ($missing) {
            throw new RuntimeException('Configuração de produção incompleta: ' . implode(', ', $missing));
        }
        if (strlen((string) env('ENCRYPTION_KEY', '')) < 32) {
            throw new RuntimeException('ENCRYPTION_KEY deve ter ao menos 32 caracteres.');
        }
    }
}
