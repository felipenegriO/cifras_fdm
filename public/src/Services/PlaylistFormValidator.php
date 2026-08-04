<?php
/**
 * PlaylistFormValidator — pure validation/normalization for the playlist
 * save endpoint (public/src/backend/editor/salvar_playlists.php).
 */
class PlaylistFormValidator
{
    /** Normalizes the raw decoded JSON body into a flat playlists array, or null if the shape is unusable. */
    public static function normalizarEntrada($data): ?array
    {
        if (isset($data['playlists']) && is_array($data['playlists'])) {
            return $data['playlists'];
        }
        if (is_array($data)) {
            $playlists = [];
            foreach ($data as $nome => $itens) {
                if (is_array($itens)) {
                    $playlists[] = ['nome' => $nome, 'itens' => $itens];
                }
            }
            return $playlists;
        }
        return null;
    }

    public static function isNomeEItensValidos(string $nome, $itens): bool
    {
        return $nome !== '' && mb_strlen($nome) <= 200 && is_array($itens);
    }

    public static function isVisivelAteValido(string $visivelAte): bool
    {
        if ($visivelAte === '') {
            return true;
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $visivelAte);
        return $date !== false && $date->format('Y-m-d') === $visivelAte;
    }

    /** Extracts and validates a playlist item; returns the numeric music id, or null if invalid. */
    public static function validarItem($item): ?int
    {
        $id = is_array($item) ? ($item['id'] ?? null) : $item;
        $tom = is_array($item) ? trim((string)($item['tom'] ?? '')) : '';
        if (!is_numeric($id) || (int)$id <= 0) {
            return null;
        }
        if ($tom !== '' && !preg_match('/^[A-G](?:#|b)?m?$/', $tom)) {
            return null;
        }
        return (int)$id;
    }

    public static function computeMaxPlaylists(bool $isMaster, array $limits): int
    {
        return $isMaster ? -1 : ($limits['playlists'] ?? 0);
    }

    public static function excedeLimite(int $maxPlaylists, int $totalPlaylists): bool
    {
        return $maxPlaylists !== -1 && $totalPlaylists > $maxPlaylists;
    }

    public static function planoLabel(string $plano): string
    {
        return match ($plano) {
            'gratuito' => 'Gratuito',
            'basico' => 'Básico',
            default => 'atual',
        };
    }
}
