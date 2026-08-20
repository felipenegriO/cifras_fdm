<?php
/**
 * Regras do convite de banda por link, sem banco e sem sessão.
 *
 * Fica separado do repositório de propósito: "este convite ainda vale?" é a
 * pergunta que register, Google e login fazem, e ela não deveria exigir um
 * banco de dados para ser respondida num teste.
 */
class BandaConvitePolicy
{
    /**
     * Validade do link, em segundos. 24h é curto de propósito: o link circula
     * em grupo de WhatsApp, e a janela apertada é o que substitui o limite de
     * usos que esta funcionalidade não tem.
     */
    public const TTL_SEGUNDOS = 86400;

    /** Perfil de quem entra pelo link. Promoção é feita depois, na lista de membros. */
    public const PERFIL = 'basico';

    public static function estaValido(?array $convite, ?int $agora = null): bool
    {
        if (!$convite) return false;
        if (!empty($convite['revogado_em'])) return false;

        $expira = strtotime((string) ($convite['expira_em'] ?? ''));
        if ($expira === false) return false;

        return $expira > ($agora ?? time());
    }

    public static function expiraEm(?int $agora = null): string
    {
        return date('Y-m-d H:i:s', ($agora ?? time()) + self::TTL_SEGUNDOS);
    }

    /** Rótulo curto para a linha de estado do administrador: "17/08 às 19h32". */
    public static function rotuloValidade(string $expiraEm): string
    {
        $quando = strtotime($expiraEm);
        if ($quando === false) return '';
        return date('d/m', $quando) . ' às ' . date('H\hi', $quando);
    }
}
