<?php
/**
 * UserFormValidator — pure validation/mapping rules for the user save
 * endpoint (public/src/backend/users/salvar_user.php), extracted so the
 * branch-heavy validation logic can be unit tested directly.
 */
class UserFormValidator
{
    private const PERFIS_VALIDOS = ['administrador', 'gestor', 'basico'];

    public static function isPerfilValido(string $perfil): bool
    {
        return in_array($perfil, self::PERFIS_VALIDOS, true);
    }

    public static function isEmailValido(string $email): bool
    {
        return $email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /** Empty string is valid (means "no expiry"); otherwise must be a real Y-m-d date. */
    public static function isValidadeValida(string $validade): bool
    {
        if ($validade === '') {
            return true;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $validade)) {
            return false;
        }
        [$y, $m, $d] = array_map('intval', explode('-', $validade));
        return checkdate($m, $d, $y);
    }

    public static function isNomeEEmailPresentes(string $nome, string $email): bool
    {
        return $nome !== '' && $email !== '';
    }

    public static function mapSaveErrorMessage(\PDOException $e): string
    {
        return str_contains($e->getMessage(), 'Duplicate entry')
            ? 'E-mail já está em uso.'
            : 'Erro ao salvar.';
    }

    public static function isSearchQueryValid(string $q): bool
    {
        return strlen($q) >= 2;
    }
}
