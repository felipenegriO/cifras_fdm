<?php
/**
 * AuthTokenRepository — persistência dos tokens "lembrar-me".
 *
 * O validador só existe em claro no cookie do usuário; aqui guardamos
 * apenas o SHA-256, de modo que um vazamento do banco não vira acesso.
 */
class AuthTokenRepository {
    private $pdo;

    public function __construct() {
        $this->pdo = Database::getConnection();
    }

    /** @return array{seletor:string,validador:string} valores em claro, para o cookie */
    public function emitir(string $usuarioId): array {
        $seletor   = bin2hex(random_bytes(16)); // 32 chars
        $validador = bin2hex(random_bytes(32)); // 64 chars
        $stmt = $this->pdo->prepare(
            'INSERT INTO auth_tokens (seletor, validador_hash, usuario_id, expira_em)
             VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
        );
        $stmt->execute([$seletor, hash('sha256', $validador), $usuarioId, AuthTokenService::VALIDADE_SEGUNDOS]);

        // Aproveita a emissão para varrer os vencidos deste usuário: sem isto a
        // tabela só cresce, e cada linha é uma credencial viva.
        $this->limparVencidos($usuarioId);

        return ['seletor' => $seletor, 'validador' => $validador];
    }

    /**
     * @return array{seletor:string,validador_hash:string,validador_anterior_hash:?string,
     *               segundos_desde_rotacao:?int,usuario_id:string}|null
     */
    public function encontrarPorSeletor(string $seletor): ?array {
        $stmt = $this->pdo->prepare(
            'SELECT seletor, validador_hash, validador_anterior_hash, usuario_id,
                    TIMESTAMPDIFF(SECOND, rotacionado_em, NOW()) AS segundos_desde_rotacao
               FROM auth_tokens WHERE seletor = ? AND expira_em > NOW() LIMIT 1'
        );
        $stmt->execute([$seletor]);
        $linha = $stmt->fetch(PDO::FETCH_ASSOC);
        return $linha ?: null;
    }

    /**
     * Gera um validador novo para o mesmo seletor, guardando o anterior.
     *
     * O anterior precisa sobreviver por alguns segundos: o navegador dispara
     * requisições concorrentes com o MESMO cookie, e sem essa janela a segunda
     * pareceria um cookie clonado e derrubaria a sessão do usuário.
     *
     * A troca é condicional no validador que o chamador leu ($validadorAtual):
     * se outra requisição concorrente já rotacionou, nada é alterado e o
     * retorno é null. Sem essa condição, duas requisições rotacionariam em
     * sequência e o navegador ficaria com um validador que já virou "anterior
     * do anterior" — condenado a virar falso positivo de roubo.
     *
     * @return string|null validador novo em claro, ou null se já foi rotacionado
     */
    public function rotacionar(string $seletor, string $validadorAtual): ?string {
        $validador = bin2hex(random_bytes(32));
        $stmt = $this->pdo->prepare(
            'UPDATE auth_tokens
                SET validador_anterior_hash = validador_hash,
                    rotacionado_em = NOW(),
                    validador_hash = ?,
                    usado_em = NOW()
              WHERE seletor = ? AND validador_hash = ?'
        );
        $stmt->execute([hash('sha256', $validador), $seletor, hash('sha256', $validadorAtual)]);
        return $stmt->rowCount() === 1 ? $validador : null;
    }

    public function revogar(string $seletor): void {
        $stmt = $this->pdo->prepare('DELETE FROM auth_tokens WHERE seletor = ?');
        $stmt->execute([$seletor]);
    }

    public function revogarTodosDoUsuario(string $usuarioId): void {
        $stmt = $this->pdo->prepare('DELETE FROM auth_tokens WHERE usuario_id = ?');
        $stmt->execute([$usuarioId]);
    }

    /**
     * Apaga tokens vencidos. Sem usuário, varre a tabela inteira — chamado
     * raramente (1 em 50 emissões), no espírito do garbage collector de sessão
     * do PHP, para não depender de um cron que este projeto não tem.
     */
    public function limparVencidos(?string $usuarioId = null): void {
        if ($usuarioId !== null) {
            $stmt = $this->pdo->prepare('DELETE FROM auth_tokens WHERE usuario_id = ? AND expira_em <= NOW()');
            $stmt->execute([$usuarioId]);
            if (random_int(1, 50) !== 1) return;
        }
        $this->pdo->exec('DELETE FROM auth_tokens WHERE expira_em <= NOW()');
    }
}
