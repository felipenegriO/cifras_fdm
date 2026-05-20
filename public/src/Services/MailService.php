<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;

class MailService {
    private static function mailer(): PHPMailer {
        $vendorAutoload = __DIR__ . '/../../../vendor/autoload.php';
        if (!file_exists($vendorAutoload)) {
            throw new RuntimeException('PHPMailer não instalado. Execute: composer install');
        }
        require_once $vendorAutoload;

        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = env('MAIL_HOST', 'mail.hostinger.com');
        $mail->SMTPAuth   = true;
        $mail->Username   = env('MAIL_USER', '');
        $mail->Password   = env('MAIL_PASS', '');
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = (int) env('MAIL_PORT', 465);
        $mail->CharSet    = PHPMailer::CHARSET_UTF8;

        $fromEmail = env('MAIL_USER', 'noreply@stagebox.com.br');
        $fromName  = env('MAIL_FROM_NAME', 'StageBox - Cifras');
        $mail->setFrom($fromEmail, $fromName);

        return $mail;
    }

    /** Boas-vindas + link para definir senha (novo cadastro). */
    public static function sendWelcome(array $usuario, array $banda, string $token): void {
        $appUrl = rtrim(env('APP_URL', 'https://stagebox.com.br'), '/');
        $link   = $appUrl . '/definir-senha.php?token=' . urlencode($token);

        $mail = self::mailer();
        $mail->addAddress($usuario['email'], $usuario['nome']);
        $mail->isHTML(true);
        $mail->Subject = 'Bem-vindo ao StageBox! Defina sua senha';
        $mail->Body = self::template(
            'Bem-vindo, ' . htmlspecialchars($usuario['nome']) . '!',
            '<p>Sua conta foi criada para a banda <strong>' . htmlspecialchars($banda['nome']) . '</strong>.</p>
             <p>Clique no botão abaixo para definir sua senha e ativar o acesso. O link é válido por 48 horas.</p>',
            $link,
            'Definir minha senha'
        );
        $mail->AltBody = "Bem-vindo ao StageBox!\n\nAcesse o link abaixo para definir sua senha:\n{$link}\n\nVálido por 48 horas.";
        $mail->send();
    }

    /** Convite quando admin cria usuário pelo painel. */
    public static function sendInvite(array $usuario, array $banda, string $token): void {
        $appUrl = rtrim(env('APP_URL', 'https://stagebox.com.br'), '/');
        $link   = $appUrl . '/definir-senha.php?token=' . urlencode($token);

        $mail = self::mailer();
        $mail->addAddress($usuario['email'], $usuario['nome']);
        $mail->isHTML(true);
        $mail->Subject = 'Você foi convidado para o StageBox';
        $mail->Body = self::template(
            'Você foi convidado!',
            '<p>Você foi adicionado à banda <strong>' . htmlspecialchars($banda['nome']) . '</strong> no StageBox.</p>
             <p>Clique no botão abaixo para definir sua senha e acessar. O link é válido por 48 horas.</p>',
            $link,
            'Aceitar convite'
        );
        $mail->AltBody = "Você foi convidado para o StageBox!\n\nAcesse:\n{$link}\n\nVálido por 48 horas.";
        $mail->send();
    }

    /** Reset de senha. */
    public static function sendPasswordReset(array $usuario, string $token): void {
        $appUrl = rtrim(env('APP_URL', 'https://stagebox.com.br'), '/');
        $link   = $appUrl . '/reset-senha.php?token=' . urlencode($token);

        $mail = self::mailer();
        $mail->addAddress($usuario['email'], $usuario['nome']);
        $mail->isHTML(true);
        $mail->Subject = 'StageBox — Redefinição de senha';
        $mail->Body = self::template(
            'Redefinir senha',
            '<p>Recebemos uma solicitação para redefinir a senha da conta <strong>' . htmlspecialchars($usuario['username']) . '</strong>.</p>
             <p>Se não foi você, ignore este e-mail. O link expira em <strong>1 hora</strong>.</p>',
            $link,
            'Redefinir minha senha'
        );
        $mail->AltBody = "Redefinição de senha StageBox\n\nAcesse:\n{$link}\n\nVálido por 1 hora.";
        $mail->send();
    }

    private static function template(string $heading, string $body, string $ctaUrl, string $ctaLabel): string {
        return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#111;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:40px 0">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#1e1e1e;border-radius:12px;overflow:hidden;border:1px solid #333">
<tr><td style="background:#7c3aed;padding:24px 32px">
  <h1 style="margin:0;color:#fff;font-size:22px">StageBox - Cifras</h1>
</td></tr>
<tr><td style="padding:32px">
  <h2 style="color:#fff;margin:0 0 16px;font-size:20px">' . $heading . '</h2>
  <div style="color:#ccc;font-size:15px;line-height:1.6">' . $body . '</div>
  <div style="margin-top:28px">
    <a href="' . htmlspecialchars($ctaUrl) . '" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:bold;font-size:15px">' . htmlspecialchars($ctaLabel) . '</a>
  </div>
  <p style="margin-top:24px;color:#666;font-size:12px">Se o botão não funcionar, copie e cole este link:<br><a href="' . htmlspecialchars($ctaUrl) . '" style="color:#7c3aed">' . htmlspecialchars($ctaUrl) . '</a></p>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #333;color:#555;font-size:12px">
  StageBox - Cifras · Você recebeu este e-mail pois sua conta está cadastrada em nosso sistema.
</td></tr>
</table>
</td></tr>
</table>
</body></html>';
    }
}
