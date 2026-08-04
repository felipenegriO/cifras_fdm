<?php
/**
 * CategoriaFormValidator — pure validation rules for the categoria save/delete
 * endpoint (public/src/backend/categorias/api.php).
 */
class CategoriaFormValidator
{
    public static function isDeleteIdValido($id): bool
    {
        return !empty($id) && is_numeric($id);
    }

    /** Returns an error message, or null when the name is acceptable. */
    public static function validateNome(string $nome): ?string
    {
        if ($nome === '') {
            return 'Informe o nome da categoria.';
        }
        if (mb_strlen($nome) > 100) {
            return 'O nome deve ter no máximo 100 caracteres.';
        }
        return null;
    }
}
