<?php

use PHPUnit\Framework\TestCase;

/**
 * Consultar o estado das migrations tem que funcionar justamente onde ele
 * importa: produção. O guard original exigia --allow-production e
 * MIGRATIONS_ALLOW_PRODUCTION=true também para --status, ou seja, para
 * descobrir se o banco estava atrasado era preciso antes destravar a escrita.
 * Ninguém faz isso por rotina — e foi assim que 8 migrations pendentes
 * passaram despercebidas até derrubarem o sync.
 */
final class MigrateStatusCommandTest extends TestCase
{
    public function testStatusFuncionaEmProducaoSemDestravarEscrita(): void
    {
        $resultado = $this->rodar(['--status'], ['APP_ENV' => 'production']);

        self::assertSame(0, $resultado['exit'], 'stderr: ' . $resultado['stderr']);
        self::assertStringContainsString('20260817_usuario_musica', $resultado['stdout']);
        self::assertMatchesRegularExpression('/^(applied|pending) /m', $resultado['stdout']);
    }

    public function testAplicarEmProducaoContinuaBloqueadoSemAutorizacaoExplicita(): void
    {
        $resultado = $this->rodar([], ['APP_ENV' => 'production']);

        self::assertSame(1, $resultado['exit']);
        self::assertStringContainsString('allow-production', $resultado['stderr']);
    }

    /**
     * @param list<string> $argumentos
     * @param array<string,string> $ambiente
     * @return array{exit:int, stdout:string, stderr:string}
     */
    private function rodar(array $argumentos, array $ambiente): array
    {
        $script = dirname(__DIR__, 2) . '/scripts/setup/migrate.php';
        $comando = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script);
        foreach ($argumentos as $argumento) {
            $comando .= ' ' . escapeshellarg($argumento);
        }

        // putenv em vez de montar o array de ambiente do proc_open: no Windows
        // um ambiente parcial fica sem SystemRoot e o processo filho perde até
        // a resolução de nomes.
        $anteriores = [];
        foreach ($ambiente as $chave => $valor) {
            $anteriores[$chave] = getenv($chave);
            putenv("{$chave}={$valor}");
        }

        try {
            $processo = proc_open($comando, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            self::assertIsResource($processo);
            $stdout = (string) stream_get_contents($pipes[1]);
            $stderr = (string) stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);

            return ['exit' => proc_close($processo), 'stdout' => $stdout, 'stderr' => $stderr];
        } finally {
            foreach ($anteriores as $chave => $valor) {
                $valor === false ? putenv($chave) : putenv("{$chave}={$valor}");
            }
        }
    }
}
