<?php
class ChordImportProviderResolver
{
    public static function forUrl(string $url): ChordImportProvider
    {
        $parts = parse_url($url);
        $host = strtolower((string)($parts['host'] ?? ''));
        if ($host === 'cifraclub.com.br' || $host === 'www.cifraclub.com.br') {
            return new CifraClubImportProvider();
        }
        throw new InvalidArgumentException('Nenhum provedor de importação disponível para este link.');
    }
}
