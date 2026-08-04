<?php
/**
 * RoteiroFormValidator — pure validation/normalization for the roteiro save
 * endpoint (public/src/backend/editor/salvar_roteiros.php).
 */
class RoteiroFormValidator
{
    public static function isValido(string $titulo, string $conteudo): bool
    {
        return $titulo !== '' && mb_strlen($titulo) <= 200 && strlen($conteudo) <= 2000000;
    }

    public static function normalizarConteudo(string $conteudo): string
    {
        $conteudo = preg_replace('/\r?\n/', '<br/>', $conteudo);
        return preg_replace('/<br\s*?>/i', '<br/>', $conteudo);
    }
}
