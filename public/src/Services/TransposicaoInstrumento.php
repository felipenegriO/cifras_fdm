<?php
/**
 * TransposicaoInstrumento — o quanto o instrumento sobe em relação às formas
 * mostradas na tela. Positivo é capotraste no violão ou transpose para cima no
 * teclado; negativo só existe para quem transpõe eletronicamente, porque não
 * há capotraste negativo.
 *
 * O som que sai nunca muda: a cifra é sempre guardada no tom soante, e o
 * deslocamento é aplicado apenas na exibição.
 */
class TransposicaoInstrumento
{
    public const MIN = -12;
    public const MAX = 12;

    /** Casa máxima aceita ao ler o capotraste de uma página importada. */
    public const CAPO_MAX_IMPORT = 12;

    public const INSTRUMENTOS = ['violao', 'teclado', 'outro'];
    public const PREFERENCIAS = ['simplificar', 'basico', 'cadastrado', 'nunca'];

    private const ROTULOS = [
        'violao'  => 'Capotraste',
        'teclado' => 'Transpose',
        'outro'   => 'Transposição',
    ];

    /** Devolve o deslocamento normalizado, ou null quando o valor é inválido. */
    public static function normalizar($valor): ?int
    {
        if ($valor === '' || $valor === null) {
            return 0;
        }
        if (is_bool($valor) || is_array($valor)) {
            return null;
        }
        // filter_var aceita 2.0 como inteiro, mas 1.5 deve ser recusado antes:
        // um deslocamento fracionário não corresponde a nenhuma casa real.
        if (is_float($valor) && $valor != (int) $valor) {
            return null;
        }
        $inteiro = filter_var($valor, FILTER_VALIDATE_INT);
        if ($inteiro === false) {
            return null;
        }
        return ($inteiro >= self::MIN && $inteiro <= self::MAX) ? $inteiro : null;
    }

    /**
     * Lê a casa do capotraste escrita em texto livre pela página de origem —
     * "2", "2ª casa", "Capotraste na 2ª casa". Devolve null quando não há
     * capotraste, quando o valor é zero ou quando passa do braço.
     */
    public static function casaDeCapo($texto): ?int
    {
        if (!is_string($texto) && !is_int($texto)) {
            return null;
        }
        // (?<![\d-]) recusa número com sinal: "-2" não é uma casa de capotraste.
        if (preg_match('/(?<![\d-])(\d{1,2})/', (string) $texto, $match) !== 1) {
            return null;
        }
        $casa = (int) $match[1];
        return ($casa >= 1 && $casa <= self::CAPO_MAX_IMPORT) ? $casa : null;
    }

    public static function instrumentoValido(string $instrumento): bool
    {
        return in_array($instrumento, self::INSTRUMENTOS, true);
    }

    public static function rotulo(string $instrumento): string
    {
        return self::ROTULOS[$instrumento] ?? 'Transposição';
    }
}
