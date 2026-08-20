<?php

use PHPUnit\Framework\TestCase;

/**
 * O rewrite de APP_BASE (bootstrap.php) prefixa caminhos absolutos quando o app
 * roda em subpasta, como em cifro.online/beta/public.
 *
 * Estes testes existem porque a falha desse rewrite é silenciosa e cruel: a
 * página carrega, o app parece funcionar, e só UMA chamada quebra com 404. Foi
 * o que aconteceu em produção — `cifroFetch('/…')` escapava porque a regex
 * exigia "fetch" minúsculo exato, e selecionar banda dava 404.
 */
final class AppBaseRewriteTest extends TestCase
{
    private const BASE = '/beta/public';

    /** Reproduz as três substituições do bootstrap, na mesma ordem. */
    private function rewrite(string $buffer): string
    {
        $base   = self::BASE;
        $noBase = preg_quote(ltrim($base, '/'), '/');
        $buffer = preg_replace('/((?:href|src|action)=")\/(?!\/)(?!' . $noBase . ')/', '$1' . $base . '/', $buffer);
        $buffer = preg_replace("/((?:window\.)?location(?:\.href)?\s*=\s*['\"])\/(?!\/)(?!{$noBase})/", '$1' . $base . '/', $buffer);
        $buffer = preg_replace("/(\w*fetch\(['\"])\/(?!\/)(?!{$noBase})/i", '$1' . $base . '/', $buffer);
        return $buffer;
    }

    public function testPrefixaFetchSimples(): void
    {
        self::assertStringContainsString(
            "fetch('/beta/public/api/csrf.php'",
            $this->rewrite("await fetch('/api/csrf.php', {})")
        );
    }

    public function testPrefixaWrappersComoCifroFetch(): void
    {
        // O caso que quebrou em produção: selecionar banda dava 404.
        self::assertStringContainsString(
            "cifroFetch('/beta/public/src/backend/bandas/selecionar.php'",
            $this->rewrite("await cifroFetch('/src/backend/bandas/selecionar.php', { bandaId: id })")
        );
    }

    public function testPrefixaAtributosHrefESrc(): void
    {
        $out = $this->rewrite('<a href="/index.php"><img src="/src/images/logo.svg"></a>');
        self::assertStringContainsString('href="/beta/public/index.php"', $out);
        self::assertStringContainsString('src="/beta/public/src/images/logo.svg"', $out);
    }

    public function testPrefixaRedirecionamentoPorLocation(): void
    {
        self::assertStringContainsString(
            "location.href = '/beta/public/login.php'",
            $this->rewrite("window.location.href = '/login.php'")
        );
    }

    public function testNaoPrefixaDuasVezes(): void
    {
        $umaVez = $this->rewrite("fetch('/api/csrf.php')");
        self::assertSame($umaVez, $this->rewrite($umaVez));
    }

    public function testNaoTocaEmUrlAbsolutaDeOutroDominio(): void
    {
        $entrada = "fetch('https://api.stripe.com/v1/x')";
        self::assertSame($entrada, $this->rewrite($entrada));
    }

    public function testNaoTocaEmCaminhoRelativo(): void
    {
        $entrada = "fetch('api/csrf.php')";
        self::assertSame($entrada, $this->rewrite($entrada));
    }

    /**
     * Guarda de regressão sobre o código real: nenhuma view pode chamar o
     * backend por um caminho absoluto que o rewrite deixe passar.
     */
    public function testNenhumaViewEscapaDoRewrite(): void
    {
        $raiz = __DIR__ . '/../../public';
        $arquivos = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($raiz));
        $escaparam = [];

        foreach ($arquivos as $arquivo) {
            if (!$arquivo->isFile() || $arquivo->getExtension() !== 'php') continue;
            $caminho = str_replace('\\', '/', $arquivo->getPathname());
            if (str_contains($caminho, '/vendor/')) continue;

            $depois = $this->rewrite((string) file_get_contents($caminho));
            foreach (explode("\n", $depois) as $numero => $linha) {
                // chamada JS a /src/ ou /api/ que continuou sem o prefixo
                if (!preg_match('/[A-Za-z_]*fetch\(\s*[\'"]\/(?:src|api)\//i', $linha)) continue;
                if (str_contains($linha, self::BASE)) continue;
                $escaparam[] = basename($caminho) . ':' . ($numero + 1);
            }
        }

        self::assertSame([], $escaparam, 'Chamadas que ficariam sem o prefixo em deploy de subpasta');
    }

    /**
     * Guarda de regressão: URL que sai do app e volta por FORA (o Stripe
     * redireciona o navegador de volta; o e-mail leva o usuário de volta) não
     * passa pelo rewrite de HTML. Ela precisa carregar o app_base() na
     * construção, senão o músico paga e cai num 404 — foi o que aconteceu.
     */
    public function testUrlDeRetornoExternoSempreCarregaOAppBase(): void
    {
        $raiz = __DIR__ . '/../../public';
        $arquivos = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($raiz));
        $semAppBase = [];

        foreach ($arquivos as $arquivo) {
            if (!$arquivo->isFile() || $arquivo->getExtension() !== 'php') continue;
            $caminho = str_replace('\\', '/', $arquivo->getPathname());
            if (str_contains($caminho, '/vendor/')) continue;

            foreach (explode("\n", (string) file_get_contents($caminho)) as $numero => $linha) {
                if (!str_contains($linha, "env('APP_URL'")) continue;
                if (str_contains($linha, 'app_base()')) continue;
                $semAppBase[] = basename($caminho) . ':' . ($numero + 1);
            }
        }

        self::assertSame([], $semAppBase, 'APP_URL usado sem app_base(): quebra em deploy de subpasta');
    }
}
