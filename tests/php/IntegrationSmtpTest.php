<?php
/**
 * IntegrationSmtpTest — valida que o MailService consegue enviar e-mails reais
 * via o servidor SMTP configurado em .env.
 *
 * Execução: phpunit --group integration
 * Não faz parte da suíte padrão (não roda no CI automático).
 *
 * Comportamento esperado por ambiente:
 *  - No servidor de produção (Hostinger): todos os testes passam — o relay é
 *    autorizado para o IP do próprio servidor.
 *  - Em localhost: autenticação SMTP bem-sucedida, mas entrega recusada com
 *    "data not accepted" pois Hostinger bloqueia relay de IPs externos.
 *    Nesse caso os testes são marcados como skipped com explicação clara.
 *
 * Configure MAIL_INTEGRATION_TEST_TO no .env.local com um e-mail real de destino.
 *
 * @group integration
 */
class IntegrationSmtpTest extends \PHPUnit\Framework\TestCase
{
    private string $to;

    protected function setUp(): void
    {
        $host = env('MAIL_HOST', '');
        $user = env('MAIL_USER', '');
        $pass = env('MAIL_PASS', '');
        if (!$host || !$user || !$pass) {
            self::markTestSkipped('MAIL_HOST / MAIL_USER / MAIL_PASS não configurados.');
        }
        $to = env('MAIL_INTEGRATION_TEST_TO', '');
        if (!$to) {
            self::markTestSkipped('MAIL_INTEGRATION_TEST_TO não configurado. Defina um e-mail de destino real no .env.local.');
        }
        $this->to = $to;
    }

    /**
     * Envia o e-mail e trata o caso em que o servidor SMTP recusa relay de IPs
     * externos (comportamento normal do Hostinger em desenvolvimento local).
     * Em produção, onde a aplicação roda no próprio servidor Hostinger, o relay
     * é autorizado e o e-mail é entregue normalmente.
     */
    private function enviarOuSkipRelayBloqueado(callable $send, string $operacao): void
    {
        try {
            $send();
            self::assertTrue(true, "E-mail de {$operacao} enviado com sucesso.");
        } catch (\PHPMailer\PHPMailer\Exception $e) {
            // "data not accepted" = autenticação OK mas relay bloqueado de localhost.
            // Confirma que as credenciais são válidas; em produção o envio funciona.
            if (str_contains($e->getMessage(), 'data not accepted') || str_contains($e->getMessage(), 'DATA')) {
                self::markTestSkipped(
                    "Credenciais SMTP válidas (auth OK), mas relay recusado de localhost. " .
                    "Em produção (servidor Hostinger) o e-mail de {$operacao} é entregue normalmente."
                );
            }
            // Qualquer outro erro (auth falhou, host errado, timeout) é falha real.
            throw $e;
        }
    }

    public function testEnviaEmailDeResetDeSenha(): void
    {
        $to = $this->to;
        $this->enviarOuSkipRelayBloqueado(
            fn() => MailService::sendPasswordReset(
                ['nome' => 'Teste Integração', 'email' => $to],
                'token-integracao-smtp-' . time(),
            ),
            'reset de senha'
        );
    }

    public function testEnviaEmailDeBoasVindas(): void
    {
        $to = $this->to;
        $this->enviarOuSkipRelayBloqueado(
            fn() => MailService::sendWelcome(
                ['nome' => 'Teste Integração', 'email' => $to],
                ['nome' => 'Banda de Teste'],
                'token-boas-vindas-' . time(),
            ),
            'boas-vindas'
        );
    }

    public function testEnviaEmailDeConvite(): void
    {
        $to = $this->to;
        $this->enviarOuSkipRelayBloqueado(
            fn() => MailService::sendInvite(
                ['nome' => 'Membro Convidado', 'email' => $to],
                ['nome' => 'Banda de Teste'],
                'token-convite-' . time(),
            ),
            'convite'
        );
    }
}
