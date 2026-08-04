import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dbQuery } from '../helpers/db.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const runFile = path.join(directory, '../.auth/run.json');

export default async function globalTeardown() {
  let run;
  try {
    run = JSON.parse(await fs.readFile(runFile, 'utf8'));
  } catch {
    return;
  }

  for (const email of run.emails || []) {
    if (!/^[a-z]+-[a-zA-Z0-9-]+@e2e\.local$/.test(email)) continue;
    const result = dbQuery('SELECT id FROM usuarios WHERE email=?', [email]);
    for (const user of result.rows || []) {
      dbQuery('DELETE FROM password_reset_tokens WHERE usuario_id=?', [user.id]);
      dbQuery('DELETE FROM usuario_banda WHERE usuario_id=?', [user.id]);
      dbQuery('DELETE FROM usuarios WHERE id=?', [user.id]);
    }
  }

  await fs.rm(runFile, { force: true });
}
