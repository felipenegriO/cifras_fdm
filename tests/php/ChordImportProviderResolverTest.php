<?php
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/Services/ChordImportProvider.php';
require_once __DIR__ . '/../../public/src/Services/CifraClubImportProvider.php';
require_once __DIR__ . '/../../public/src/Services/ChordImportProviderResolver.php';

final class ChordImportProviderResolverTest extends TestCase
{
    public function testResolvesCifraClubProviderForCifraClubHost(): void
    {
        $provider = ChordImportProviderResolver::forUrl('https://www.cifraclub.com.br/artista/musica/');
        $this->assertInstanceOf(CifraClubImportProvider::class, $provider);
    }

    public function testRejectsUnknownHost(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ChordImportProviderResolver::forUrl('https://www.outrosite.com.br/artista/musica/');
    }

    public function testRejectsInvalidUrl(): void
    {
        $this->expectException(InvalidArgumentException::class);
        ChordImportProviderResolver::forUrl('não é uma url');
    }
}
