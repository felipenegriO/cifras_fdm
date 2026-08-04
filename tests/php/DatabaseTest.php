<?php

use PHPUnit\Framework\TestCase;

final class DatabaseTest extends TestCase
{
    public function testRetornaInstanciaPdoExistente(): void
    {
        $property = new ReflectionProperty(Database::class, 'instance');
        $property->setAccessible(true);
        $pdo = Database::getConnection();
        self::assertSame($pdo, Database::getConnection());
    }

    public function testRejeitaConfiguracaoAusente(): void
    {
        $property = new ReflectionProperty(Database::class, 'instance');
        $property->setAccessible(true);
        $originalInstance = $property->getValue();
        $keys = ['DB_HOST', 'DB_NAME', 'DB_USER'];
        $original = [];

        foreach ($keys as $key) {
            $original[$key] = getenv($key);
            putenv($key);
        }

        try {
            $property->setValue(null, null);
            $this->expectException(RuntimeException::class);
            $this->expectExceptionMessage('Database configuration is missing.');
            Database::getConnection();
        } finally {
            foreach ($original as $key => $value) {
                $value === false ? putenv($key) : putenv($key . '=' . $value);
            }
            $property->setValue(null, $originalInstance);
        }
    }
}
