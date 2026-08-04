<?php
class ClosedBetaPolicy
{
    private bool $enabled;
    private array $bandIds;

    public function __construct(bool $enabled, array $bandIds)
    {
        $ids = array_values(array_unique(array_filter(array_map('trim', $bandIds))));
        if ($enabled && count($ids) > 5) {
            throw new RuntimeException('BETA_INVITED_BAND_IDS aceita no máximo cinco bandas.');
        }
        $this->enabled = $enabled;
        $this->bandIds = $ids;
    }

    public static function fromEnvironment(): self
    {
        $enabled = filter_var(env('BETA_CLOSED_ENABLED', 'false'), FILTER_VALIDATE_BOOLEAN);
        return new self($enabled, explode(',', (string) env('BETA_INVITED_BAND_IDS', '')));
    }

    public function allows(string $bandId): bool
    {
        return !$this->enabled || $bandId === '' || in_array($bandId, $this->bandIds, true);
    }

    public function enabled(): bool
    {
        return $this->enabled;
    }
}
