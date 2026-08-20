import assert from 'node:assert/strict';
import test from 'node:test';
import '../public/src/js/cifro-share.js';
import '../public/src/js/banda-convite-share.js';

const share = globalThis.CifroShare;
const convite = globalThis.CifroConviteShare;

// No Node 22+, `navigator` é um global somente-leitura, mas configurável.
// Usar defineProperty evita o TypeError de atribuição direta.
function setNavigator(fake) {
  Object.defineProperty(globalThis, 'navigator', { value: fake, configurable: true, writable: true });
}

test('o texto do convite traz a banda, o link e o prazo', () => {
  const texto = convite.formatar({ bandaNome: 'Os Fulanos', link: 'https://cifro.com.br/convite.php?t=abc' });

  assert.match(texto, /Os Fulanos/);
  assert.match(texto, /https:\/\/cifro\.com\.br\/convite\.php\?t=abc/);
  assert.match(texto, /24 horas/);
});

test('banda sem nome não vira "undefined" no meio da mensagem', () => {
  const texto = convite.formatar({ link: 'https://cifro.com.br/convite.php?t=abc' });

  assert.doesNotMatch(texto, /undefined/);
  assert.match(texto, /https:\/\/cifro\.com\.br\/convite\.php\?t=abc/);
});

test('no desktop o convite vai para a área de transferência', async () => {
  const copiados = [];
  globalThis.CifroShare.copy = async texto => { copiados.push(texto); };
  setNavigator({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });

  const resultado = await convite.share({ bandaNome: 'Os Fulanos', link: 'https://x/convite.php?t=1' });

  assert.equal(resultado, 'copied');
  assert.equal(copiados.length, 1);
  assert.match(copiados[0], /Os Fulanos/);
});

test('no celular o convite abre o compartilhamento nativo', async () => {
  const compartilhados = [];
  setNavigator({
    userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile',
    share: async dados => { compartilhados.push(dados); },
  });

  const resultado = await convite.share({ bandaNome: 'Os Fulanos', link: 'https://x/convite.php?t=1' });

  assert.equal(resultado, 'shared');
  assert.match(compartilhados[0].text, /Os Fulanos/);
});

test('desistir do compartilhamento nativo não é erro', async () => {
  setNavigator({
    userAgent: 'Mozilla/5.0 (Linux; Android 13) Mobile',
    share: async () => { const erro = new Error('cancelado'); erro.name = 'AbortError'; throw erro; },
  });

  assert.equal(await convite.share({ bandaNome: 'X', link: 'https://x/1' }), 'cancelled');
});
