/**
 * Acesso ao MySQL a partir dos testes E2E, via PHP CLI (mesma engine do app).
 * Evita dependência de um driver MySQL em Node.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PHP_BIN = process.env.PHP_BIN || 'C:/xampp/php/php.exe';
const BRIDGE = path.join(__dirname, 'db-query.php');

/**
 * Executa SQL com placeholders `?` e retorna { rows, affected }.
 * @param {string} sql
 * @param {Array<string|number|null>} params
 */
export function dbQuery(sql, params = []) {
  const res = spawnSync(PHP_BIN, [BRIDGE], {
    input: JSON.stringify({ sql, params }),
    encoding: 'utf-8',
    timeout: 15000,
  });
  if (res.status !== 0) {
    throw new Error(`dbQuery falhou: ${res.stderr || res.error}`);
  }
  return JSON.parse(res.stdout);
}
