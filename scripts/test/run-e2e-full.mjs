import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projects = ['cifro', 'serial', 'coverage', 'pwa', 'visual', 'legacy'];
const cli = path.resolve('node_modules/@playwright/test/cli.js');

for (const project of projects) {
  const env = { ...process.env };
  if (env.E2E_AUDIT_DIAGNOSTICS === '1') {
    const auditOutput = path.resolve(`logs/e2e/browser-${project}.jsonl`);
    fs.mkdirSync(path.dirname(auditOutput), { recursive: true });
    fs.rmSync(auditOutput, { force: true });
    env.E2E_AUDIT_OUTPUT = auditOutput;
  }
  const result = spawnSync(process.execPath, [cli, 'test', `--project=${project}`, '--retries=0'], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
