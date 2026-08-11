<?php

/** @group integration */
final class IntegrationMailboxReceiptTest extends \PHPUnit\Framework\TestCase
{
    public function testEmailDeRecuperacaoChegaNaCaixaRealComLinkUtilizavel(): void
    {
        $mailbox = trim((string) env('E2E_IMAP_MAILBOX', ''));
        $user = trim((string) env('E2E_IMAP_USER', ''));
        $password = (string) env('E2E_IMAP_PASSWORD', '');
        $to = trim((string) env('MAIL_INTEGRATION_TEST_TO', ''));
        if (!function_exists('imap_open') || $mailbox === '' || $user === '' || $password === '' || $to === '') {
            self::markTestSkipped('Extensão IMAP e E2E_IMAP_MAILBOX/USER/PASSWORD são obrigatórios.');
        }

        $token = 'mailbox-e2e-' . bin2hex(random_bytes(10));
        MailService::sendPasswordReset(['nome' => 'Teste Mailbox', 'email' => $to], $token);
        $connection = imap_open($mailbox, $user, $password);
        self::assertNotFalse($connection, 'Não foi possível abrir a caixa IMAP.');
        try {
            $found = [];
            $deadline = time() + 60;
            do {
                imap_check($connection);
                $found = imap_search($connection, 'SUBJECT "Redefinição de senha"') ?: [];
                foreach (array_reverse($found) as $number) {
                    $body = imap_body($connection, $number);
                    if (str_contains($body, $token)) {
                        self::assertStringContainsString('/reset-senha.php?token=', $body);
                        return;
                    }
                }
                usleep(2000000);
            } while (time() < $deadline);
            self::fail('O e-mail real não chegou com o token esperado em até 60 segundos.');
        } finally {
            imap_close($connection);
        }
    }
}
