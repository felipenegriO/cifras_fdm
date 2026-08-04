<?php
class CifraClubImportProvider implements ChordImportProvider
{
    private const ALLOWED_HOSTS = ['cifraclub.com.br', 'www.cifraclub.com.br'];

    /** @var callable(string $url, int $timeout): (string|false) */
    private $httpGet;

    public function __construct(array $deps = [])
    {
        $this->httpGet = $deps['httpGet'] ?? function (string $url, int $timeout) {
            $context = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'user_agent' => 'CifroFdm/1.0 (+https://cifrasfdm.com.br)',
                    'timeout' => $timeout,
                    'ignore_errors' => true,
                    'max_redirects' => 3,
                ],
            ]);
            return @file_get_contents($url, false, $context, 0, 2 * 1024 * 1024);
        };
    }

    public function import(string $url): array
    {
        $this->assertAllowedUrl($url);
        $html = ($this->httpGet)($url, 8);
        if ($html === false || $html === '') {
            throw new RuntimeException('Não foi possível acessar a página informada.');
        }
        return $this->parseHtml($html, $url);
    }

    private function assertAllowedUrl(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string)($parts['scheme'] ?? ''));
        $host = strtolower((string)($parts['host'] ?? ''));
        if (!in_array($scheme, ['http', 'https'], true) || !in_array($host, self::ALLOWED_HOSTS, true)) {
            throw new InvalidArgumentException('URL de origem não permitida.');
        }
    }

    private function parseHtml(string $html, string $url): array
    {
        throw new RuntimeException('Não foi possível extrair a cifra desta página.');
    }
}
