<?php
class CompromisedPasswordChecker
{
    private static $checker = null;

    public static function setChecker(?callable $checker): void
    {
        self::$checker = $checker;
    }

    public static function isCompromised(string $password): bool
    {
        if (self::$checker !== null) {
            return (bool) call_user_func(self::$checker, $password);
        }

        return in_array(strtolower($password), [
            '123456789012',
            'password1234',
            'senha12345678',
            'qwerty123456',
        ], true);
    }
}
