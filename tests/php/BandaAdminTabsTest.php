<?php

use PHPUnit\Framework\TestCase;

/**
 * Quais abas do "Minha Banda" cada perfil enxerga.
 *
 * Regra separada do HTTP e do banco de propósito: é a mesma decisão usada para
 * desenhar a navegação e para validar a aba pedida na URL, e assim não há como
 * as duas divergirem. Esconder aba não é autorização — cada endpoint continua
 * barrando por conta própria.
 */
final class BandaAdminTabsTest extends TestCase
{
    /** Administrador: manda em tudo. */
    private function administrador(): array
    {
        return BandaAdminTabs::visiveis(true, true, true);
    }

    /** Gestor: edita conteúdo, não mexe em membros nem plano. */
    private function gestor(): array
    {
        return BandaAdminTabs::visiveis(false, false, true);
    }

    /** Básico e externo: nenhuma capacidade administrativa. */
    private function basico(): array
    {
        return BandaAdminTabs::visiveis(false, false, false);
    }

    public function testAdministradorEnxergaAsCincoAbas(): void
    {
        self::assertSame(
            ['dados', 'plano', 'membros', 'categorias', 'repertorios'],
            $this->administrador()
        );
    }

    public function testGestorEnxergaApenasConteudo(): void
    {
        // Preservar o que ele já faz hoje: categorias e repertórios.
        self::assertSame(['categorias', 'repertorios'], $this->gestor());
    }

    public function testGestorNaoEnxergaPlanoNemMembros(): void
    {
        self::assertNotContains('plano', $this->gestor());
        self::assertNotContains('membros', $this->gestor());
        self::assertNotContains('dados', $this->gestor());
    }

    public function testBasicoNaoEnxergaNenhumaAba(): void
    {
        self::assertSame([], $this->basico());
    }

    public function testQuemGerenciaMembrosSemEditarConteudoVeSoMembros(): void
    {
        // Combinação improvável hoje, mas a regra não pode inventar abas.
        self::assertSame(['membros'], BandaAdminTabs::visiveis(false, true, false));
    }

    // ---- validação da aba pedida na URL ----

    public function testAbaConhecidaEhAceita(): void
    {
        foreach (['dados', 'plano', 'membros', 'categorias', 'repertorios'] as $aba) {
            self::assertTrue(BandaAdminTabs::existe($aba), $aba);
        }
    }

    public function testAbaInventadaEhRejeitada(): void
    {
        self::assertFalse(BandaAdminTabs::existe('../../etc/passwd'));
        self::assertFalse(BandaAdminTabs::existe('nao_existe'));
        self::assertFalse(BandaAdminTabs::existe(''));
    }

    // ---- resolução da aba ativa ----

    public function testResolverDevolveAAbaPedidaQuandoPermitida(): void
    {
        self::assertSame('plano', BandaAdminTabs::resolver('plano', $this->administrador()));
    }

    public function testAbaSemPermissaoCaiNaPrimeiraPermitida(): void
    {
        // Gestor pedindo /minha-banda.php?aba=plano não pode ver erro nem tela
        // vazia: cai na primeira aba que ele pode.
        self::assertSame('categorias', BandaAdminTabs::resolver('plano', $this->gestor()));
    }

    public function testAbaInventadaCaiNaPrimeiraPermitida(): void
    {
        self::assertSame('dados', BandaAdminTabs::resolver('coisa_estranha', $this->administrador()));
    }

    public function testSemAbaPedidaUsaAPrimeiraPermitida(): void
    {
        self::assertSame('dados', BandaAdminTabs::resolver('', $this->administrador()));
        self::assertSame('categorias', BandaAdminTabs::resolver('', $this->gestor()));
    }

    public function testSemNenhumaAbaVisivelNaoHaAbaAtiva(): void
    {
        self::assertNull(BandaAdminTabs::resolver('plano', $this->basico()));
    }

    // ---- rótulos ----

    public function testTodaAbaTemRotulo(): void
    {
        foreach ($this->administrador() as $aba) {
            self::assertNotSame('', BandaAdminTabs::rotulo($aba), $aba);
        }
    }

    public function testRotuloDeAbaDesconhecidaNaoQuebra(): void
    {
        self::assertNotSame('', BandaAdminTabs::rotulo('inexistente'));
    }
}
