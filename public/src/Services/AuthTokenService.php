<?php
/**
 * AuthTokenService — decide se um cookie "lembrar-me" autentica alguém.
 *
 * Sem HTTP e sem $_SESSION de propósito: toda a decisão fica testável com um
 * AuthTokenRepository mockado. Quem chama (bootstrap.php) é que traduz o
 * resultado em sessão, cookie e revogação.
 */
class AuthTokenService
{
    public const COOKIE_NOME = 'cifro_lembrar';
    public const VALIDADE_SEGUNDOS = 31536000; // 1 ano

    /** Por quanto tempo o validador recém-substituído ainda é aceito. */
    public const JANELA_CONCORRENCIA_SEGUNDOS = 60;

    private AuthTokenRepository $repo;

    public function __construct(AuthTokenRepository $repo)
    {
        $this->repo = $repo;
    }

    /** @return array{seletor:string,validador:string}|null */
    public function parseCookie(string $valor): ?array
    {
        if (substr_count($valor, ':') !== 1) return null;
        [$seletor, $validador] = explode(':', $valor, 2);
        if ($seletor === '' || $validador === '') return null;
        return ['seletor' => $seletor, 'validador' => $validador];
    }

    /**
     * @return array{status:string,usuarioId?:string}
     *   status: 'valido'            → autentica e deve rotacionar
     *           'valido_concorrente'→ autentica, mas NÃO rotaciona (ver abaixo)
     *           'invalido'
     *           'reuso_detectado'   → revogar todos os tokens do usuário
     */
    public function validar(string $valorCookie): array
    {
        $partes = $this->parseCookie($valorCookie);
        if ($partes === null) return ['status' => 'invalido'];

        $linha = $this->repo->encontrarPorSeletor($partes['seletor']);
        if ($linha === null) return ['status' => 'invalido'];

        $usuarioId = (string) $linha['usuario_id'];
        $recebido  = hash('sha256', $partes['validador']);

        if (hash_equals((string) ($linha['validador_hash'] ?? ''), $recebido)) {
            return ['status' => 'valido', 'usuarioId' => $usuarioId];
        }

        // O navegador dispara várias requisições com o MESMO cookie: a primeira
        // rotaciona e as seguintes chegam com o validador que acabou de ser
        // substituído. Aceitar o anterior por uma janela curta evita derrubar a
        // sessão de quem só abriu duas abas. Fora da janela, é roubo de verdade.
        $anterior = $linha['validador_anterior_hash'] ?? null;
        $idade    = $linha['segundos_desde_rotacao'];
        if (
            is_string($anterior) && $anterior !== ''
            && $idade !== null && (int) $idade <= self::JANELA_CONCORRENCIA_SEGUNDOS
            && hash_equals($anterior, $recebido)
        ) {
            return ['status' => 'valido_concorrente', 'usuarioId' => $usuarioId];
        }

        return ['status' => 'reuso_detectado', 'usuarioId' => $usuarioId];
    }
}
