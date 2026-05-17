<?php
use PHPUnit\Framework\TestCase;

final class ValidatorTest extends TestCase
{
    public function testStringTrimsAndRemovesControlChars(): void
    {
        $input = "  hello\x00world\x07  ";
        self::assertSame('helloworld', Validator::string($input));
    }

    public function testStringTruncatesToMaxLength(): void
    {
        self::assertSame('abcde', Validator::string('abcdefghij', 5));
    }

    public function testStringHandlesUtf8WithMbSubstr(): void
    {
        self::assertSame('açã', Validator::string('açãozinho', 3));
    }

    public function testStringCastsNonStringInput(): void
    {
        self::assertSame('123', Validator::string(123));
        self::assertSame('1', Validator::string(true));
        self::assertSame('', Validator::string(null));
    }

    public function testUsernameIsLowercased(): void
    {
        self::assertSame('felipe.negri', Validator::username('  Felipe.Negri  '));
    }

    public function testUsernameRespectsMaxLen(): void
    {
        self::assertSame('abcdef', Validator::username('ABCDEFGHIJ', 6));
    }
}
