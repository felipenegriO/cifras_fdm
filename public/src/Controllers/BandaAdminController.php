<?php
/**
 * BandaAdminController — a tela "Minha Banda".
 *
 * Reúne dados da banda, plano, membros, categorias e repertórios em abas. Quem
 * decide as abas visíveis é BandaAdminTabs, para que a navegação desenhada e a
 * aba aceita na URL nunca divirjam.
 */
class BandaAdminController
{
    public function show(): void
    {
        require_auth();

        // Hoje administrar a banda e gerenciar membros são a mesma capacidade
        // (can_manage_band_users() é "administrador"). BandaAdminTabs recebe as
        // duas separadas de propósito: se um dia surgir um perfil que gerencia
        // membros sem editar dados da banda, a regra já acomoda sem reescrita.
        $ehAdministrador   = can_manage_band_users();
        $podeEditarConteudo = can_edit_content();

        $visiveis = BandaAdminTabs::visiveis($ehAdministrador, $ehAdministrador, $podeEditarConteudo);

        if ($visiveis === []) {
            $this->negarAcesso();
            return;
        }

        $bandaId      = current_band_id();
        $membros      = (new UserRepository())->countByBanda($bandaId);
        $categorias   = (new CategoriaRepository())->countByBanda($bandaId);
        $repertorios  = (new PlaylistRepository())->countByBanda($bandaId);
        $checklist    = BandaChecklistConfiguracao::concluido($membros, $categorias, $repertorios, $visiveis)
            ? []
            : BandaChecklistConfiguracao::passos($membros, $categorias, $repertorios, $visiveis);

        render_view('banda/minha-banda', [
            'abasVisiveis' => $visiveis,
            'abaAtiva'     => BandaAdminTabs::resolver((string) ($_GET['aba'] ?? ''), $visiveis),
            'checklist'    => $checklist,
        ]);
    }

    /** Mesmo formato de negação usado por bandas.php, para não inventar tela nova. */
    private function negarAcesso(): void
    {
        http_response_code(403);
        echo '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Acesso negado</title></head>'
            . '<body style="font-family:sans-serif;padding:40px;text-align:center">'
            . '<h2>403 — Acesso restrito</h2>'
            . '<p>Administrar a banda exige perfil de gestor ou administrador.</p>'
            . '<a href="' . e(base_url('/index.php')) . '">Voltar</a></body></html>';
        cifro_terminate();
    }
}
