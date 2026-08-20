/**
 * Roda um trecho de teste com a banda atual num plano específico e devolve o
 * plano anterior no fim, aconteça o que acontecer.
 *
 * Existe porque vários testes dependem do plano da banda — o Modo Ao Vivo só
 * aparece em plano pago, o convite por link só é gerado em plano pago, o link
 * de upgrade na topnav só aparece no gratuito — e antes cada um confiava no
 * que a execução anterior tinha deixado no banco. Em 2026-08-18 a Banda E2E
 * estava em `anual` porque algum teste promoveu e não restaurou, e havia teste
 * passando por tabela: com plano pago ele caía num ramo `toHaveCount(0)` que
 * passa trivialmente mesmo com o seletor errado.
 *
 * Não basta alterar a coluna: `$_SESSION['banda_atual']['plano']` é uma foto
 * tirada na seleção da banda. Por isso o plano é reescolhido pelo endpoint
 * `selecionar.php`, que reconstrói essa parte da sessão.
 */
import { expect } from '@playwright/test';
import { dbQuery } from './db.js';

async function getCsrf(page) {
  const res = await page.request.get('/api/csrf.php');
  return (await res.json()).csrf_token || '';
}

async function reselecionarBanda(page, bandaId) {
  const csrf = await getCsrf(page);
  const res = await page.request.post('/src/backend/bandas/selecionar.php', {
    data: JSON.stringify({ bandaId }),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  });
  return res;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {'gratuito'|'trial'|'mensal'|'semestral'|'anual'|'bloqueado'} plano
 * @param {(bandaId: string) => Promise<void>} run
 */
export async function comPlanoDaBandaAtual(page, plano, run) {
  const current = await (await page.request.get('/api/sync/version.php')).json();
  const bandaId = current.banda_id;
  const anterior = dbQuery('SELECT plano FROM bandas WHERE id=?', [bandaId]).rows[0]?.plano ?? 'gratuito';

  dbQuery('UPDATE bandas SET plano=? WHERE id=?', [plano, bandaId]);
  expect((await (await reselecionarBanda(page, bandaId)).json()).sucesso).toBe(true);

  try {
    await run(bandaId);
  } finally {
    dbQuery('UPDATE bandas SET plano=? WHERE id=?', [anterior, bandaId]);
    await reselecionarBanda(page, bandaId);
  }
}
