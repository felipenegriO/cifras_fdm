<?php
/**
 * Convite recusado durante o cadastro. Existe para abortar a transação sem
 * confundir a recusa (regra de negócio) com uma falha de banco.
 */
class ConviteRecusadoException extends RuntimeException
{
    /** @var string 'convite_invalido' | 'plano_limite' */
    public string $motivo;

    public function __construct(string $motivo)
    {
        $this->motivo = $motivo;
        parent::__construct('Convite recusado: ' . $motivo);
    }
}
