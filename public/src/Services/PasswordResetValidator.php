<?php
/**
 * PasswordResetValidator — pure validation for the reset-senha.php form,
 * extracted so the branching can be unit tested without a real HTTP request.
 */
class PasswordResetValidator
{
    /** Returns an error message, or null when the new password is acceptable. */
    public static function validateNewPassword(string $senha, string $senha2): ?string
    {
        if (strlen($senha) < 6) {
            return 'A senha deve ter pelo menos 6 caracteres.';
        }
        if ($senha !== $senha2) {
            return 'As senhas não coincidem.';
        }
        if (CompromisedPasswordChecker::isCompromised($senha)) {
            return 'Escolha uma senha que não seja comum ou conhecida em vazamentos.';
        }
        return null;
    }
}
