<?php
class DatabaseBackupService
{
    public static function encrypt(string $plaintext, string $encodedKey): string
    {
        $key = base64_decode($encodedKey, true);
        if ($key === false || strlen($key) !== 32) throw new RuntimeException('BACKUP_ENCRYPTION_KEY inválida.');
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($ciphertext === false) throw new RuntimeException('Falha ao criptografar backup.');
        return 'CIFROBK1' . $iv . $tag . $ciphertext;
    }

    public static function decrypt(string $payload, string $encodedKey): string
    {
        if (!str_starts_with($payload, 'CIFROBK1') || strlen($payload) < 36) throw new RuntimeException('Formato de backup inválido.');
        $key = base64_decode($encodedKey, true);
        if ($key === false || strlen($key) !== 32) throw new RuntimeException('BACKUP_ENCRYPTION_KEY inválida.');
        $iv = substr($payload, 8, 12);
        $tag = substr($payload, 20, 16);
        $plaintext = openssl_decrypt(substr($payload, 36), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($plaintext === false) throw new RuntimeException('Backup inválido ou chave incorreta.');
        return $plaintext;
    }

    public static function prune(string $directory, int $retentionDays): int
    {
        $removed = 0;
        $threshold = time() - ($retentionDays * 86400);
        foreach (glob(rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . 'cifro-*.sql.enc') ?: [] as $file) {
            if (is_file($file) && filemtime($file) < $threshold && unlink($file)) $removed++;
        }
        return $removed;
    }
}
