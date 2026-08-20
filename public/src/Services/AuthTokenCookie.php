<?php
/**
 * AuthTokenCookie — leitura e escrita do cookie "lembrar-me".
 * Mantém os atributos de segurança num lugar só.
 */
class AuthTokenCookie
{
    /**
     * Sob HTTPS o cookie usa o prefixo __Host-, que o navegador só aceita com
     * Secure + path=/ e sem Domain. Isso bloqueia "cookie tossing": um
     * subdomínio comprometido não consegue plantar um cookie de mesmo nome
     * para logar a vítima na conta do atacante.
     */
    public static function nome(): string
    {
        return self::isHttps() ? '__Host-cifro_lembrar' : 'cifro_lembrar';
    }

    public static function ler(): string
    {
        // Aceita os dois nomes: quem já tinha o cookie sem prefixo não é
        // deslogado quando o app passa a rodar em HTTPS.
        return (string) ($_COOKIE[self::nome()] ?? $_COOKIE['cifro_lembrar'] ?? '');
    }

    public static function gravar(string $seletor, string $validador): void
    {
        if (headers_sent()) return;
        $valor = $seletor . ':' . $validador;
        setcookie(self::nome(), $valor, self::opcoes(time() + AuthTokenService::VALIDADE_SEGUNDOS));
        $_COOKIE[self::nome()] = $valor;
    }

    public static function apagar(): void
    {
        foreach ([self::nome(), 'cifro_lembrar'] as $nome) {
            unset($_COOKIE[$nome]);
            if (!headers_sent()) setcookie($nome, '', self::opcoes(time() - 42000));
        }
    }

    private static function isHttps(): bool
    {
        return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    }

    private static function opcoes(int $expira): array
    {
        return [
            'expires'  => $expira,
            'path'     => '/',
            'domain'   => '',
            'secure'   => self::isHttps(),
            'httponly' => true,
            'samesite' => 'Lax',
        ];
    }
}
