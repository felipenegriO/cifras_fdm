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

test('sugere capotraste que tira os sustenidos da cifra no violão', () => {
  // Si bemol maior: Bb, Eb, F, Gm — quatro acordes com acidente. Capo 3 leva
  // para formas de Sol (G, C, D, Em) e não sobra nenhum.
  const cifra = '<b>Bb Eb F Gm</b><br>letra<br><b>Bb F Bb</b>';
  const opcoes = { instrumento: 'violao', nivel: 'simplificar' };
  assert.equal(chords.sugerirDeslocamento(cifra, opcoes), 3);
  assert.equal(chords.custoDeslocamento(cifra, 3, opcoes), 0);
});

test('sugere capotraste que elimina a pestana no nível básico', () => {
  // Ré maior traz F#m e Bm (pestana). Capo 2 leva para C, Dm, Am, F.
  const cifra = '<b>D A Bm G</b><br>letra<br><b>F#m Bm A D</b>';
  assert.equal(chords.sugerirDeslocamento(cifra, { instrumento: 'violao', nivel: 'basico' }), 2);
});

test('no nível básico o capotraste some com o único acorde de pestana', () => {
  // C G Am F: só o F pede pestana. Capo 5 leva para formas de Sol (G D Em C),
  // todas abertas — é o movimento que todo violonista iniciante conhece.
  const cifra = '<b>C G Am F</b><br>letra<br><b>G C</b>';
  const opcoes = { instrumento: 'violao', nivel: 'basico' };
  assert.equal(chords.custoDeslocamento(cifra, 0, opcoes), 1);
  assert.equal(chords.sugerirDeslocamento(cifra, opcoes), 5);
  assert.equal(chords.custoDeslocamento(cifra, 5, opcoes), 0);
});

test('não propõe deslocamento quando a cifra já está fácil', () => {
  const cifra = '<b>C G Am Em</b><br>letra<br><b>Dm G C</b>';
  assert.equal(chords.sugerirDeslocamento(cifra, { instrumento: 'violao', nivel: 'simplificar' }), 0);
  assert.equal(chords.sugerirDeslocamento(cifra, { instrumento: 'violao', nivel: 'basico' }), 0);
});

test('o violão nunca recebe sugestão negativa', () => {
  const cifra = '<b>C# F# G#m B</b><br>letra<br><b>C# G# C#</b>';
  const sugerido = chords.sugerirDeslocamento(cifra, { instrumento: 'violao', nivel: 'simplificar' });
  assert.ok(sugerido >= 0 && sugerido <= 7, 'esperava valor entre 0 e 7, veio ' + sugerido);
});

test('o teclado recebe sugestão negativa quando descer é o caminho curto', () => {
  // Ré bemol: Db, Gb, Ab, Bbm. Transpose -1 leva para formas de Ré, que o
  // capotraste do violão jamais alcançaria.
  const cifra = '<b>Db Gb Ab Bbm</b><br>letra<br><b>Db Ab Db</b>';
  const opcoes = { instrumento: 'teclado', nivel: 'simplificar' };
  assert.equal(chords.sugerirDeslocamento(cifra, opcoes), -1);
  assert.equal(chords.custoDeslocamento(cifra, -1, opcoes), 0);
});

test('entre dois deslocamentos igualmente bons vence o de menor módulo', () => {
  // Si maior resolve tanto subindo 2 (formas de Lá) quanto descendo 3
  // (formas de Ré). O menor movimento ganha.
  const cifra = '<b>B E F#m A</b><br>letra<br><b>B F# B</b>';
  const opcoes = { instrumento: 'teclado', nivel: 'simplificar' };
  assert.equal(chords.custoDeslocamento(cifra, -3, opcoes), 0);
  assert.equal(chords.custoDeslocamento(cifra, 2, opcoes), 0);
  assert.equal(chords.sugerirDeslocamento(cifra, opcoes), 2);
});

test('mede o custo de um deslocamento contando os acordes difíceis', () => {
  const cifra = '<b>D A Bm G F#m</b>';
  assert.equal(chords.custoDeslocamento(cifra, 0, { instrumento: 'violao', nivel: 'basico' }), 2);
  assert.equal(chords.custoDeslocamento(cifra, 2, { instrumento: 'violao', nivel: 'basico' }), 1);
});

test('aplicar o deslocamento mostra as formas mais graves e preserva a letra', () => {
  const cifra = '<b>A D E</b><br>a letra continua igual';
  assert.equal(chords.aplicarDeslocamento(cifra, 2), '<b>G C D</b><br>a letra continua igual');
});

test('deslocamento zero devolve a cifra intacta', () => {
  const cifra = '<b>A D E</b><br>a letra continua igual';
  assert.equal(chords.aplicarDeslocamento(cifra, 0), cifra);
});

test('informa em que tom ficam as formas com o capotraste posto', () => {
  assert.equal(chords.tomDasFormas('A', 2), 'G');
  assert.equal(chords.tomDasFormas('Am', 2), 'Gm');
  assert.equal(chords.tomDasFormas('A', 0), 'A');
});

test('a faixa manual do violão não desce abaixo de zero', () => {
  assert.deepEqual(chords.faixaManual('violao'), { min: 0, max: 12 });
  assert.deepEqual(chords.faixaManual('teclado'), { min: -12, max: 12 });
  assert.deepEqual(chords.faixaManual('outro'), { min: -12, max: 12 });
});

test('a janela do cálculo automático é menor que a faixa manual', () => {
  assert.deepEqual(chords.janelaAutomatica('violao'), { min: 0, max: 7 });
  assert.deepEqual(chords.janelaAutomatica('teclado'), { min: -6, max: 6 });
});

test('cada instrumento tem o seu rótulo', () => {
  assert.equal(chords.rotuloDeslocamento('violao'), 'Capotraste');
  assert.equal(chords.rotuloDeslocamento('teclado'), 'Transpose');
  assert.equal(chords.rotuloDeslocamento('outro'), 'Transposição');
});

test('instrumento desconhecido cai no comportamento neutro', () => {
  assert.deepEqual(chords.faixaManual('gaita'), { min: -12, max: 12 });
  assert.equal(chords.rotuloDeslocamento('gaita'), 'Transposição');
});
