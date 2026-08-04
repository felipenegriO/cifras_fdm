<?php

class RoteiroController
{
    public function show(): void
    {
        require_auth();
        render_view('roteiro');
    }
}
