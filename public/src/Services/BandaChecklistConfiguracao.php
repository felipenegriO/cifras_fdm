<?php
/**
 * BandaChecklistConfiguracao — o que ainda falta configurar numa banda.
 *
 * Regra pura, sem HTTP e sem banco: quem chama traz as contagens. Assim a
 * decisão de "o que está pendente" fica testável sem browser, no mesmo espírito
 * de BandaAdminTabs.
 *
 * Alcance conhecido: o checklist vive na tela Minha Banda, então só é visto por
 * quem entra lá. O músico que usa apenas a Home não o encontra — decisão
 * registrada no design de 2026-08-19.
 *
 * Um passo só entra na lista se a aba dele estiver em $abasVisiveis — a mesma
 * lista que BandaAdminTabs::visiveis() já calculou para desenhar a navegação.
 * Um gestor não gerencia membros (só administrador enxerga a aba Membros), então
 * não faz sentido cobrar dele um passo que leva a uma tela que ele não acessa.
 * Quem chama traz $abasVisiveis pronta; esta classe não decide permissão, só
 * filtra por ela.
 */
class BandaChecklistConfiguracao
{
    /**
     * @param string[] $abasVisiveis abas que o usuário atual enxerga (BandaAdminTabs::visiveis())
     * @return list<array{id:string,rotulo:string,aba:string,concluido:bool}>
     */
    public static function passos(int $membros, int $categorias, int $repertorios, array $abasVisiveis): array
    {
        $todos = [
            ['id' => 'membros',     'rotulo' => 'Convidar músicos',           'aba' => BandaAdminTabs::MEMBROS,     'concluido' => $membros > 1],
            ['id' => 'categorias',  'rotulo' => 'Criar categorias',           'aba' => BandaAdminTabs::CATEGORIAS,  'concluido' => $categorias > 0],
            ['id' => 'repertorios', 'rotulo' => 'Montar o primeiro repertório', 'aba' => BandaAdminTabs::REPERTORIOS, 'concluido' => $repertorios > 0],
        ];

        return array_values(array_filter(
            $todos,
            fn(array $passo): bool => in_array($passo['aba'], $abasVisiveis, true)
        ));
    }

    /** @param string[] $abasVisiveis abas que o usuário atual enxerga (BandaAdminTabs::visiveis()) */
    public static function concluido(int $membros, int $categorias, int $repertorios, array $abasVisiveis): bool
    {
        foreach (self::passos($membros, $categorias, $repertorios, $abasVisiveis) as $passo) {
            if (!$passo['concluido']) return false;
        }
        return true;
    }
}
