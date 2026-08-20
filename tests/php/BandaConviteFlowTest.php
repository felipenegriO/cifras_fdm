<?php

use PHPUnit\Framework\TestCase;

final class BandaConviteFlowTest extends TestCase
{
    private PDO $pdo;
    private string $bandaId;
    private string $adminId;
    private string $convidadoId;
    private BandaConviteRepository $convites;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();

        $sufixo = bin2hex(random_bytes(8));
        $this->bandaId     = 'fluxo-banda-' . $sufixo;
        $this->adminId     = 'fluxo-admin-' . $sufixo;
        $this->convidadoId = 'fluxo-convidado-' . $sufixo;

        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?,?,?)')
            ->execute([$this->bandaId, 'Banda do Fluxo', 'mensal']);
        foreach ([[$this->adminId, 'Admin'], [$this->convidadoId, 'Convidado']] as [$id, $nome]) {
            $this->pdo->prepare('INSERT INTO usuarios (id, nome, email, perfil, ativo) VALUES (?,?,?,?,?)')
                ->execute([$id, $nome, $id . '@fluxo.local', 'usuario', 1]);
        }
        $this->pdo->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)')
            ->execute([$this->adminId, $this->bandaId, 'administrador']);

        $this->convites = new BandaConviteRepository($this->pdo);
        $_SESSION = [];
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) $this->pdo->rollBack();
        $_SESSION = [];
    }

    /**
     * O teto do plano é injetado: aceitar()/bandaAbertaParaConvite() resolvem
     * a banda sozinhos, mas cifro_plan_limits() vive em backend/bootstrap.php,
     * que o bootstrap do PHPUnit não carrega. O callable é o ponto de costura.
     */
    private function fluxo(int $limiteUsuarios = -1): BandaConviteFlow
    {
        return new BandaConviteFlow(
            $this->convites,
            new UserRepository(),
            new BandaRepository(),
            static fn (string $plano): int => $limiteUsuarios
        );
    }

    private function perfilNaBanda(string $usuarioId): ?string
    {
        $stmt = $this->pdo->prepare('SELECT perfil FROM usuario_banda WHERE usuario_id=? AND banda_id=?');
        $stmt->execute([$usuarioId, $this->bandaId]);
        return $stmt->fetchColumn() ?: null;
    }

    public function testConvidadoEntraNaBandaComoBasico(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        $resultado = $this->fluxo(-1)->aceitar($token, $this->convidadoId);

        self::assertTrue($resultado['ok']);
        self::assertSame($this->bandaId, $resultado['banda_id']);
        self::assertFalse($resultado['ja_era_membro']);
        self::assertSame('basico', $this->perfilNaBanda($this->convidadoId));
    }

    public function testEntrarPeloLinkContaUmaEntrada(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        $this->fluxo(-1)->aceitar($token, $this->convidadoId);

        self::assertSame(1, (int) $this->convites->buscarPorToken($token)['usos']);
    }

    public function testClicarNoLinkDuasVezesNaoContaDuasEntradas(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);
        $fluxo = $this->fluxo();

        $fluxo->aceitar($token, $this->convidadoId);
        $segundo = $fluxo->aceitar($token, $this->convidadoId);

        self::assertTrue($segundo['ok']);
        self::assertTrue($segundo['ja_era_membro']);
        self::assertSame(1, (int) $this->convites->buscarPorToken($token)['usos']);
    }

    public function testConviteRevogadoNaoDeixaNinguemEntrar(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);
        $this->convites->revogarDaBanda($this->bandaId);

        $resultado = $this->fluxo(-1)->aceitar($token, $this->convidadoId);

        self::assertFalse($resultado['ok']);
        self::assertSame('convite_invalido', $resultado['erro']);
        self::assertNull($this->perfilNaBanda($this->convidadoId));
    }

    public function testTokenInventadoNaoDeixaNinguemEntrar(): void
    {
        $resultado = $this->fluxo(-1)->aceitar(str_repeat('0', 64), $this->convidadoId);

        self::assertFalse($resultado['ok']);
        self::assertSame('convite_invalido', $resultado['erro']);
        self::assertNull($this->perfilNaBanda($this->convidadoId));
    }

    public function testBandaNoTetoDoPlanoRecusaOConvidadoSemVincular(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        // A banda já tem 1 membro (o admin) e o plano permite 1 — é o Gratuito.
        $resultado = $this->fluxo(1)->aceitar($token, $this->convidadoId);

        self::assertFalse($resultado['ok']);
        self::assertSame('plano_limite', $resultado['erro']);
        self::assertNull($this->perfilNaBanda($this->convidadoId));
        self::assertSame(0, (int) $this->convites->buscarPorToken($token)['usos']);
    }

    public function testQuemJaEhMembroPassaMesmoComABandaNoTeto(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        // O próprio administrador clicando no link da própria banda, no Gratuito.
        $resultado = $this->fluxo(1)->aceitar($token, $this->adminId);

        self::assertTrue($resultado['ok']);
        self::assertTrue($resultado['ja_era_membro']);
        self::assertSame('administrador', $this->perfilNaBanda($this->adminId), 'o perfil de quem já é membro não pode ser rebaixado');
    }

    public function testConvitePendenteAtravessaASessao(): void
    {
        self::assertNull(BandaConviteFlow::pendente());

        BandaConviteFlow::guardarNaSessao('tok', 'banda-9', 'Os Fulanos');
        $pendente = BandaConviteFlow::pendente();

        self::assertSame('tok', $pendente['token']);
        self::assertSame('banda-9', $pendente['banda_id']);
        self::assertSame('Os Fulanos', $pendente['banda_nome']);

        BandaConviteFlow::limparSessao();
        self::assertNull(BandaConviteFlow::pendente());
    }

    public function testConviteValidoComBandaFolgadaDevolveABanda(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        $banda = $this->fluxo(-1)->bandaAbertaParaConvite($token);

        self::assertNotNull($banda);
        self::assertSame($this->bandaId, $banda['id']);
    }

    public function testConviteRevogadoNaoAbreABandaParaEntrada(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);
        $this->convites->revogarDaBanda($this->bandaId);

        self::assertNull($this->fluxo(-1)->bandaAbertaParaConvite($token));
    }

    public function testConviteExpiradoNaoAbreABandaParaEntrada(): void
    {
        $tokenExpirado = bin2hex(random_bytes(32));
        $this->pdo->prepare('INSERT INTO banda_convites (token, banda_id, criado_por, expira_em) VALUES (?,?,?,?)')
            ->execute([hash('sha256', $tokenExpirado), $this->bandaId, $this->adminId, date('Y-m-d H:i:s', time() - 3600)]);

        self::assertNull($this->fluxo(-1)->bandaAbertaParaConvite($tokenExpirado));
    }

    public function testBandaNoTetoDoPlanoNaoAbreParaEntrada(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        // A banda já tem 1 membro (o admin) e o limite passado é 1.
        self::assertNull($this->fluxo(1)->bandaAbertaParaConvite($token));
    }

    public function testLimiteIlimitadoNuncaBarraAEntrada(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        $banda = $this->fluxo(-1)->bandaAbertaParaConvite($token);

        self::assertNotNull($banda);
    }

    public function testSessaoComDadosCorruptosNaoRetornaConvitePendente(): void
    {
        // Caso (b): valor armazenado não é um array
        $_SESSION['cifro_convite'] = 'não é um array';
        self::assertNull(BandaConviteFlow::pendente());

        // Caso (c): array existe mas token é vazio
        $_SESSION['cifro_convite'] = [
            'token'      => '',
            'banda_id'   => 'banda-10',
            'banda_nome' => 'Banda Teste',
        ];
        self::assertNull(BandaConviteFlow::pendente());

        // Caso (c) alternativo: token está ausente do array
        $_SESSION['cifro_convite'] = [
            'banda_id'   => 'banda-10',
            'banda_nome' => 'Banda Teste',
        ];
        self::assertNull(BandaConviteFlow::pendente());
    }

    public function testAceiteDevolveABandaResolvidaPeloToken(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);

        $resultado = $this->fluxo()->aceitar($token, $this->convidadoId);

        // Quem chama não precisa buscar a banda de novo — era o preâmbulo
        // duplicado que fazia os três chamadores divergirem.
        self::assertSame($this->bandaId, $resultado['banda']['id']);
        self::assertSame('Banda do Fluxo', $resultado['banda']['nome']);
    }

    public function testTetoDoPlanoEhResolvidoPeloPlanoDaBandaDoConvite(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);
        $planosConsultados = [];

        $fluxo = new BandaConviteFlow(
            $this->convites,
            new UserRepository(),
            new BandaRepository(),
            function (string $plano) use (&$planosConsultados): int {
                $planosConsultados[] = $plano;
                return -1;
            }
        );
        $fluxo->aceitar($token, $this->convidadoId);

        self::assertSame(['mensal'], $planosConsultados, 'o teto sai do plano da banda do token, não de um número passado de fora');
    }

    public function testBandaDesativadaNaoDeixaNinguemEntrar(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);
        $this->pdo->prepare('UPDATE bandas SET ativo = 0 WHERE id = ?')->execute([$this->bandaId]);

        $resultado = $this->fluxo()->aceitar($token, $this->convidadoId);

        self::assertFalse($resultado['ok']);
        self::assertSame('convite_invalido', $resultado['erro']);
        self::assertNull($this->perfilNaBanda($this->convidadoId));
        self::assertSame(0, (int) $this->convites->buscarPorToken($token)['usos']);
    }

    public function testBandaDesativadaNaoAbreParaEntrada(): void
    {
        $token = $this->convites->gerar($this->bandaId, $this->adminId);
        $this->pdo->prepare('UPDATE bandas SET ativo = 0 WHERE id = ?')->execute([$this->bandaId]);

        self::assertNull($this->fluxo()->bandaAbertaParaConvite($token));
    }
}
