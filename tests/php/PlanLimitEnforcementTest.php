<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/backend/bootstrap.php';

/**
 * Cobre, de ponta a ponta (banco real + sessão real, sem mocks de
 * membership), o mesmo par de checagens que public/src/backend/editor/api.php
 * executa antes de salvar uma música nova:
 *   1) require_band_role('gestor')      — quem pode tentar
 *   2) cifro_require_plan_limit('musicas', ...) — quantas o plano permite
 *
 * Cenários pedidos: master sempre pode; administrador de banda (não master)
 * pode tentar mas é barrado pelo limite do plano gratuito; básico é barrado
 * antes mesmo de chegar no limite (sem permissão pra tentar).
 */
final class PlanLimitEnforcementTest extends TestCase
{
    private PDO $pdo;
    private string $bandaId;
    private string $userId;
    private array $session;

    protected function setUp(): void
    {
        $this->pdo = Database::getConnection();
        $this->pdo->beginTransaction();
        $suffix = bin2hex(random_bytes(8));
        $this->bandaId = 'phpunit-planlimit-' . $suffix;
        $this->userId = 'phpunit-user-' . $suffix;
        $this->pdo->prepare('INSERT INTO bandas (id, nome, plano) VALUES (?, ?, ?)')
            ->execute([$this->bandaId, 'Banda Plano Gratuito', 'gratuito']);
        $this->pdo->prepare('INSERT INTO usuarios (id, nome, email, perfil, ativo, plano) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$this->userId, 'Usuário PHPUnit', "$suffix@phpunit.local", 'usuario', 1, 'ativo']);

        $this->session = $_SESSION;
        $_SESSION = [
            'autenticado' => true,
            'usuario' => ['id' => $this->userId, 'perfil' => 'usuario'],
        ];
        http_response_code(200);
        $GLOBALS['__cifro_test_terminate'] = true;
        // Sem resolver mockado: require_current_band_json cai na consulta real
        // ao banco (usuario_banda), igual ao que acontece em produção.
        unset($GLOBALS['__cifro_band_membership_resolver']);
    }

    protected function tearDown(): void
    {
        if ($this->pdo->inTransaction()) {
            $this->pdo->rollBack();
        }
        $_SESSION = $this->session;
        http_response_code(200);
        $GLOBALS['__cifro_test_terminate'] = false;
    }

    private function assertTerminates(callable $fn): string
    {
        ob_start();
        try {
            $fn();
            self::fail('esperava que cifro_terminate() fosse chamado');
        } catch (CifroTestTerminate $e) {
            // esperado
        } finally {
            $out = (string) ob_get_clean();
        }
        return $out;
    }

    private function vincularUsuario(string $perfilNaBanda): void
    {
        $this->pdo->prepare('INSERT INTO usuario_banda (usuario_id, banda_id, perfil) VALUES (?, ?, ?)')
            ->execute([$this->userId, $this->bandaId, $perfilNaBanda]);
        $_SESSION['banda_atual'] = ['id' => $this->bandaId, 'perfil' => $perfilNaBanda, 'plano' => 'gratuito'];
    }

    private function popularDezMusicas(): void
    {
        $repo = new MusicaRepository();
        for ($i = 1; $i <= 10; $i++) {
            $repo->save(['nome' => "Música $i", 'cifra' => '<b>C</b>'], $this->bandaId);
        }
        self::assertSame(10, $repo->countByBanda($this->bandaId));
    }

    public function testAdministradorDeBandaNaoMasterPodeTentarMasEBarradoPeloLimiteDoPlanoGratuito(): void
    {
        $this->vincularUsuario('administrador');
        $this->popularDezMusicas();

        // Passo 1 do api.php: verifica se pode tentar (papel na banda).
        ob_start();
        require_band_role('gestor');
        $roleOutput = ob_get_clean();
        self::assertSame('', $roleOutput, 'administrador deveria conseguir passar pela checagem de papel');

        // Passo 2 do api.php: verifica o limite do plano antes de criar a 11ª música.
        $repo = new MusicaRepository();
        $out = $this->assertTerminates(fn() => cifro_require_plan_limit('musicas', $repo->countByBanda($this->bandaId)));
        self::assertStringContainsString('Limite do plano Gratuito atingido', $out);
        self::assertSame(10, $repo->countByBanda($this->bandaId), 'nenhuma música a mais deveria ter sido criada');
    }

    public function testBasicoNaoConsegueNemTentarSalvarMusica(): void
    {
        $this->vincularUsuario('basico');
        $this->popularDezMusicas();

        $out = $this->assertTerminates(fn() => require_band_role('gestor'));
        self::assertStringContainsString('Permiss', $out);
    }

    public function testMasterIgnoraLimiteDoPlanoGratuitoMesmoComoAdministradorDaBanda(): void
    {
        $this->pdo->prepare('UPDATE usuarios SET perfil = "master" WHERE id = ?')->execute([$this->userId]);
        $_SESSION['usuario']['perfil'] = 'master';
        $this->vincularUsuario('administrador');
        $this->popularDezMusicas();

        ob_start();
        require_band_role('gestor');
        $roleOutput = ob_get_clean();
        self::assertSame('', $roleOutput);

        $repo = new MusicaRepository();
        ob_start();
        cifro_require_plan_limit('musicas', $repo->countByBanda($this->bandaId));
        $limitOutput = ob_get_clean();
        self::assertSame('', $limitOutput, 'master não deveria ser bloqueado pelo limite do plano');
    }
}
