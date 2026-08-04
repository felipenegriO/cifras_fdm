<?php
class SyncConflictException extends RuntimeException {
    private int $currentRevision;

    public function __construct(int $currentRevision) {
        parent::__construct('Os dados foram alterados em outro dispositivo. Atualize antes de salvar novamente.');
        $this->currentRevision = $currentRevision;
    }

    public function getCurrentRevision(): int {
        return $this->currentRevision;
    }
}
