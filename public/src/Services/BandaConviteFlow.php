<?php
/**
 * Aceite de um convite de banda.
 *
 * Concentra a regra de quem entra por um LINK de convite: register por e-mail,
 * login de quem já tem conta e aceite direto na página do convite passam todos
 * por aqui. A resolução da banda, o teto do plano e a contagem de uso ficam
 * neste arquivo — passá-los de fora já fez os três chamadores divergirem.
 *
 * Não é o único lugar que cria vínculo em usuario_banda: o cadastro por Google
 * (GoogleAuthService::createUserAndBanda) monta o usuário e o vínculo na mesma
 * transação e conta o uso do convite ali, porque o usuário só existe depois
 * daquele passo. Aquele caminho valida o convite ANTES, via
 * bandaAbertaParaConvite() deste serviço.
 */
class BandaConviteFlow
{
    private const CHAVE_SESSAO = 'cifro_convite';

    private BandaConviteRepository $convites;
    private UserRepository $usuarios;
    private BandaRepository $bandas;

    /** @var callable(string):int devolve o teto de usuários do plano; -1 é ilimitado. */
    private $limiteDeUsuarios;

    /**
     * @param (callable(string):int)|null $limiteDeUsuarios injetável porque
     *        cifro_plan_limits() mora em backend/bootstrap.php, que o bootstrap
     *        do PHPUnit não carrega. Sem o app carregado, o default nega
     *        (teto 0) em vez de liberar entrada com teto desconhecido.
     */
    public function __construct(
        ?BandaConviteRepository $convites = null,
        ?UserRepository $usuarios = null,
        ?BandaRepository $bandas = null,
        ?callable $limiteDeUsuarios = null
    ) {
        $this->convites = $convites ?? new BandaConviteRepository();
        $this->usuarios = $usuarios ?? new UserRepository();
        $this->bandas = $bandas ?? new BandaRepository();
        $this->limiteDeUsuarios = $limiteDeUsuarios ?? static function (string $plano): int {
            if (!function_exists('cifro_plan_limits')) {
                return 0;
            }
            return (int) (cifro_plan_limits($plano)['users'] ?? 0);
        };
    }

    /**
     * @return array{ok: bool, banda_id?: string, banda?: array, ja_era_membro?: bool, erro?: string}
     */
    public function aceitar(string $token, string $usuarioId): array
    {
        $convite = $this->convites->buscarPorToken($token);
        if (!BandaConvitePolicy::estaValido($convite)) {
            return ['ok' => false, 'erro' => 'convite_invalido'];
        }

        $bandaId = (string) $convite['banda_id'];

        // Banda apagada ou desativada não recebe ninguém — mesma recusa de um
        // convite morto, e pelo mesmo motivo: o link não pode virar vínculo.
        $banda = $this->bandas->findById($bandaId);
        if (!$banda || !($banda['ativo'] ?? 0)) {
            return ['ok' => false, 'erro' => 'convite_invalido'];
        }

        // Quem já é membro passa direto: clicar no link de novo não pode
        // rebaixar um administrador a básico nem contar uma segunda entrada.
        if ($this->usuarios->belongsToBanda($usuarioId, $bandaId)) {
            return ['ok' => true, 'banda_id' => $bandaId, 'banda' => $banda, 'ja_era_membro' => true];
        }

        $limite = ($this->limiteDeUsuarios)((string) ($banda['plano'] ?? ''));
        if ($limite !== -1 && $this->usuarios->countByBanda($bandaId) >= $limite) {
            return ['ok' => false, 'erro' => 'plano_limite', 'banda' => $banda];
        }

        $this->usuarios->importToBanda($usuarioId, $bandaId, BandaConvitePolicy::PERFIL);
        $this->convites->registrarUso($token);

        return ['ok' => true, 'banda_id' => $bandaId, 'banda' => $banda, 'ja_era_membro' => false];
    }

    /**
     * O convite pendente ainda permite uma entrada nesta banda? Chamado ANTES
     * de criar o usuário no fluxo do Google — o vínculo só pode existir depois
     * que isto disser sim, senão convite revogado/expirado/no teto não barra
     * mais ninguém (é exatamente o defeito que este método fecha).
     *
     * @return array|null a linha da banda quando o convite ainda vale, null quando não.
     */
    public function bandaAbertaParaConvite(string $token): ?array
    {
        $convite = $this->convites->buscarPorToken($token);
        if (!BandaConvitePolicy::estaValido($convite)) {
            return null;
        }

        $banda = $this->bandas->findById((string) $convite['banda_id']);
        if (!$banda || !($banda['ativo'] ?? 0)) {
            return null;
        }

        $limite = ($this->limiteDeUsuarios)((string) ($banda['plano'] ?? ''));
        if ($limite !== -1 && $this->usuarios->countByBanda((string) $banda['id']) >= $limite) {
            return null;
        }

        return $banda;
    }

    /**
     * O convite fica na sessão para atravessar o cadastro — inclusive o
     * roundtrip do Google, do mesmo jeito que google_legal_acceptance faz.
     */
    public static function guardarNaSessao(string $token, string $bandaId, string $bandaNome): void
    {
        $_SESSION[self::CHAVE_SESSAO] = [
            'token'      => $token,
            'banda_id'   => $bandaId,
            'banda_nome' => $bandaNome,
        ];
    }

    /** @return array{token: string, banda_id: string, banda_nome: string}|null */
    public static function pendente(): ?array
    {
        $pendente = $_SESSION[self::CHAVE_SESSAO] ?? null;
        if (!is_array($pendente) || empty($pendente['token'])) return null;
        return $pendente;
    }

    public static function limparSessao(): void
    {
        unset($_SESSION[self::CHAVE_SESSAO]);
    }
}
