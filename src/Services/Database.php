<?php
class Database {
    private static $instance = null;

    public static function getConnection() {
        if (self::$instance instanceof PDO) {
            return self::$instance;
        }

        $host = env('DB_HOST');
        $db = env('DB_NAME');
        $user = env('DB_USER');
        $pass = env('DB_PASS');

        if (!$host || !$db || !$user) {
            throw new RuntimeException('Database configuration is missing.');
        }

        $dsn = 'mysql:host=' . $host . ';dbname=' . $db . ';charset=utf8mb4';

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        self::$instance = new PDO($dsn, $user, $pass, $options);
        return self::$instance;
    }
}
