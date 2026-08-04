<?php

use PHPUnit\Framework\TestCase;

final class ChordSaveNormalizerTest extends TestCase
{
    public function testKeepsBoldTagWhenContentIsOnlyChords(): void
    {
        self::assertSame('<b>Am</b>', ChordSaveNormalizer::normalizar('<b>Am</b>'));
        self::assertSame('<b>C G/B Am7</b>', ChordSaveNormalizer::normalizar('<b>C G/B Am7</b>'));
    }

    public function testLeavesBoldTagAsIsWhenContentIsNotOnlyChords(): void
    {
        // Non-chord content is returned unchanged (the original match, $m[0]).
        self::assertSame('<b>vida</b>', ChordSaveNormalizer::normalizar('<b>vida</b>'));
        self::assertSame('<b>Am e G</b>', ChordSaveNormalizer::normalizar('<b>Am e G</b>'));
    }

    public function testPreservesOriginalAttributesWhenContentIsNotOnlyChords(): void
    {
        // $m[0] (the original match) is returned verbatim, attributes and all —
        // unlike the chord branch, which rebuilds a plain <b>...</b>.
        self::assertSame('<b class="x">vida</b>', ChordSaveNormalizer::normalizar('<b class="x">vida</b>'));
    }

    public function testCollapsesToEmptyStringWhenContentIsBlankAfterNormalizing(): void
    {
        self::assertSame('', ChordSaveNormalizer::normalizar('<b>   </b>'));
        self::assertSame('', ChordSaveNormalizer::normalizar("<b>\xc2\xa0</b>"));
    }

    public function testLeavesNonBoldTextUntouched(): void
    {
        self::assertSame('linha sem tag', ChordSaveNormalizer::normalizar('linha sem tag'));
    }

    public function testHandlesMultipleBoldSpansIndependently(): void
    {
        self::assertSame(
            '<b>Am</b> letra <b>C</b>',
            ChordSaveNormalizer::normalizar('<b>Am</b> letra <b>C</b>')
        );
        self::assertSame(
            '<b>Am</b> vamos cantar',
            ChordSaveNormalizer::normalizar('<b>Am</b> vamos cantar')
        );
    }

    public function testDecodesHtmlEntitiesBeforeChecking(): void
    {
        // "C&amp;m" decodes to "C&m" which isn't a valid chord -> original match kept as-is.
        self::assertSame('<b>C&amp;m</b>', ChordSaveNormalizer::normalizar('<b>C&amp;m</b>'));
    }

    // ---- isOnlyChords ----

    public function testIsOnlyChordsTrueForSingleChord(): void
    {
        self::assertTrue(ChordSaveNormalizer::isOnlyChords('Am7'));
    }

    public function testIsOnlyChordsTrueForMultipleChordsSeparatedBySpace(): void
    {
        self::assertTrue(ChordSaveNormalizer::isOnlyChords('C G/B Am7 F'));
    }

    public function testIsOnlyChordsFalseWhenAnyTokenIsNotAChord(): void
    {
        self::assertFalse(ChordSaveNormalizer::isOnlyChords('C vida G'));
    }

    public function testIsOnlyChordsStripsSurroundingPunctuation(): void
    {
        self::assertTrue(ChordSaveNormalizer::isOnlyChords('C, G.'));
    }

    public function testIsOnlyChordsFalseForEmptyString(): void
    {
        self::assertFalse(ChordSaveNormalizer::isOnlyChords(''));
    }
}
