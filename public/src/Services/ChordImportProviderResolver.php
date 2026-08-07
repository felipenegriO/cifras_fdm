<?php
class ChordImportProviderResolver
{
    public static function forUrl(string $url): ChordImportProvider
    {
        $parts = parse_url($url);
        $scheme = strtolower((string)($parts['scheme'] ?? ''));
        if (!in_array($scheme, ['http', 'https'], true)) {
            throw new InvalidArgumentException('Nenhum provedor de importação disponível para este link.');
        }
        $host = strtolower((string)($parts['host'] ?? ''));
        if (in_array($host, CifraClubImportProvider::ALLOWED_HOSTS, true)) {
            return new CifraClubImportProvider();
        }
        throw new InvalidArgumentException('Nenhum provedor de importação disponível para este link.');
    }
}
