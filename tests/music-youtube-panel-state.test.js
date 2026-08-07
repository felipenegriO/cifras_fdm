import assert from 'node:assert/strict';
import test from 'node:test';
import '../public/src/js/music-youtube-panel-state.js';

const panelState = globalThis.CifroYoutubePanelState;

test('storageKey monta a chave prefixada pela música', () => {
  assert.equal(panelState.storageKey(42), 'cifroYoutubePanel:42');
  assert.equal(panelState.storageKey('abc'), 'cifroYoutubePanel:abc');
});

test('parseStored retorna null para entrada vazia ou ausente', () => {
  assert.equal(panelState.parseStored(null), null);
  assert.equal(panelState.parseStored(''), null);
});

test('parseStored retorna null para JSON inválido', () => {
  assert.equal(panelState.parseStored('{not json'), null);
});

test('parseStored retorna null quando falta videoId', () => {
  assert.equal(panelState.parseStored(JSON.stringify({ state: 'open' })), null);
  assert.equal(panelState.parseStored(JSON.stringify({ videoId: '', state: 'open' })), null);
});

test('parseStored retorna null para state fora de VALID_STATES', () => {
  assert.equal(panelState.parseStored(JSON.stringify({ videoId: 'abc123', state: 'tocando' })), null);
});

test('parseStored aceita entrada válida e preenche title vazio quando ausente', () => {
  const result = panelState.parseStored(JSON.stringify({ videoId: 'abc123def45', state: 'minimized' }));
  assert.deepEqual(result, { videoId: 'abc123def45', title: '', state: 'minimized' });
});

test('parseStored preserva o title quando presente', () => {
  const result = panelState.parseStored(JSON.stringify({ videoId: 'abc123def45', title: 'Minha música', state: 'open' }));
  assert.deepEqual(result, { videoId: 'abc123def45', title: 'Minha música', state: 'open' });
});

test('serialize produz JSON com title vazio como padrão', () => {
  const json = panelState.serialize({ videoId: 'abc123def45', state: 'open' });
  assert.deepEqual(JSON.parse(json), { videoId: 'abc123def45', title: '', state: 'open' });
});

test('serialize preserva o title informado', () => {
  const json = panelState.serialize({ videoId: 'abc123def45', title: 'Minha música', state: 'hidden' });
  assert.deepEqual(JSON.parse(json), { videoId: 'abc123def45', title: 'Minha música', state: 'hidden' });
});

test('round-trip: parseStored(serialize(x)) preserva os dados', () => {
  const entry = { videoId: 'xyz987uvw65', title: 'Teste', state: 'minimized' };
  assert.deepEqual(panelState.parseStored(panelState.serialize(entry)), entry);
});
