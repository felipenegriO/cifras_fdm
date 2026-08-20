/**
 * 68-auth-token-repository.spec.js
 * Exercita o AuthTokenRepository contra o banco E2E real, via PHP CLI.
 */
import { test, expect } from '../fixtures/coverage.js';
import { dbQuery } from '../helpers/db.js';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

/** Roda um trecho PHP com o autoload do app e devolve o que ele imprimir em JSON. */
function runPhp(codigo) {
  const script = `
    require 'public/src/backend/bootstrap.php';
    ${codigo}
  `;
  const saida = execFileSync('C:/xampp/php/php.exe', ['-r', script], {
    encoding: 'utf8',
    env: { ...process.env, APP_ENV: 'test' },
  });
  const ultimaLinha = saida.trim().split('\n').pop();
  return JSON.parse(ultimaLinha);
}

let userId;

test.beforeEach(() => {
  userId = crypto.randomUUID();
  dbQuery(
    `INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo, plano)
     VALUES (?, 'Token E2E', ?, 'x', 'usuario', 1, 'ativo')`,
    [userId, `token-${Date.now()}-${crypto.randomBytes(3).toString('hex')}@e2e.local`],
  );
});

test.afterEach(() => {
  dbQuery('DELETE FROM auth_tokens WHERE usuario_id = ?', [userId]);
  dbQuery('DELETE FROM usuarios WHERE id = ?', [userId]);
});

test('emitir cria um token que é encontrado pelo seletor', () => {
  const par = runPhp(`
    $r = new AuthTokenRepository();
    echo json_encode($r->emitir(${JSON.stringify(userId)}));
  `);
  expect(par.seletor).toHaveLength(32);
  expect(par.validador).toHaveLength(64);

  const { rows } = dbQuery('SELECT usuario_id, validador_hash FROM auth_tokens WHERE seletor = ?', [par.seletor]);
  expect(rows).toHaveLength(1);
  expect(rows[0].usuario_id).toBe(userId);
  // o validador em claro nunca é gravado
  expect(rows[0].validador_hash).not.toBe(par.validador);
});

test('rotacionar troca o validador e invalida o anterior', () => {
  const resultado = runPhp(`
    $r = new AuthTokenRepository();
    $par = $r->emitir(${JSON.stringify(userId)});
    $novo = $r->rotacionar($par['seletor'], $par['validador']);
    echo json_encode(['seletor' => $par['seletor'], 'antigo' => $par['validador'], 'novo' => $novo]);
  `);
  expect(resultado.novo).not.toBe(resultado.antigo);

  const { rows } = dbQuery('SELECT validador_hash, usado_em FROM auth_tokens WHERE seletor = ?', [resultado.seletor]);
  expect(rows[0].validador_hash).toBe(
    crypto.createHash('sha256').update(resultado.novo).digest('hex'),
  );
  expect(rows[0].usado_em).not.toBeNull();
});

test('sair de todos os aparelhos remove todos os tokens do usuário', () => {
  runPhp(`
    $r = new AuthTokenRepository();
    $r->emitir(${JSON.stringify(userId)});
    $r->emitir(${JSON.stringify(userId)});
    $r->revogarTodosDoUsuario(${JSON.stringify(userId)});
    echo json_encode(true);
  `);
  const { rows } = dbQuery('SELECT seletor FROM auth_tokens WHERE usuario_id = ?', [userId]);
  expect(rows).toHaveLength(0);
});

test('excluir a conta leva os tokens junto', () => {
  const par = runPhp(`
    $r = new AuthTokenRepository();
    echo json_encode($r->emitir(${JSON.stringify(userId)}));
  `);
  dbQuery('DELETE FROM usuarios WHERE id = ?', [userId]);
  const { rows } = dbQuery('SELECT seletor FROM auth_tokens WHERE seletor = ?', [par.seletor]);
  expect(rows).toHaveLength(0);
});

test('rotacionar não faz nada se outra requisição já trocou o validador', () => {
  // Duas requisições concorrentes leem o mesmo validador; só a primeira troca.
  const r = runPhp(`
    $r = new AuthTokenRepository();
    $par = $r->emitir(${JSON.stringify(userId)});
    $primeira = $r->rotacionar($par['seletor'], $par['validador']);
    $segunda  = $r->rotacionar($par['seletor'], $par['validador']);
    echo json_encode(['primeira' => $primeira !== null, 'segunda' => $segunda]);
  `);
  expect(r.primeira).toBe(true);
  expect(r.segunda).toBeNull();
});

test('token vencido não é encontrado e é varrido na próxima emissão', () => {
  const r = runPhp(`
    $r = new AuthTokenRepository();
    $par = $r->emitir(${JSON.stringify(userId)});
    // Força o vencimento sem esperar um ano.
    Database::getConnection()
      ->prepare('UPDATE auth_tokens SET expira_em = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE seletor = ?')
      ->execute([$par['seletor']]);
    $achado = $r->encontrarPorSeletor($par['seletor']);
    $r->limparVencidos(${JSON.stringify(userId)});
    echo json_encode(['seletor' => $par['seletor'], 'achado' => $achado]);
  `);
  expect(r.achado).toBeNull();
  const { rows } = dbQuery('SELECT seletor FROM auth_tokens WHERE seletor = ?', [r.seletor]);
  expect(rows).toHaveLength(0);
});
