<?php

use PHPUnit\Framework\TestCase;
use PHPMailer\PHPMailer\PHPMailer;

final class MailServiceTest extends TestCase
{
    public function testMailerUsaConfiguracaoDisponivel(): void
    {
        $method = new ReflectionMethod(MailService::class, 'mailer');
        $method->setAccessible(true);

        $mailer = $method->invoke(null);

        self::assertSame('smtp', $mailer->Mailer);
        self::assertNotSame('', $mailer->Host);
        self::assertGreaterThan(0, $mailer->Port);
        self::assertSame('utf-8', strtolower($mailer->CharSet));
        self::assertGreaterThan(0, $mailer->Timeout);
        self::assertSame($mailer->Timeout, $mailer->Timelimit);
    }

    public function testTemplateEscapaUrlRotuloEConteudoDinamico(): void
    {
        $method = new ReflectionMethod(MailService::class, 'template');
        $method->setAccessible(true);

        $html = $method->invoke(
            null,
            'Título seguro',
            '<p>Corpo permitido</p>',
            'https://cifro.test/reset?token=a&origem="email"',
            'Abrir <agora>'
        );

        self::assertStringContainsString('Título seguro', $html);
        self::assertStringContainsString('<p>Corpo permitido</p>', $html);
        self::assertStringContainsString('token=a&amp;origem=&quot;email&quot;', $html);
        self::assertStringContainsString('Abrir &lt;agora&gt;', $html);
    }

    public function testMailerRejeitaAutoloadInexistente(): void
    {
        $method = new ReflectionMethod(MailService::class, 'mailer');
        $method->setAccessible(true);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('PHPMailer não instalado');
        $method->invoke(null, __DIR__ . '/autoload-inexistente.php');
    }

    public function testDesenvolvimentoBloqueiaSmtpRealSemLiberacaoExplicita(): void
    {
        $method = new ReflectionMethod(MailService::class, 'envioBloqueadoEmTeste');
        $method->setAccessible(true);
        $originalEnv = getenv('APP_ENV');
        $originalAllow = getenv('MAIL_ALLOW_REAL_SEND');

        try {
            putenv('APP_ENV=development');
            putenv('MAIL_ALLOW_REAL_SEND=false');
            self::assertTrue($method->invoke(null, true));
            self::assertFalse($method->invoke(null, false));

            putenv('MAIL_ALLOW_REAL_SEND=true');
            self::assertFalse($method->invoke(null, true));
        } finally {
            $originalEnv === false ? putenv('APP_ENV') : putenv('APP_ENV=' . $originalEnv);
            $originalAllow === false ? putenv('MAIL_ALLOW_REAL_SEND') : putenv('MAIL_ALLOW_REAL_SEND=' . $originalAllow);
        }
    }

    public function testMontaEmailDeRedefinicaoESolicitaEnvio(): void
    {
        $mailer = $this->getMockBuilder(PHPMailer::class)
            ->setConstructorArgs([true])
            ->onlyMethods(['send'])
            ->getMock();
        $mailer->expects(self::once())->method('send')->willReturn(true);

        MailService::sendPasswordReset(
            ['nome' => 'Ana', 'email' => 'ana@example.com'],
            'token com espaço',
            $mailer
        );

        self::assertSame('Cifrô — Redefinição de senha', $mailer->Subject);
        self::assertStringContainsString('token+com+espa%C3%A7o', $mailer->Body);
        self::assertStringContainsString('ana@example.com', $mailer->Body);
    }

    public function testMontaEmailDeBoasVindasESolicitaEnvio(): void
    {
        $mailer = $this->getMockBuilder(PHPMailer::class)
            ->setConstructorArgs([true])
            ->onlyMethods(['send'])
            ->getMock();
        $mailer->expects(self::once())->method('send')->willReturn(true);

        MailService::sendWelcome(
            ['nome' => 'Carlos', 'email' => 'carlos@example.com'],
            ['nome' => 'Banda Rock'],
            'token-boas-vindas',
            $mailer
        );

        self::assertSame('Bem-vindo ao Cifrô! Defina sua senha', $mailer->Subject);
        self::assertStringContainsString('Carlos', $mailer->Body);
        self::assertStringContainsString('Banda Rock', $mailer->Body);
        self::assertStringContainsString('token-boas-vindas', $mailer->Body);
    }

    public function testMontaEmailDeConviteESolicitaEnvio(): void
    {
        $mailer = $this->getMockBuilder(PHPMailer::class)
            ->setConstructorArgs([true])
            ->onlyMethods(['send'])
            ->getMock();
        $mailer->expects(self::once())->method('send')->willReturn(true);

        MailService::sendInvite(
            ['nome' => 'Diana', 'email' => 'diana@example.com'],
            ['nome' => 'Banda Jazz'],
            'token-convite',
            $mailer
        );

        self::assertSame('Você foi convidado para o Cifrô', $mailer->Subject);
        self::assertStringContainsString('Banda Jazz', $mailer->Body);
        self::assertStringContainsString('token-convite', $mailer->Body);
    }

    public function testSendLoggedRelancaExcecaoERegistraErro(): void
    {
        $mailer = $this->getMockBuilder(PHPMailer::class)
            ->setConstructorArgs([true])
            ->onlyMethods(['send'])
            ->getMock();
        $mailer->method('send')->willThrowException(new RuntimeException('SMTP connection failed'));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SMTP connection failed');

        MailService::sendPasswordReset(
            ['nome' => 'Erro', 'email' => 'erro@example.com'],
            'token-erro',
            $mailer
        );
    }
}
