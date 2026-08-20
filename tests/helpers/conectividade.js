import { expect } from '@playwright/test';

/**
 * Espera o app concluir a primeira sondagem de /health.php.
 *
 * Por que isto existe: `cifroSync.sync()` devolve `false` de imediato, em
 * silêncio, enquanto `CifroConnectivity` ainda não confirmou o servidor —
 * comportamento correto do produto (não adianta sincronizar sem saber se há
 * servidor). Só que `page.goto()` resolve no evento `load`, e a sondagem é
 * disparada depois disso, num `requestAnimationFrame` + `setTimeout`. Chamar
 * `sync()` na linha seguinte ao `goto` é uma corrida: passa com o servidor
 * ocioso e falha quando ele está lento — que é justamente o fim de uma suíte
 * longa, com o servidor embutido do PHP atendendo em uma thread só.
 *
 * O sintoma é enganoso: `sync()` volta `false` sem erro, sem requisição e sem
 * nada no console, então parece defeito de sincronização.
 */
export async function aguardarServidorDisponivel(page, timeout = 15000) {
  await expect
    .poll(() => page.evaluate(() => window.CifroConnectivity?.isServerAvailable() === true), { timeout })
    .toBe(true);
}
