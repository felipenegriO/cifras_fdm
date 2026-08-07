<?php

use PHPUnit\Framework\TestCase;

final class SyncConflictExceptionTest extends TestCase
{
    public function testConstructorSetsMessageAndRevision(): void
    {
        $ex = new SyncConflictException(42);

        self::assertSame(
            'Os dados foram alterados em outro dispositivo. Atualize antes de salvar novamente.',
            $ex->getMessage()
        );
        self::assertSame(42, $ex->getCurrentRevision());
    }

    public function testIsInstanceOfRuntimeException(): void
    {
        $ex = new SyncConflictException(0);
        self::assertInstanceOf(RuntimeException::class, $ex);
    }
}
