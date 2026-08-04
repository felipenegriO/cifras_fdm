<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/Services/ChordImportProvider.php';
require_once __DIR__ . '/../../public/src/Services/CifraClubImportProvider.php';

final class CifraClubImportProviderTest extends TestCase
{
    public function testRejectsUnknownHosts(): void
    {
        $provider = new CifraClubImportProvider();
        $this->expectException(InvalidArgumentException::class);
        $provider->import('http://127.0.0.1/private');
    }

    public function testRejectsNonHttpScheme(): void
    {
        $provider = new CifraClubImportProvider();
        $this->expectException(InvalidArgumentException::class);
        $provider->import('ftp://www.cifraclub.com.br/artista/musica/');
    }

    public function testThrowsWhenFetchFails(): void
    {
        $provider = new CifraClubImportProvider(['httpGet' => function (string $url, int $timeout) {
            return false;
        }]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Não foi possível acessar a página informada.');
        $provider->import('https://www.cifraclub.com.br/artista/musica/');
    }
}
