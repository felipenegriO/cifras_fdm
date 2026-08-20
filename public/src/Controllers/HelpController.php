<?php

class HelpController
{
    public function show(): void
    {
        require_auth();
        if (!help_center_visible_for_user()) {
            http_response_code(404);
            echo 'Central de Ajuda indisponível.';
            return;
        }

        $service = new HelpCenterService();
        render_view('help', [
            'articles' => $service->all(),
            'categories' => $service->categories(),
            'glossary' => $service->glossary(),
        ]);
    }
}
