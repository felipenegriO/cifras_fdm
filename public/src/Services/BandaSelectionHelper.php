<?php
/**
 * BandaSelectionHelper — pure helpers for public/src/backend/bandas/selecionar.php.
 */
class BandaSelectionHelper
{
    /** Whether $bandaId is already present in the user's cached bandas list. */
    public static function isBandaJaNaLista(array $userBandas, string $bandaId): bool
    {
        foreach ($userBandas as $b) {
            if (($b['id'] ?? null) === $bandaId) {
                return true;
            }
        }
        return false;
    }

    public static function buildBandaAtualSession(array $banda, string $perfil): array
    {
        return [
            'id'              => $banda['id'],
            'nome'            => $banda['nome'],
            'perfil'          => $perfil,
            'plano'           => $banda['plano'] ?? 'ativo',
            'trial_expira_em' => $banda['trial_expira_em'] ?? null,
            'logo'            => $banda['logo'] ?? null,
        ];
    }
}
