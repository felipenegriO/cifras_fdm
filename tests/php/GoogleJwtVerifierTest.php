<?php

use PHPUnit\Framework\TestCase;

final class GoogleJwtVerifierTest extends TestCase
{
    private array $keyPair;

    protected function setUp(): void
    {
        $res = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($res, $privateKeyPem);
        $details = openssl_pkey_get_details($res);
        $this->keyPair = ['private' => $privateKeyPem, 'public_details' => $details];
    }

    private function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function makeToken(array $payload, ?string $kid = 'test-kid', bool $corruptSignature = false): string
    {
        $header = $this->base64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT', 'kid' => $kid]));
        $body = $this->base64url(json_encode($payload));
        $signingInput = $header . '.' . $body;

        openssl_sign($signingInput, $signature, $this->keyPair['private'], OPENSSL_ALGO_SHA256);
        if ($corruptSignature) $signature = strrev($signature);

        return $signingInput . '.' . $this->base64url($signature);
    }

    private function jwks(): array
    {
        $details = $this->keyPair['public_details']['rsa'];
        return [
            'keys' => [[
                'kid' => 'test-kid',
                'kty' => 'RSA',
                'n'   => $this->base64url($details['n']),
                'e'   => $this->base64url($details['e']),
            ]],
        ];
    }

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'iss' => 'https://accounts.google.com',
            'aud' => 'my-client-id',
            'sub' => 'google-user-sub-123',
            'email' => 'user@example.com',
            'email_verified' => true,
            'name' => 'Test User',
            'exp' => time() + 3600,
            'iat' => time(),
        ], $overrides);
    }

    public function testAceitaTokenValido(): void
    {
        $token = $this->makeToken($this->validPayload());
        $payload = GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
        self::assertSame('google-user-sub-123', $payload['sub']);
        self::assertSame('user@example.com', $payload['email']);
    }

    public function testRejeitaAssinaturaInvalida(): void
    {
        $token = $this->makeToken($this->validPayload(), 'test-kid', true);
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
    }

    public function testRejeitaAudienceErrada(): void
    {
        $token = $this->makeToken($this->validPayload(['aud' => 'outro-client-id']));
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
    }

    public function testRejeitaIssuerErrado(): void
    {
        $token = $this->makeToken($this->validPayload(['iss' => 'https://evil.example.com']));
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
    }

    public function testRejeitaTokenExpirado(): void
    {
        $token = $this->makeToken($this->validPayload(['exp' => time() - 60]));
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
    }

    public function testAceitaIssuerSemHttps(): void
    {
        $token = $this->makeToken($this->validPayload(['iss' => 'accounts.google.com']));
        $payload = GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
        self::assertSame('accounts.google.com', $payload['iss']);
    }

    public function testRejeitaKidDesconhecido(): void
    {
        $token = $this->makeToken($this->validPayload(), 'kid-que-nao-existe-no-jwks');
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
    }

    public function testRejeitaTokenComFormatoInvalido(): void
    {
        $this->expectException(\RuntimeException::class);
        GoogleJwtVerifier::verify('nao-e-um-jwt', 'my-client-id', fn() => $this->jwks());
    }

    public function testRejeitaHeaderOuPayloadNaoJson(): void
    {
        $signature = $this->base64url('assinatura');

        foreach ([
            $this->base64url('invalido') . '.' . $this->base64url('{}') . '.' . $signature,
            $this->base64url('{}') . '.' . $this->base64url('invalido') . '.' . $signature,
        ] as $token) {
            try {
                GoogleJwtVerifier::verify($token, 'my-client-id', fn() => $this->jwks());
                self::fail('Token inválido deveria ser rejeitado.');
            } catch (RuntimeException $error) {
                self::assertStringContainsString('payload inválido', $error->getMessage());
            }
        }
    }

    public function testRejeitaAlgoritmoDiferenteDeRs256(): void
    {
        $header = $this->base64url(json_encode(['alg' => 'HS256', 'kid' => 'test-kid']));
        $payload = $this->base64url(json_encode($this->validPayload()));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Algoritmo de assinatura não suportado.');
        GoogleJwtVerifier::verify($header . '.' . $payload . '.' . $this->base64url('x'), 'my-client-id', fn() => $this->jwks());
    }

    public function testFetchJwksRealDecodificaJsonERejeitaConteudoInvalido(): void
    {
        $method = new ReflectionMethod(GoogleJwtVerifier::class, 'fetchJwksFromGoogle');
        $method->setAccessible(true);
        $url = 'data://text/plain,' . rawurlencode(json_encode(['keys' => []]));
        self::assertSame(['keys' => []], $method->invoke(null, $url));

        $this->expectException(RuntimeException::class);
        $method->invoke(null, 'data://text/plain,nao-json');
    }

    /** Exercises the real default fetchJwksFromGoogle() (no injected $fetchJwks). */
    public function testUsaFetchJwksPadraoQuandoNaoInjetado(): void
    {
        $token = $this->makeToken($this->validPayload());
        // No third argument: exercises the real default closure, which
        // attempts a real HTTPS fetch to Google's JWKS endpoint. Depending on
        // the sandbox's network reachability this either fails outright
        // ("could not fetch keys") or succeeds but finds no key matching our
        // test token's arbitrary "kid" ("chave pública não encontrada").
        // Both outcomes exercise the real default closure/branch and are
        // acceptable; the happy-path (successful fetch + matching kid) is
        // covered indirectly by the injected-$fetchJwks tests above, which
        // use the same decode/validation logic fetchJwksFromGoogle() also
        // exercises.
        try {
            GoogleJwtVerifier::verify($token, 'my-client-id');
            self::fail('Esperava RuntimeException (rede indisponível ou kid não encontrado).');
        } catch (\RuntimeException $e) {
            self::assertThat(
                $e->getMessage(),
                self::logicalOr(
                    self::stringContains('Não foi possível obter as chaves públicas do Google.'),
                    self::stringContains('Chave pública não encontrada para o kid informado.')
                )
            );
        }
    }
}
