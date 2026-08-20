/**
 * Devolve o banco E2E ao estado do seed antes de cada execução.
 *
 * Por que existe: os testes criam bandas e usuários e quase nunca removem.
 * O teardown atual só apaga os usuários registrados em run.json — banda ele
 * nunca tocou. Medido em 2026-08-18: o admin E2E acumulou 106 vínculos de
 * banda, com nomes de teste repetindo uma vez por execução
 * (`__BANDA_MSG_0__`, `__MB_CRIAR_FLOW__`, `<script>…`, `AAAA…`).
 *
 * O estrago não é a consulta — `estadoDeAcesso()` com 106 bandas custa 0,5 ms.
 * É o `select-banda.php`, que renderiza um card por banda: o próprio
 * global.setup abre essa página cinco vezes (uma por perfil provisionado) e
 * procura um card específico no meio de todos eles.
 *
 * Varre no SETUP e não no teardown de propósito: uma execução interrompida no
 * meio (Ctrl+C, queda) não deixa lixo para a próxima, e o estado logo após uma
 * falha continua disponível para inspeção.
 *
 * Consequência assumida: qualquer banda ou usuário criado à mão neste banco
 * para depurar é apagado na execução seguinte. É um banco exclusivo de teste
 * (o helper db-query recusa rodar se E2E_DB_NAME não estiver configurado
 * separado), então isso é o comportamento desejado.
 */
import { dbQuery } from '../helpers/db.js';

// O que `scripts/setup/setup_e2e_db.php` semeia. Tudo fora disto é resíduo.
const SEED_USER_ID = '00000000-0000-4000-8000-000000000001';
const SEED_BAND_ID = '00000000-0000-4000-8000-000000000002';
const SEED_BAND_PLAN = 'gratuito';
const SEED_SONGS = ['Música E2E 1', 'Música E2E 2'];

export function limparResiduoDeExecucoesAnteriores() {
  // Bandas primeiro: as chaves estrangeiras com ON DELETE CASCADE levam junto
  // vínculos, músicas, categorias, repertórios, roteiros, live_state e convites.
  const bandas = dbQuery('DELETE FROM bandas WHERE id <> ?', [SEED_BAND_ID]);

  // Depois os usuários. Inclui os perfis provisionados pela execução anterior
  // (gestor-*, basico-*, externo-*, paid-admin-*) — o setup recria os desta
  // execução logo em seguida.
  const usuarios = dbQuery('DELETE FROM usuarios WHERE id <> ?', [SEED_USER_ID]);

  // Os testes de plano alteram a banda padrão e nem sempre restauram; a última
  // execução deixou `anual` onde o seed grava `gratuito`. Sem isto, um teste
  // que dependa do limite do plano gratuito passa ou falha conforme o que a
  // execução anterior deixou para trás.
  dbQuery('UPDATE bandas SET plano = ?, ativo = 1 WHERE id = ?', [SEED_BAND_PLAN, SEED_BAND_ID]);

  // Conteúdo largado DENTRO da banda-semente. O cascata acima não alcança isto,
  // porque a banda continua existindo. Medido: 31 músicas onde o seed cria 2,
  // com nomes repetindo uma vez por execução (`Test`, `__PERM_GESTOR__`,
  // `__TESTE_SAVE_SEM_ID_RESPOSTA__`). Sem limpar, um teste que conte músicas
  // ou pegue "a primeira da lista" passa a depender de quantas vezes a suíte
  // rodou nesta máquina.
  const marcadores = SEED_SONGS.map(() => '?').join(',');
  const musicas = dbQuery(
    `DELETE FROM musicas WHERE banda_id = ? AND nome NOT IN (${marcadores})`,
    [SEED_BAND_ID, ...SEED_SONGS]
  );
  // O seed não cria nenhum destes: o que existir é sobra.
  const categorias = dbQuery('DELETE FROM categorias WHERE banda_id = ?', [SEED_BAND_ID]);
  const playlists = dbQuery('DELETE FROM playlists WHERE banda_id = ?', [SEED_BAND_ID]);
  const roteiros = dbQuery('DELETE FROM roteiros WHERE banda_id = ?', [SEED_BAND_ID]);

  // `band_sync_state` e `sync_changes` ficam de fora de propósito: são o
  // livro-razão de revisão do sync, não conteúdo largado. Apagá-los faria a
  // revisão andar para trás, e é justamente o que os testes de sync
  // incremental medem. Cada execução começa com armazenamento do navegador
  // vazio, então uma revisão adiantada não atrapalha.

  const removidos = {
    bandas: bandas.affected || 0,
    usuarios: usuarios.affected || 0,
    musicas: musicas.affected || 0,
    categorias: categorias.affected || 0,
    playlists: playlists.affected || 0,
    roteiros: roteiros.affected || 0,
  };
  const total = Object.values(removidos).reduce((soma, n) => soma + n, 0);
  if (total) {
    console.log('[setup] resíduo removido: ' +
      Object.entries(removidos).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', '));
  }
  return removidos;
}
