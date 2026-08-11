<?php

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../public/src/backend/bootstrap.php';

final class BootstrapHelpersTest extends TestCase
{
    private array $session;
    private array $server;

    protected function setUp(): void
    {
        $this->session = $_SESSION;
        $this->server = $_SERVER;
        $_SESSION = [];
        http_response_code(200);
        $GLOBALS['__cifro_test_terminate'] = true;
        $GLOBALS['__cifro_band_membership_resolver'] = static fn($userId, $bandId, $master) => $master ? '1' : ($_SESSION['banda_atual']['perfil'] ?? false);
    }

    protected function tearDown(): void
    {
        $_SESSION = $this->session;
        $_SERVER = $this->server;
        http_response_code(200);
        $GLOBALS['__cifro_test_terminate'] = false;
        unset($GLOBALS['__cifro_band_membership_resolver']);
    }

    /** Runs $fn, asserting it aborts via cifro_terminate(), and returns the buffered output. */
    private function assertTerminates(callable $fn): string
    {
        ob_start();
        try {
            $fn();
            self::fail('esperava que cifro_terminate() fosse chamado');
        } catch (CifroTestTerminate $e) {
            // expected
        } finally {
            $out = (string) ob_get_clean();
        }
        return $out;
    }

    public function testEscapaValoresEGeraCsrfEstavel(): void
    {
        self::assertSame('&lt;b&gt;&amp;&quot;&#039;', e('<b>&"\''));
        $first = csrf_token();
        self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $first);
        self::assertSame($first, csrf_token());
        ob_start();
        csrf_meta();
        self::assertStringContainsString($first, (string)ob_get_clean());
    }

    public function testPerfisPermissoesEBandaAtual(): void
    {
        self::assertSame('', current_band_id());
        self::assertSame('basico', current_band_role());
        self::assertFalse(is_master());
        self::assertFalse(can_edit_content());
        self::assertFalse(can_manage_band_users());
        self::assertFalse(can_host_live());
        self::assertSame('musico', current_user_profile());
        self::assertFalse(current_user_is_admin());

        $_SESSION['banda_atual'] = ['id' => 'b1', 'perfil' => 'gestor'];
        self::assertSame('b1', current_band_id());
        self::assertTrue(can_host_live());
        self::assertTrue(can_edit_content());
        self::assertFalse(can_manage_band_users());
        self::assertSame('administrador', current_user_profile());

        $_SESSION['banda_atual']['perfil'] = 'administrador';
        self::assertTrue(can_manage_band_users());
        self::assertSame('administrador', current_user_profile());
        self::assertTrue(current_user_is_admin());

        $_SESSION['usuario'] = ['perfil' => 'master'];
        $_SESSION['banda_atual']['perfil'] = 'basico';
        self::assertTrue(is_master());
        self::assertTrue(can_edit_content());
        self::assertTrue(can_manage_band_users());
        self::assertSame('administrador', current_user_profile());
    }

    public function testGerenciamentoDeBandasExigePlanoAtivoOuMaster(): void
    {
        $_SESSION['banda_atual'] = ['perfil' => 'administrador', 'plano' => 'anual', 'ativo' => 1];
        self::assertTrue(has_active_band_plan());
        self::assertTrue(can_manage_bands());

        foreach (['mensal', 'semestral', 'ativo'] as $plano) {
            $_SESSION['banda_atual']['plano'] = $plano;
            self::assertTrue(can_manage_bands());
        }

        $_SESSION['banda_atual']['perfil'] = 'gestor';
        self::assertFalse(can_manage_bands());

        $_SESSION['banda_atual']['perfil'] = 'administrador';
        foreach (['gratuito', 'trial', 'bloqueado'] as $plano) {
            $_SESSION['banda_atual']['plano'] = $plano;
            self::assertFalse(can_manage_bands());
        }

        $_SESSION['banda_atual'] = ['perfil' => 'administrador', 'plano' => 'anual', 'ativo' => 0];
        self::assertFalse(has_active_band_plan());
        self::assertFalse(can_manage_bands());

        $_SESSION['usuario'] = ['perfil' => 'master'];
        self::assertTrue(can_manage_bands());
    }

    public function testNaoAmpliaPermissaoPorPerfilLegado(): void
    {
        $_SESSION['usuario'] = ['perfil' => ' Administrador '];
        self::assertFalse(current_user_is_admin());
        $_SESSION['usuario']['perfil'] = 'usuario';
        self::assertFalse(current_user_is_admin());
    }

    public function testValidadeDaSessao(): void
    {
        self::assertFalse(cifro_session_user_expired());
        $_SESSION['usuario'] = ['id' => 'u1'];
        self::assertFalse(cifro_session_user_expired());
        $_SESSION['usuario']['validade'] = 'data-invalida';
        self::assertTrue(cifro_session_user_expired());
        $timezone = new DateTimeZone('America/Sao_Paulo');
        $_SESSION['usuario']['validade'] = (new DateTimeImmutable('yesterday', $timezone))->format('Y-m-d');
        self::assertTrue(cifro_session_user_expired());
        $_SESSION['usuario']['validade'] = (new DateTimeImmutable('tomorrow', $timezone))->format('Y-m-d');
        self::assertFalse(cifro_session_user_expired());
    }

    public function testAssetsECaminhos(): void
    {
        self::assertSame('', asset_url(''));
        self::assertSame('/arquivo-inexistente.js', asset_url('/arquivo-inexistente.js'));
        $_SESSION['banda_atual'] = ['id' => 'banda-1'];
        self::assertStringContainsString('data/bands/banda-1/dados.json', str_replace('\\', '/', band_data_path('dados.json')));

        $file = tempnam(sys_get_temp_dir(), 'cifro-asset-');
        try {
            self::assertMatchesRegularExpression('/\?v=\d+$/', asset_url($file));
        } finally {
            unlink($file);
        }

    }

    public function testPlanosRotulosELimites(): void
    {
        self::assertSame(10, cifro_plan_limits('gratuito')['musicas']);
        self::assertSame(10, cifro_plan_limits('trial')['musicas']);
        self::assertSame(-1, cifro_plan_limits('mensal')['users']);
        self::assertSame(-1, cifro_plan_limits('semestral')['playlists']);
        self::assertSame(-1, cifro_plan_limits('anual')['users']);
        self::assertSame(-1, cifro_plan_limits('ativo')['bandas']);
        self::assertSame(0, cifro_plan_limits('desconhecido')['musicas']);
        self::assertSame('Gratuito', cifro_plan_label('gratuito'));
        self::assertSame('Gratuito', cifro_plan_label('trial'));
        self::assertSame('Mensal', cifro_plan_label('mensal'));
        self::assertSame('Semestral', cifro_plan_label('semestral'));
        self::assertSame('Anual', cifro_plan_label('anual'));
        self::assertSame('Mensal', cifro_plan_label('ativo'));
        self::assertSame('Bloqueado', cifro_plan_label('bloqueado'));
        self::assertSame('plano desconhecido', cifro_plan_label('plano desconhecido'));
    }

    public function testPlanCheckELimitesQueNaoBloqueiam(): void
    {
        cifro_check_plano();
        $_SESSION['banda_atual'] = ['id' => 'inexistente', 'plano' => 'gratuito'];
        cifro_check_plano();
        cifro_require_plan_limit('musicas', 9);

        $_SESSION['banda_atual']['plano'] = 'mensal';
        cifro_require_plan_limit('musicas', 999);

        $_SESSION['usuario'] = ['perfil' => 'master'];
        $_SESSION['banda_atual']['plano'] = 'bloqueado';
        cifro_require_plan_limit('desconhecido', 999);

        $_SESSION['usuario'] = [];
        $_SESSION['banda_atual']['plano'] = 'trial';
        cifro_check_plano();
        self::assertSame('gratuito', $_SESSION['banda_atual']['plano']);

        $_SESSION['banda_atual']['plano'] = 'bloqueado';
        $_SERVER['PHP_SELF'] = '/plano.php';
        cifro_check_plano();
        $_SERVER['PHP_SELF'] = '/plano-expirado.php';
        cifro_check_plano();
        self::assertSame('bloqueado', $_SESSION['banda_atual']['plano']);
    }

    public function testRateLimitAbreJanelaContaEBloqueia(): void
    {
        $identity = bin2hex(random_bytes(8));
        self::assertFalse(cifro_rate_limit('phpunit', 2, 60, $identity));
        self::assertFalse(cifro_rate_limit('phpunit', 2, 60, $identity));
        $_SESSION = [];
        self::assertTrue(cifro_rate_limit('phpunit', 2, 60, $identity));
        cifro_rate_limit_reset('phpunit', $identity);
        self::assertFalse(cifro_rate_limit('phpunit', 2, 60, $identity));
        cifro_rate_limit_reset('phpunit', $identity);
    }

    // ---- require_auth_json ----

    public function testRequireAuthJsonAbortaQuandoNaoAutenticado(): void
    {
        $out = $this->assertTerminates(fn() => require_auth_json());
        self::assertStringContainsString('Nao autenticado.', $out);
    }

    public function testRequireAuthJsonAbortaQuandoSessaoExpirada(): void
    {
        $timezone = new DateTimeZone('America/Sao_Paulo');
        $_SESSION['autenticado'] = true;
        $_SESSION['usuario'] = ['id' => 'u1', 'validade' => (new DateTimeImmutable('yesterday', $timezone))->format('Y-m-d')];
        $out = $this->assertTerminates(fn() => require_auth_json());
        self::assertStringContainsString('Sessao expirada.', $out);
    }

    public function testRequireAuthJsonPassaQuandoAutenticado(): void
    {
        $_SESSION['autenticado'] = true;
        ob_start();
        require_auth_json();
        $out = ob_get_clean();
        self::assertSame('', $out);
    }

    // ---- require_admin_json ----

    public function testRequireAdminJsonAbortaQuandoNaoAdmin(): void
    {
        $_SESSION['autenticado'] = true;
        $_SESSION['usuario'] = ['id' => 'u1'];
        $_SESSION['banda_atual'] = ['id' => 'b1', 'perfil' => 'basico'];
        $out = $this->assertTerminates(fn() => require_admin_json());
        self::assertStringContainsString('restrito ao administrador', $out);
    }

    public function testRequireAdminJsonPassaQuandoAdmin(): void
    {
        $_SESSION['autenticado'] = true;
        $_SESSION['banda_atual'] = ['perfil' => 'administrador'];
        ob_start();
        require_admin_json();
        $out = ob_get_clean();
        self::assertSame('', $out);
    }

    // ---- require_csrf ----

    public function testRequireCsrfAbortaQuandoTokenAusente(): void
    {
        $out = $this->assertTerminates(fn() => require_csrf());
        self::assertStringContainsString('Token CSRF', $out);
    }

    public function testRequireCsrfAbortaQuandoTokenNaoBate(): void
    {
        $_SESSION['csrf_token'] = 'aaaa';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'bbbb';
        $out = $this->assertTerminates(fn() => require_csrf());
        self::assertStringContainsString('Token CSRF', $out);
    }

    public function testRequireCsrfPassaQuandoTokenBate(): void
    {
        $_SESSION['csrf_token'] = 'segredo';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'segredo';
        ob_start();
        require_csrf();
        $out = ob_get_clean();
        self::assertSame('', $out);
    }

    // ---- require_auth ----

    public function testRequireAuthAbortaQuandoNaoAutenticado(): void
    {
        $out = $this->assertTerminates(fn() => require_auth());
        self::assertSame('', $out);
    }

    public function testRequireAuthAbortaQuandoSessaoExpirada(): void
    {
        $timezone = new DateTimeZone('America/Sao_Paulo');
        $_SESSION['autenticado'] = true;
        $_SESSION['usuario'] = ['id' => 'u1', 'validade' => (new DateTimeImmutable('yesterday', $timezone))->format('Y-m-d')];
        $out = $this->assertTerminates(fn() => require_auth());
        self::assertSame('', $out);
    }

    public function testRequireAuthPassaQuandoValidoChamaCheckPlano(): void
    {
        $_SESSION['autenticado'] = true;
        $_SESSION['banda_atual'] = ['id' => '', 'plano' => 'gratuito'];
        ob_start();
        require_auth();
        $out = ob_get_clean();
        self::assertSame('', $out);
    }

    // ---- cifro_check_plano: bloqueado em página não permitida ----

    public function testCheckPlanoAbortaQuandoBloqueadoForaDasPaginasPermitidas(): void
    {
        $_SESSION['banda_atual'] = ['id' => 'b1', 'plano' => 'bloqueado'];
        $_SERVER['PHP_SELF'] = '/index.php';
        $out = $this->assertTerminates(fn() => cifro_check_plano());
        self::assertSame('', $out);
    }

    // ---- require_band_role ----

    public function testRequireBandRoleAbortaQuandoPermissaoInsuficiente(): void
    {
        $_SESSION['autenticado'] = true;
        $_SESSION['usuario'] = ['id' => 'u1'];
        $_SESSION['banda_atual'] = ['id' => 'b1', 'perfil' => 'basico'];
        $out = $this->assertTerminates(fn() => require_band_role('administrador'));
        self::assertStringContainsString('Permiss', $out);
    }

    public function testRequireBandRolePassaQuandoPermissaoSuficiente(): void
    {
        $_SESSION['autenticado'] = true;
        $_SESSION['usuario'] = ['id' => 'u1'];
        $_SESSION['banda_atual'] = ['id' => 'b1', 'perfil' => 'gestor'];
        ob_start();
        require_band_role('gestor');
        $out = ob_get_clean();
        self::assertSame('', $out);
    }

    public function testRequireBandRolePassaParaMasterIndependenteDoPerfilNaBanda(): void
    {
        $_SESSION['autenticado'] = true;
        $_SESSION['usuario'] = ['perfil' => 'master'];
        $_SESSION['banda_atual'] = ['id' => 'b1', 'perfil' => 'basico'];
        ob_start();
        require_band_role('administrador');
        $out = ob_get_clean();
        self::assertSame('', $out);
    }

    public function testRequireBandRoleRetorna404QuandoBandaNaoPertenceAoUsuario(): void
    {
        $_SESSION['autenticado'] = true;
        $_SESSION['usuario'] = ['id' => 'u1'];
        $_SESSION['banda_atual'] = ['id' => 'b-outra', 'perfil' => 'administrador'];
        $GLOBALS['__cifro_band_membership_resolver'] = static fn() => false;
        $out = $this->assertTerminates(fn() => require_band_role('basico'));
        self::assertSame(404, http_response_code());
        self::assertStringContainsString('Banda n', $out);
    }

    public function testRequireBandRoleAtualizaPapelComValorDoBanco(): void
    {
        $_SESSION['autenticado'] = true;
        $_SESSION['usuario'] = ['id' => 'u1'];
        $_SESSION['banda_atual'] = ['id' => 'b1', 'perfil' => 'administrador'];
        $GLOBALS['__cifro_band_membership_resolver'] = static fn() => 'basico';
        $out = $this->assertTerminates(fn() => require_band_role('gestor'));
        self::assertSame('basico', $_SESSION['banda_atual']['perfil']);
        self::assertStringContainsString('Permiss', $out);
    }

    // ---- require_admin ----

    public function testRequireAdminAbortaQuandoNaoAdmin(): void
    {
        $_SESSION['autenticado'] = true;
        $_SESSION['banda_atual'] = ['id' => '', 'plano' => 'gratuito', 'perfil' => 'basico'];
        $out = $this->assertTerminates(fn() => require_admin());
        self::assertStringContainsString('Acesso restrito ao administrador.', $out);
    }

    public function testRequireAdminPassaQuandoAdmin(): void
    {
        $_SESSION['autenticado'] = true;
        $_SESSION['banda_atual'] = ['id' => '', 'plano' => 'gratuito', 'perfil' => 'administrador'];
        ob_start();
        require_admin();
        $out = ob_get_clean();
        self::assertSame('', $out);
    }

    // ---- render_view / render_partial ----

    public function testRenderViewAbortaQuandoNaoExiste(): void
    {
        $out = $this->assertTerminates(fn() => render_view('nao-existe-xyz'));
        self::assertStringContainsString('View not found.', $out);
    }

    public function testRenderPartialAbortaQuandoNaoExiste(): void
    {
        $out = $this->assertTerminates(fn() => render_partial('nao-existe-xyz'));
        self::assertStringContainsString('Partial not found.', $out);
    }

    public function testRenderViewRendersExisting(): void
    {
        ob_start();
        render_view('login');
        $out = ob_get_clean();
        self::assertNotSame('', $out);
    }

    // ---- cifro_require_plan_limit: bloqueio ----

    public function testRequirePlanLimitAbortaQuandoLimiteAtingido(): void
    {
        $_SESSION['banda_atual'] = ['plano' => 'gratuito'];
        $out = $this->assertTerminates(fn() => cifro_require_plan_limit('musicas', 10));
        self::assertStringContainsString('Limite do plano Gratuito atingido', $out);
    }

    // ---- send_no_cache_headers ----

    public function testSendNoCacheHeadersNaoQuebraQuandoHeadersJaEnviados(): void
    {
        // headers_sent() varies by execution mode (plain CLI vs. the
        // coverage runner's auto_prepend_file), so don't assume its value —
        // just verify the call is safe either way; the real header() calls
        // are covered by Playwright's real HTTP runs.
        send_no_cache_headers();
        self::assertTrue(true);
    }

    public function testRequirePlanLimitPassaParaMaster(): void
    {
        $_SESSION['usuario'] = ['perfil' => 'master'];
        $_SESSION['banda_atual'] = ['plano' => 'bloqueado'];
        ob_start();
        cifro_require_plan_limit('musicas', 99999);
        $out = ob_get_clean();
        self::assertSame('', $out);
    }
}
