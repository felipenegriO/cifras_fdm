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
}
