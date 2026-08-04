import assert from 'node:assert/strict';
import test from 'node:test';
import '../public/src/js/chords.js';

const chords = globalThis.CifroChords;

test('identifica tons maiores pela harmonia e pelas cadências', () => {
  assert.equal(chords.identifyKey('<b>D A Bm G</b><br><b>Em A D</b>').key, 'D');
  assert.equal(chords.identifyKey('<b>F Bb C F</b>').key, 'F');
});

test('diferencia o tom menor do relativo maior', () => {
  assert.equal(chords.identifyKey('<b>Am G F E</b><br><b>Dm E Am</b>').key, 'Am');
  assert.equal(chords.identifyKey('<b>Em C G D</b><br><b>Am B7 Em</b>').key, 'Em');
});

test('identifica uma linha de acordes sem marcação HTML', () => {
  assert.equal(chords.identifyKey('C G Am F\nG C').key, 'C');
});

test('identifica acordes marcados separadamente e ignora letra isolada', () => {
  assert.equal(chords.identifyKey('<b>D</b> <b>A</b> <b>Bm</b> <b>G</b> <b>D</b>').key, 'D');
  assert.equal(chords.identifyKey('A\nletra sem acordes'), null);
});

test('transpõe acordes, baixos e mantém a letra e o alinhamento', () => {
  const source = '<b>D&nbsp;&nbsp;A Bm G D/F#</b><br>A letra continua igual';
  const result = chords.transposeToKey(source, 'D', 'E');
  assert.equal(result, '<b>E&nbsp;&nbsp;B C#m A E/G#</b><br>A letra continua igual');
});

test('normaliza tons com bemóis', () => {
  assert.equal(chords.normalizeKey('Bb'), 'A#');
  assert.equal(chords.normalizeKey('Ebm'), 'D#m');
});
