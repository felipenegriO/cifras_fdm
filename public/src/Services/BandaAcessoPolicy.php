<?php
/**
 * BandaAcessoPolicy — decide se um músico pode entrar numa banda AGORA.
 *
 * Sem HTTP e sem banco de propósito: a mesma decisão é usada na revalidação a
 * cada requisição (bootstrap) e na pintura da lista de bandas (select-banda),
 * e assim não há como as duas divergirem.
 *
 * Distinta das barreiras de CONTA (AuthService::motivoParaRecusarConta): aqui o
 * usuário continua logado, só perde aquela banda.
 */
class BandaAcessoPolicy
{
    /** Não é (ou deixou de ser) membro — vínculo apagado, ou banda inexistente. */
    public const REMOVIDO = 'removido';

    /** A banda inteira foi desativada; nem administrador entra. */
    public const DESATIVADA = 'desativada';

    /** Plano bloqueado: a banda existe, mas está fora do ar por pagamento. */
    public const PLANO_BLOQUEADO = 'plano_bloqueado';

    /**
     * @param array|null  $banda         linha de `bandas`, ou null se não existe
     * @param string|null $perfilVinculo perfil em `usuario_banda`, ou null se não há vínculo
     * @return string|null null quando o acesso está liberado
     */
    public static function motivoParaBloquear(?array $banda, ?string $perfilVinculo): ?string
    {
        if ($banda === null || $perfilVinculo === null || $perfilVinculo === '') {
            return self::REMOVIDO;
        }
        // Banda desativada vem antes do plano: é a causa mais forte, e é a que
        // o músico precisa ouvir.
        if ((int) ($banda['ativo'] ?? 1) !== 1) {
            return self::DESATIVADA;
        }
        if ((string) ($banda['plano'] ?? '') === 'bloqueado') {
            return self::PLANO_BLOQUEADO;
        }
        return null;
    }

    /**
     * A banda ainda pode ser ABERTA, mesmo bloqueada?
     *
     * Separado de motivoParaBloquear de propósito: plano bloqueado tranca o
     * palco, não a porta. Quem entra numa banda com plano vencido cai na tela
     * de pagamento (cifro_check_plano) — e é exatamente para lá que ele quer
     * ir. Pintar o card como morto deixaria um administrador com duas bandas
     * sem nenhum caminho até o próprio pagamento.
     */
    public static function impedeAbrir(?string $motivo): bool
    {
        return $motivo !== null && $motivo !== self::PLANO_BLOQUEADO;
    }

    /** Texto curto para mostrar ao músico no lugar do botão da banda. */
    public static function rotulo(?string $motivo): string
    {
        switch ($motivo) {
            case self::REMOVIDO:        return 'Sem acesso';
            case self::DESATIVADA:      return 'Desativada';
            case self::PLANO_BLOQUEADO: return 'Plano vencido';
            default:                    return 'Indisponível';
        }
    }
}
