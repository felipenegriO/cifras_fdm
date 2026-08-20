<?php

use PHPUnit\Framework\TestCase;

final class BandaConviteRepositoryTest extends TestCase
{
    private PDO $pdo;
    private string $bandaId;
    private string $adminId;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();

        $sufixo = bin2hex(random_bytes(8));
        $this->bandaId = 'convite-banda-' . $sufixo;
        $this->adminId = 'convite-admin-' . $sufixo;

        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?,?,?)')
            ->execute([$this->bandaId, 'Banda do Convite', 'mensal']);
        $this->pdo->prepare('INSERT INTO usuarios (id, nome, email, perfil, ativo) VALUES (?,?,?,?,?)')
            ->execute([$this->adminId, 'Admin', $sufixo . '@convite.local', 'usuario', 1]);
        $this->pdo->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?,?,?)')
            ->execute([$this->adminId, $this->bandaId, 'administrador']);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) $this->pdo->rollBack();
    }

    public function testOTokenEmClaroNuncaChegaAoBanco(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $token = $repo->gerar($this->bandaId, $this->adminId);

        self::assertSame(64, strlen($token), 'token em claro tem 32 bytes em hexadecimal');

        $stmt = $this->pdo->prepare('SELECT token FROM banda_convites WHERE banda_id = ?');
        $stmt->execute([$this->bandaId]);
        $gravado = $stmt->fetchColumn();

        self::assertNotSame($token, $gravado, 'o banco não pode guardar o token em claro');
        self::assertSame(hash('sha256', $token), $gravado);
    }

    public function testConviteRecemGeradoEhEncontradoPeloTokenEmClaro(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $token = $repo->gerar($this->bandaId, $this->adminId);

        $convite = $repo->buscarPorToken($token);

        self::assertNotNull($convite);
        self::assertSame($this->bandaId, $convite['banda_id']);
        self::assertSame($this->adminId, $convite['criado_por']);
        self::assertSame(0, (int) $convite['usos']);
        self::assertNull($convite['revogado_em']);
    }

    public function testTokenInventadoNaoEncontraNada(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        self::assertNull($repo->buscarPorToken(str_repeat('f', 64)));
    }

    public function testGerarDeNovoNaoMataOLinkJaCompartilhado(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $primeiro = $repo->gerar($this->bandaId, $this->adminId);
        $segundo  = $repo->gerar($this->bandaId, $this->adminId);

        self::assertNotSame($primeiro, $segundo);
        self::assertTrue(BandaConvitePolicy::estaValido($repo->buscarPorToken($primeiro)));
        self::assertTrue(BandaConvitePolicy::estaValido($repo->buscarPorToken($segundo)));
    }

    public function testRevogarDerrubaTodosOsConvitesDaBandaDeUmaVez(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $primeiro = $repo->gerar($this->bandaId, $this->adminId);
        $segundo  = $repo->gerar($this->bandaId, $this->adminId);

        $repo->revogarDaBanda($this->bandaId);

        self::assertFalse(BandaConvitePolicy::estaValido($repo->buscarPorToken($primeiro)));
        self::assertFalse(BandaConvitePolicy::estaValido($repo->buscarPorToken($segundo)));
        self::assertNull($repo->resumoDaBanda($this->bandaId));
    }

    public function testResumoContaOsConvitesVivosESomaAsEntradas(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $primeiro = $repo->gerar($this->bandaId, $this->adminId);
        $segundo  = $repo->gerar($this->bandaId, $this->adminId);

        $repo->registrarUso($primeiro);
        $repo->registrarUso($primeiro);
        $repo->registrarUso($segundo);

        $resumo = $repo->resumoDaBanda($this->bandaId);

        self::assertNotNull($resumo);
        self::assertSame(2, $resumo['ativos']);
        self::assertSame(3, $resumo['usos']);
        self::assertNotSame('', BandaConvitePolicy::rotuloValidade($resumo['expira_em']));
    }

    public function testBandaSemConviteNaoTemResumo(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        self::assertNull($repo->resumoDaBanda($this->bandaId));
    }

    public function testConviteVencidoSaiDoResumo(): void
    {
        $repo = new BandaConviteRepository($this->pdo);
        $token = $repo->gerar($this->bandaId, $this->adminId);

        $this->pdo->prepare('UPDATE banda_convites SET expira_em = ? WHERE token = ?')
            ->execute([date('Y-m-d H:i:s', time() - 60), hash('sha256', $token)]);

        self::assertNull($repo->resumoDaBanda($this->bandaId));
        self::assertFalse(BandaConvitePolicy::estaValido($repo->buscarPorToken($token)));
    }
}
