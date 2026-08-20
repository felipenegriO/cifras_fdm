import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('marketing/instagram/stage/timeline.js', 'utf8');

function loadTimeline() {
  const context = { window: {}, document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null } };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.STAGE;
}

// Onde cada ação do roteiro precisa acontecer. É a tabela que dá sentido aos
// números da timeline: mover um keyframe para fora da sua cena quebra o vídeo
// em silêncio — a ação roda enquanto a tela mostra outra coisa.
const ACAO_NA_CENA = {
  lista:     'lista',
  playlist:  'playlist',
  liveBack:  'live',
  liveFlip:  'live',
  transpose: 'live',
  scroll:    'scroll',
  roteiro:   'roteiro',
  rehearsal: 'ensaio',
  offline:   'offline',
};

// liveFlip e transpose acontecem NO MEIO da cena `live`, de propósito: a troca
// de host e a transposição precisam ser vistas com a cena já estabelecida. Todo
// o resto abre a própria cena, para a ação valer do primeiro quadro.
const ACOES_NO_MEIO_DA_CENA = ['liveFlip', 'transpose'];

test('o reel dura 60 segundos a 30 fps', () => {
  const stage = loadTimeline();
  assert.equal(stage.FPS, 30);
  assert.equal(stage.TOTAL_FRAMES, stage.FPS * 60);
});

test('as cenas cobrem a linha do tempo inteira sem buraco nem sobreposicao', () => {
  const stage = loadTimeline();
  const scenes = stage.SCENES;
  assert.equal(scenes[0].from, 0);
  assert.equal(scenes.at(-1).to, stage.TOTAL_FRAMES);
  for (let i = 1; i < scenes.length; i += 1) {
    assert.equal(scenes[i].from, scenes[i - 1].to, `buraco ou sobreposicao antes da cena ${scenes[i].id}`);
  }
});

test('todo quadro valido resolve para exatamente uma cena', () => {
  const stage = loadTimeline();
  for (let frame = 0; frame < stage.TOTAL_FRAMES; frame += 1) {
    const scene = stage.sceneAt(frame);
    assert.ok(scene, `quadro ${frame} sem cena`);
    assert.ok(frame >= scene.from && frame < scene.to);
  }
});

test('os keyframes de acao caem dentro das cenas de app correspondentes', () => {
  const stage = loadTimeline();
  for (const [acao, cenaEsperada] of Object.entries(ACAO_NA_CENA)) {
    const frame = stage.KEYFRAMES[acao];
    assert.ok(Number.isInteger(frame), `keyframe ${acao} nao existe mais na timeline`);
    assert.equal(stage.sceneAt(frame).id, cenaEsperada, `a acao ${acao} caiu fora da cena ${cenaEsperada}`);
  }
});

test('a tabela de acoes cobre todos os keyframes da timeline', () => {
  const stage = loadTimeline();
  // Sem isto, acrescentar um keyframe novo e esquecer de posiciona-lo passaria
  // despercebido: o teste acima so olha o que ja esta na tabela.
  assert.deepEqual(Object.keys(stage.KEYFRAMES).sort(), Object.keys(ACAO_NA_CENA).sort());
});

test('cada keyframe cai no primeiro quadro da sua cena, para a acao valer a cena inteira', () => {
  const stage = loadTimeline();
  for (const [acao, frame] of Object.entries(stage.KEYFRAMES)) {
    if (ACOES_NO_MEIO_DA_CENA.includes(acao)) continue;
    const scene = stage.sceneAt(frame);
    assert.equal(frame, scene.from, `keyframe ${acao} deveria abrir a cena ${scene.id}`);
  }
});
