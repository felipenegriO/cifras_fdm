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
        $this->assertSame(2, $result['metadata']['capo']);
        $this->assertStringContainsString('[Intro] C  G  Am  F', $result['content']);
        $this->assertStringContainsString('Linha de exemplo da letra', $result['content']);
        $this->assertStringNotContainsString('Tom: C', $result['content']);
    }

    public function testParsesRealCifraClubLayoutWithObfuscatedClasses(): void
    {
        $html = file_get_contents(__DIR__ . '/../fixtures/cifraclub-real-layout.html');
        $provider = new CifraClubImportProvider(['httpGet' => function () use ($html) {
            return $html;
        }]);

        $result = $provider->import('https://www.cifraclub.com.br/diante-do-trono/a-ele-gloria/');

        $this->assertSame('A Ele a Glória', $result['title']);
        $this->assertSame('Diante do Trono', $result['artist']);
        $this->assertStringContainsString('[Intro] Em  C  D9(11)', $result['content']);
    }

    public function testParseHttpStatusCodeExtractsRedirectStatus(): void
    {
        $status = CifraClubImportProvider::parseHttpStatusCode([
            'HTTP/1.1 301 Moved Permanently',
            'Location: http://evil.internal/',
        ]);
        $this->assertSame(301, $status);
    }

    public function testParseHttpStatusCodeExtractsOkStatus(): void
    {
        $status = CifraClubImportProvider::parseHttpStatusCode(['HTTP/1.1 200 OK']);
        $this->assertSame(200, $status);
    }

    public function testParseHttpStatusCodeReturnsNullForEmptyHeaders(): void
    {
        $this->assertNull(CifraClubImportProvider::parseHttpStatusCode([]));
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

    public function testParseHttpStatusCodeReturnsNullForMalformedStatusLine(): void
    {
        $this->assertNull(CifraClubImportProvider::parseHttpStatusCode(['Not-a-valid-status-line']));
    }

    public function testThrowsWhenCifraBlockHasOnlyWhitespace(): void
    {
        $html = '<html><body>'
            . '<h1>Título</h1><h2><a href="#">Artista</a></h2>'
            . '<pre id="cifra_original">   ' . "\n\n\t" . '</pre>'
            . '</body></html>';

        $provider = new CifraClubImportProvider(['httpGet' => fn() => $html]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Não foi possível extrair a cifra desta página.');
        $provider->import('https://www.cifraclub.com.br/artista/musica/');
    }

    public function testLeCapotrasteDeclaradoForaDaCifra(): void
    {
        $html = file_get_contents(__DIR__ . '/../fixtures/cifraclub-capo-fora-do-pre.html');
        $provider = new CifraClubImportProvider(['httpGet' => fn() => $html]);

        $result = $provider->import('https://www.cifraclub.com.br/artista-teste/musica/');

        $this->assertSame(2, $result['metadata']['capo']);
        $this->assertSame('A', $result['metadata']['tom']);
        $this->assertStringContainsString('[Intro] G  D  Em  C', $result['content']);
    }

    public function testDevolveCapotrasteNuloQuandoAPaginaNaoInforma(): void
    {
        $html = '<!DOCTYPE html><html><body>'
            . '<h1>Sem capo</h1><h2>Artista</h2>'
            . '<div class="cifra_cnt"><pre id="cifra_clean">C  G  Am  F' . "\n" . 'letra</pre></div>'
            . '</body></html>';

        $provider = new CifraClubImportProvider(['httpGet' => fn() => $html]);
        $result = $provider->import('https://www.cifraclub.com.br/a/b/');

        $this->assertNull($result['metadata']['capo']);
    }
}
