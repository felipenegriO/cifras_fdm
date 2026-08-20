<?php

use PHPUnit\Framework\TestCase;

final class AuthTokenServiceTest extends TestCase
{
    private function repoQueRetorna(?array $linha): AuthTokenRepository
    {
        $repo = $this->createMock(AuthTokenRepository::class);
        $repo->method('encontrarPorSeletor')->willReturn($linha);
        return $repo;
    }

    private function linha(
        string $validador,
        string $usuarioId = 'user-1',
        ?string $validadorAnterior = null,
        ?int $segundosDesdeRotacao = null
    ): array {
        return [
            'seletor'                 => 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
            'validador_hash'          => hash('sha256', $validador),
            'validador_anterior_hash' => $validadorAnterior === null ? null : hash('sha256', $validadorAnterior),
            'segundos_desde_rotacao'  => $segundosDesdeRotacao,
            'usuario_id'              => $usuarioId,
        ];
    }

    // ---- parseCookie ----

    public function testParseCookieAceitaFormatoSeletorDoisPontosValidador(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna(null));
        self::assertSame(
            ['seletor' => 'abc', 'validador' => 'xyz'],
            $service->parseCookie('abc:xyz')
        );
    }

    public function testParseCookieRejeitaCookieSemSeparador(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna(null));
        self::assertNull($service->parseCookie('semseparador'));
    }

    public function testParseCookieRejeitaCookieVazioOuIncompleto(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna(null));
        self::assertNull($service->parseCookie(''));
        self::assertNull($service->parseCookie('abc:'));
        self::assertNull($service->parseCookie(':xyz'));
    }

    // ---- validar ----

    public function testTokenValidoIdentificaOUsuario(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna($this->linha('validador-secreto')));
        $resultado = $service->validar('a1b2c3d4e5f60718293a4b5c6d7e8f90:validador-secreto');
        self::assertSame('valido', $resultado['status']);
        self::assertSame('user-1', $resultado['usuarioId']);
    }

    public function testValidadorErradoNaoAutentica(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna($this->linha('validador-secreto')));
        $resultado = $service->validar('a1b2c3d4e5f60718293a4b5c6d7e8f90:validador-errado');
        self::assertSame('reuso_detectado', $resultado['status']);
        self::assertSame('user-1', $resultado['usuarioId']);
    }

    public function testSeletorInexistenteEhInvalido(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna(null));
        $resultado = $service->validar('naoexiste:qualquer');
        self::assertSame('invalido', $resultado['status']);
        self::assertArrayNotHasKey('usuarioId', $resultado);
    }

    // ---- janela de concorrência ----
    // O navegador dispara várias requisições com o mesmo cookie; sem essa
    // janela, a segunda derrubaria o login do usuário em todos os aparelhos.

    public function testRequisicaoIrmaComValidadorRecemTrocadoContinuaAutenticada(): void
    {
        $linha = $this->linha('novo-validador', 'user-1', 'validador-anterior', 2);
        $service = new AuthTokenService($this->repoQueRetorna($linha));
        $resultado = $service->validar('a1b2c3d4e5f60718293a4b5c6d7e8f90:validador-anterior');
        self::assertSame('valido_concorrente', $resultado['status']);
        self::assertSame('user-1', $resultado['usuarioId']);
    }

    public function testValidadorAnteriorForaDaJanelaEhTratadoComoRoubo(): void
    {
        $foraDaJanela = AuthTokenService::JANELA_CONCORRENCIA_SEGUNDOS + 1;
        $linha = $this->linha('novo-validador', 'user-1', 'validador-anterior', $foraDaJanela);
        $service = new AuthTokenService($this->repoQueRetorna($linha));
        self::assertSame(
            'reuso_detectado',
            $service->validar('a1b2c3d4e5f60718293a4b5c6d7e8f90:validador-anterior')['status']
        );
    }

    public function testValidadorDesconhecidoEhRouboMesmoDentroDaJanela(): void
    {
        $linha = $this->linha('novo-validador', 'user-1', 'validador-anterior', 2);
        $service = new AuthTokenService($this->repoQueRetorna($linha));
        self::assertSame(
            'reuso_detectado',
            $service->validar('a1b2c3d4e5f60718293a4b5c6d7e8f90:nunca-existiu')['status']
        );
    }

    public function testTokenSemRotacaoAindaTrataValidadorErradoComoRoubo(): void
    {
        $service = new AuthTokenService($this->repoQueRetorna($this->linha('validador-secreto')));
        self::assertSame(
            'reuso_detectado',
            $service->validar('a1b2c3d4e5f60718293a4b5c6d7e8f90:validador-errado')['status']
        );
    }

    public function testCookieMalformadoEhTratadoComoAusente(): void
    {
        $repo = $this->createMock(AuthTokenRepository::class);
        $repo->expects(self::never())->method('encontrarPorSeletor');
        $service = new AuthTokenService($repo);
        self::assertSame('invalido', $service->validar('lixo-sem-dois-pontos')['status']);
    }
}
