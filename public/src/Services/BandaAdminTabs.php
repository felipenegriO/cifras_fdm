<?php
/**
 * BandaAdminTabs — quais abas do "Minha Banda" cada perfil enxerga.
 *
 * Sem HTTP e sem banco de propósito: a mesma decisão desenha a navegação e
 * valida a aba pedida na URL, então as duas não têm como divergir. E fica
 * testável sem browser.
 *
 * Esconder uma aba NÃO é autorização: cada endpoint continua barrando por
 * conta própria, conforme a convenção do projeto.
 */
class BandaAdminTabs
{
    public const DADOS       = 'dados';
    public const PLANO       = 'plano';
    public const MEMBROS     = 'membros';
    public const CATEGORIAS  = 'categorias';
    public const REPERTORIOS = 'repertorios';

    /** Ordem de exibição; também define qual é a "primeira permitida". */
    private const ORDEM = [self::DADOS, self::PLANO, self::MEMBROS, self::CATEGORIAS, self::REPERTORIOS];

    private const ROTULOS = [
        self::DADOS       => 'Dados da banda',
        self::PLANO       => 'Plano',
        self::MEMBROS     => 'Membros',
        self::CATEGORIAS  => 'Categorias',
        self::REPERTORIOS => 'Repertórios',
    ];

    /**
     * @param bool $podeAdministrar      administrador da banda (dados e plano)
     * @param bool $podeGerenciarMembros can_manage_band_users()
     * @param bool $podeEditarConteudo   can_edit_content() — gestor para cima
     * @return string[] abas na ordem de exibição
     */
    public static function visiveis(bool $podeAdministrar, bool $podeGerenciarMembros, bool $podeEditarConteudo): array
    {
        $permitidas = [
            self::DADOS       => $podeAdministrar,
            self::PLANO       => $podeAdministrar,
            self::MEMBROS     => $podeGerenciarMembros,
            self::CATEGORIAS  => $podeEditarConteudo,
            self::REPERTORIOS => $podeEditarConteudo,
        ];

        return array_values(array_filter(self::ORDEM, fn(string $aba): bool => $permitidas[$aba]));
    }

    public static function existe(string $aba): bool
    {
        return in_array($aba, self::ORDEM, true);
    }

    /**
     * Aba que deve ser exibida, dada a que o usuário pediu.
     *
     * Aba inventada ou sem permissão não vira erro nem tela vazia: cai na
     * primeira que ele pode ver. Devolve null quando não há nenhuma — aí quem
     * chama nega o acesso à tela inteira.
     */
    public static function resolver(string $pedida, array $visiveis): ?string
    {
        if ($visiveis === []) return null;
        if (in_array($pedida, $visiveis, true)) return $pedida;
        return $visiveis[0];
    }

    public static function rotulo(string $aba): string
    {
        return self::ROTULOS[$aba] ?? 'Seção';
    }
}
