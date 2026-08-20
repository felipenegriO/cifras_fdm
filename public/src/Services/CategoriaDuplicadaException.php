<?php
/**
 * Nome equivalente a uma categoria que já existe na banda, ignorando caixa e
 * acento. Carrega a categoria existente para que a interface possa selecioná-la
 * em vez de insistir em criar uma segunda.
 */
class CategoriaDuplicadaException extends RuntimeException {
    private array $existente;

    public function __construct(array $existente) {
        parent::__construct('Já existe uma categoria com esse nome.');
        $this->existente = $existente;
    }

    /** @return array{id:int,nome:string} */
    public function getCategoriaExistente(): array {
        return ['id' => (int) $this->existente['id'], 'nome' => (string) $this->existente['nome']];
    }
}
