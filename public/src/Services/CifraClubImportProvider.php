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
                    'follow_location' => 0,
                ],
            ]);
            $html = @file_get_contents($url, false, $context, 0, 2 * 1024 * 1024);
            $status = self::parseHttpStatusCode($http_response_header ?? []);
            if ($status !== null && $status >= 300 && $status <= 399) {
                return false;
            }
            return $html;
        };
    }

    public static function parseHttpStatusCode(array $responseHeaders): ?int
    {
        if (!isset($responseHeaders[0]) || !is_string($responseHeaders[0])) {
            return null;
        }
        if (preg_match('#^HTTP/\d(?:\.\d)?\s+(\d{3})#', $responseHeaders[0], $match) !== 1) {
            return null;
        }
        return (int)$match[1];
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
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8">' . $html);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $xpath = new DOMXPath($document);
        $preNode = $xpath->query('//pre[contains(@id, "cifra")]')->item(0);
        if (!$preNode) {
            throw new RuntimeException('Não foi possível extrair a cifra desta página.');
        }

        $title = '';
        $h1 = $xpath->query('//h1')->item(0);
        if ($h1) {
            $title = trim($h1->textContent);
        }

        $artist = '';
        $h2Link = $xpath->query('//h2//a')->item(0);
        if ($h2Link) {
            $artist = trim($h2Link->textContent);
        } else {
            $h2 = $xpath->query('//h2')->item(0);
            if ($h2) {
                $artist = trim($h2->textContent);
            }
        }

        $rawContent = str_replace("\r\n", "\n", $preNode->textContent);
        $lines = explode("\n", $rawContent);

        $metadata = [];
        $contentStart = 0;
        while ($contentStart < count($lines)) {
            $line = trim($lines[$contentStart]);
            if ($line === '') {
                $contentStart++;
                continue;
            }
            if (preg_match('/^(tom|capo|afina[cç][aã]o)\s*:\s*(.+)$/iu', $line, $match)) {
                $metadata[mb_strtolower($match[1], 'UTF-8')] = trim($match[2]);
                $contentStart++;
                continue;
            }
            break;
        }

        $content = trim(implode("\n", array_slice($lines, $contentStart)));
        if ($content === '') {
            throw new RuntimeException('Não foi possível extrair a cifra desta página.');
        }

        return [
            'title' => mb_substr($title, 0, 200),
            'artist' => mb_substr($artist, 0, 200),
            'content' => $content,
            'metadata' => [
                'tom' => $metadata['tom'] ?? null,
                'capo' => $metadata['capo'] ?? null,
                'afinação' => $metadata['afinação'] ?? $metadata['afinacao'] ?? null,
            ],
        ];
    }
}
