<?php
/**
 * ChordSaveNormalizer — normalizes chord markup before persisting a cifra.
 *
 * Extracted from public/src/backend/editor/api.php so the chord-detection
 * regex/branching can be unit tested directly instead of only through the
 * full save-endpoint HTTP flow.
 */
class ChordSaveNormalizer
{
    private const CHORD_REGEX = '/^[A-G](?:#|b)?(?:(?:m(?![a-z])|maj|min|dim|aug|sus|add|M)?[0-9]*(?:M)?(?:\([^)]+\))?(?:[+º°])?)(?:\/[A-G](?:#|b)?)?$/iu';

    public static function normalizar(string $cifra): string
    {
        return preg_replace_callback('/<b\b[^>]*>([\s\S]*?)<\/b>/i', function ($m) {
            return self::normalizarTagB($m);
        }, $cifra);
    }

    private static function normalizarTagB(array $m): string
    {
        $texto = html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $texto = str_replace("\xc2\xa0", ' ', $texto);
        $texto = trim(preg_replace('/\s+/u', ' ', $texto));
        if ($texto === '') {
            return '';
        }

        return self::isOnlyChords($texto) ? '<b>' . $m[1] . '</b>' : $m[0];
    }

    public static function isOnlyChords(string $texto): bool
    {
        $tokens = preg_split('/\s+/u', $texto);
        foreach ($tokens as $token) {
            if (!preg_match(self::CHORD_REGEX, trim($token, '.,;:!?'))) {
                return false;
            }
        }
        return count($tokens) > 0;
    }
}
