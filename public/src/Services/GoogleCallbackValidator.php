<?php
/**
 * GoogleCallbackValidator — pure guard-clause logic for
 * public/api/auth/google/callback.php, extracted so each decision branch
 * can be unit tested without a real HTTP request/session.
 */
class GoogleCallbackValidator
{
    public static function isStateValid(string $expected, $received): bool
    {
        return $expected !== '' && is_string($received) && hash_equals($expected, $received);
    }

    public static function userCancelled(array $get): bool
    {
        return !empty($get['error']);
    }

    /** Returns the code, or null if missing/invalid. */
    public static function extractCode(array $get): ?string
    {
        $code = $get['code'] ?? '';
        return (is_string($code) && $code !== '') ? $code : null;
    }

    public static function isConfigured(string $clientId, string $clientSecret, string $redirectUri): bool
    {
        return $clientId !== '' && $clientSecret !== '' && $redirectUri !== '';
    }
}
