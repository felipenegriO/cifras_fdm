<?php
/**
 * BandaPlanoValidator — pure plan validation/normalization for the admin
 * banda save endpoint (public/src/backend/bandas/salvar_banda.php).
 */
class BandaPlanoValidator
{
    private const PLANOS_VALIDOS = ['gratuito', 'mensal', 'semestral', 'anual', 'bloqueado', 'ativo'];

    /** 'trial' is a legacy alias that always collapses to 'gratuito'. */
    public static function normalizar(string $plano): string
    {
        return $plano === 'trial' ? 'gratuito' : $plano;
    }

    public static function isValido(string $plano): bool
    {
        return in_array($plano, self::PLANOS_VALIDOS, true);
    }
}
