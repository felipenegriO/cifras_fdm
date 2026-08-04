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

    public function testParsesTitleArtistContentAndMetadata(): void
    {
        $html = file_get_contents(__DIR__ . '/../fixtures/cifraclub-sample.html');
        $provider = new CifraClubImportProvider(['httpGet' => function () use ($html) {
            return $html;
        }]);

        $result = $provider->import('https://www.cifraclub.com.br/artista-teste/musica-de-teste/');

        $this->assertSame('Música de Teste', $result['title']);
        $this->assertSame('Artista Teste', $result['artist']);
        $this->assertSame('C', $result['metadata']['tom']);
        $this->assertSame('2', $result['metadata']['capo']);
        $this->assertStringContainsString('[Intro] C  G  Am  F', $result['content']);
        $this->assertStringContainsString('Linha de exemplo da letra', $result['content']);
        $this->assertStringNotContainsString('Tom: C', $result['content']);
    }

    public function testThrowsWhenPageHasNoCifraBlock(): void
    {
        $html = file_get_contents(__DIR__ . '/../fixtures/cifraclub-sem-cifra.html');
        $provider = new CifraClubImportProvider(['httpGet' => function () use ($html) {
            return $html;
        }]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Não foi possível extrair a cifra desta página.');
        $provider->import('https://www.cifraclub.com.br/artista/pagina/');
    }
}
