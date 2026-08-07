<?php
/**
 * PlanoViewModel — computes all display/state data for the /plano.php view.
 *
 * Pulled out of the view so the branching around usage bars, Stripe link
 * validation, PIX phone normalization and WhatsApp message building can be
 * unit tested directly instead of only through full-page Playwright runs.
 */
class PlanoViewModel
{
    public static function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone);
        if (strlen($digits) === 14 && str_starts_with($digits, '550')) {
            $digits = '55' . substr($digits, 3);
        } elseif (strlen($digits) === 12 && str_starts_with($digits, '0')) {
            $digits = '55' . substr($digits, 1);
        } elseif (strlen($digits) >= 10 && strlen($digits) <= 11 && !str_starts_with($digits, '55')) {
            $digits = '55' . $digits;
        }
        return $digits;
    }

    public static function isStripeEnabled(string $secret): bool
    {
        return str_starts_with(trim($secret), 'sk_') && !str_contains($secret, '...');
    }

    /**
     * @return array{pct:int,class:string}
     */
    public static function usageBar(int $current, int $limit): array
    {
        if ($limit === -1) {
            return ['pct' => 0, 'class' => 'unlimited'];
        }
        $pct = $limit > 0 ? min(100, (int)round($current / $limit * 100)) : 0;
        $class = $pct >= 100 ? 'full' : ($pct >= 80 ? 'warn' : 'ok');
        return ['pct' => $pct, 'class' => $class];
    }

    /** Simple two-state bar (membros/setlists rows): full when at/over limit, else ok. */
    public static function simpleUsageBar(int $current, int $limit): array
    {
        if ($limit === -1) {
            return ['pct' => 0, 'class' => 'unlimited'];
        }
        $pct = min(100, (int)round($current / max(1, $limit) * 100));
        $class = $current >= $limit ? 'full' : 'ok';
        return ['pct' => $pct, 'class' => $class];
    }

    public static function badgeClass(bool $isPago, bool $isBloqueado): string
    {
        if ($isPago) return 'pago';
        if ($isBloqueado) return 'bloqueado';
        return 'gratuito';
    }

    public static function paymentAction(bool $isPago, string $tipo, string $plano): string
    {
        if (!$isPago) return 'assinar';
        return $tipo === $plano ? 'renovar' : 'trocar para';
    }

    public static function buildWhatsappUrl(string $whatsappPhone, string $message): string
    {
        return 'https://wa.me/' . $whatsappPhone . '?text=' . rawurlencode($message);
    }

    public static function buildMailtoUrl(string $subject, string $message): string
    {
        return 'mailto:contato@cifro.online?subject=' . rawurlencode($subject) . '&body=' . rawurlencode($message);
    }

    public static function isPixEnabled(string $pixPhoneDigits, string $whatsappPhoneDigits): bool
    {
        return strlen($pixPhoneDigits) >= 12 && strlen($pixPhoneDigits) <= 13
            && strlen($whatsappPhoneDigits) >= 12 && strlen($whatsappPhoneDigits) <= 13;
    }

    public static function cancelUrl(bool $pixEnabled, string $whatsappPhone, string $cancelMessage): string
    {
        return $pixEnabled
            ? self::buildWhatsappUrl($whatsappPhone, $cancelMessage)
            : self::buildMailtoUrl('Cancelamento de plano', $cancelMessage);
    }

    public static function paymentReference(string $bandaId): string
    {
        return $bandaId !== '' ? strtoupper(substr($bandaId, 0, 8)) : '';
    }
}
