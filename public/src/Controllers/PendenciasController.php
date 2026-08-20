<?php
/**
 * Pendências de personalização: músicas em que o cadastro da banda mudou e o
 * músico tinha um capotraste próprio. A comparação acontece no cliente, com os
 * dados que já vêm no snapshot de sync — assim a tela funciona offline.
 */
class PendenciasController
{
    public function show(): void
    {
        require_auth();
        render_view('pendencias');
    }
}
