<?php
/**
 * GoogleJwtVerifier — minimal RS256 JWT signature/claims verifier for
 * Google-issued id_tokens. No external dependency: builds the RSA public
 * key from the JWKS modulus/exponent and verifies with openssl_verify().
 */
class GoogleJwtVerifier
{
    private const DEFAULT_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
    private const VALID_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

    /**
     * @param callable|null $fetchJwks fn(): array{keys: array} — defaults to a real HTTPS fetch.
     * @return array the decoded JWT payload.
     * @throws \RuntimeException on any structural, signature, or claim failure.
     */
    public static function verify(string $idToken, string $expectedAudience, ?callable $fetchJwks = null): array
    {
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            throw new \RuntimeException('Token com formato inválido.');
        }
        [$headerB64, $payloadB64, $signatureB64] = $parts;

        $header = json_decode(self::base64urlDecode($headerB64), true);
        $payload = json_decode(self::base64urlDecode($payloadB64), true);
        $signature = self::base64urlDecode($signatureB64);

        if (!is_array($header) || !is_array($payload)) {
            throw new \RuntimeException('Token com payload inválido.');
        }
        if (($header['alg'] ?? '') !== 'RS256') {
            throw new \RuntimeException('Algoritmo de assinatura não suportado.');
        }

        $fetchJwks = $fetchJwks ?? [self::class, 'fetchJwksFromGoogle'];
        $jwks = $fetchJwks();
        $publicKeyPem = self::findPublicKey($jwks, $header['kid'] ?? '');
        if (!$publicKeyPem) {
            throw new \RuntimeException('Chave pública não encontrada para o kid informado.');
        }

        $signingInput = $headerB64 . '.' . $payloadB64;
        $verified = openssl_verify($signingInput, $signature, $publicKeyPem, OPENSSL_ALGO_SHA256);
        if ($verified !== 1) {
            throw new \RuntimeException('Assinatura do token inválida.');
        }

        if (!in_array($payload['iss'] ?? '', self::VALID_ISSUERS, true)) {
            throw new \RuntimeException('Emissor (iss) inválido.');
        }
        if (($payload['aud'] ?? '') !== $expectedAudience) {
            throw new \RuntimeException('Audiência (aud) inválida.');
        }
        if (!isset($payload['exp']) || (int)$payload['exp'] < time()) {
            throw new \RuntimeException('Token expirado.');
        }

        return $payload;
    }

    private static function findPublicKey(array $jwks, string $kid): ?string
    {
        foreach ($jwks['keys'] ?? [] as $key) {
            if (($key['kid'] ?? '') === $kid && ($key['kty'] ?? '') === 'RSA') {
                return self::rsaComponentsToPem($key['n'], $key['e']);
            }
        }
        return null;
    }

    /** Builds a PEM public key from JWKS base64url-encoded RSA modulus (n) and exponent (e). */
    private static function rsaComponentsToPem(string $nB64, string $eB64): string
    {
        $modulus = self::base64urlDecode($nB64);
        $exponent = self::base64urlDecode($eB64);

        $modulusEncoded = self::derEncodeUnsignedInteger($modulus);
        $exponentEncoded = self::derEncodeUnsignedInteger($exponent);

        $sequence = self::derSequence($modulusEncoded . $exponentEncoded);
        $bitString = "\x03" . self::derLength(strlen($sequence) + 1) . "\x00" . $sequence;

        $algorithmIdentifier = hex2bin('300d06092a864886f70d0101010500'); // rsaEncryption OID
        $publicKeyInfo = self::derSequence($algorithmIdentifier . $bitString);

        $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($publicKeyInfo), 64, "\n") . "-----END PUBLIC KEY-----\n";
        return $pem;
    }

    private static function derEncodeUnsignedInteger(string $bytes): string
    {
        if (ord($bytes[0]) > 0x7f) $bytes = "\x00" . $bytes; // avoid being read as negative
        return "\x02" . self::derLength(strlen($bytes)) . $bytes;
    }

    private static function derSequence(string $contents): string
    {
        return "\x30" . self::derLength(strlen($contents)) . $contents;
    }

    private static function derLength(int $length): string
    {
        if ($length < 128) return chr($length);
        $bytes = ltrim(pack('N', $length), "\x00");
        return chr(0x80 | strlen($bytes)) . $bytes;
    }

    private static function base64urlDecode(string $data): string
    {
        $padded = str_pad(strtr($data, '-_', '+/'), strlen($data) % 4 === 0 ? strlen($data) : strlen($data) + (4 - strlen($data) % 4), '=');
        return base64_decode($padded);
    }

    private static function fetchJwksFromGoogle(?string $url = null): array
    {
        $context = stream_context_create(['http' => ['timeout' => 5]]);
        $raw = @file_get_contents($url ?? self::DEFAULT_JWKS_URL, false, $context);
        $decoded = $raw ? json_decode($raw, true) : null;
        if (!is_array($decoded)) {
            throw new \RuntimeException('Não foi possível obter as chaves públicas do Google.');
        }
        return $decoded;
    }
}
