<?php
/**
 * UserConfigValidator — validates individual user config fields for the
 * public/src/backend/users/salvar_config.php endpoint.
 */
class UserConfigValidator
{
    private const CIFRA_SIZES = [14, 16, 18, 20, 22];

    /** Returns the normalized value for $key, or null if unknown key/invalid value. */
    public static function validate(string $key, $value): ?string
    {
        return match ($key) {
            'tema' => self::validateTema($value),
            'cifraSize' => self::validateCifraSize($value),
            'scrollSpeed' => self::validateScrollSpeed($value),
            'keepAwake' => self::validateKeepAwake($value),
            default => null,
        };
    }

    public static function isKeySuportada(string $key): bool
    {
        return in_array($key, ['tema', 'cifraSize', 'scrollSpeed', 'keepAwake'], true);
    }

    private static function validateTema($value): ?string
    {
        return is_string($value) && in_array($value, ['dark', 'light', 'auto'], true) ? $value : null;
    }

    private static function validateCifraSize($value): ?string
    {
        $value = filter_var($value, FILTER_VALIDATE_INT);
        return in_array($value, self::CIFRA_SIZES, true) ? (string) $value : null;
    }

    private static function validateScrollSpeed($value): ?string
    {
        return is_string($value) && in_array($value, ['slow', 'normal', 'fast'], true) ? $value : null;
    }

    private static function validateKeepAwake($value): ?string
    {
        if ($value === true || $value === 'true') {
            return 'true';
        }
        if ($value === false || $value === 'false') {
            return 'false';
        }
        return null;
    }
}
