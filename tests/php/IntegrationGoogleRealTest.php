<?php

/** @group integration */
final class IntegrationGoogleRealTest extends \PHPUnit\Framework\TestCase
{
    public function testValidaIdTokenRealComAsChavesPublicasDoGoogle(): void
    {
        $token = trim((string) env('E2E_GOOGLE_ID_TOKEN', ''));
        $clientId = trim((string) env('GOOGLE_CLIENT_ID', ''));
        if ($token === '' || $clientId === '') {
            self::markTestSkipped('E2E_GOOGLE_ID_TOKEN e GOOGLE_CLIENT_ID são obrigatórios para Google real.');
        }

        $payload = GoogleJwtVerifier::verify($token, $clientId);
        self::assertTrue((bool) ($payload['email_verified'] ?? false));
        self::assertNotEmpty($payload['sub'] ?? '');
        self::assertNotEmpty($payload['email'] ?? '');
    }
}
