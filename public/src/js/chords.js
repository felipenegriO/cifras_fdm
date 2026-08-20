(function (root) {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_INDEX = {
    C: 0, 'C#': 1, DB: 1,
    D: 2, 'D#': 3, EB: 3,
    E: 4, FB: 4, 'E#': 5,
    F: 5, 'F#': 6, GB: 6,
    G: 7, 'G#': 8, AB: 8,
    A: 9, 'A#': 10, BB: 10,
    B: 11, CB: 11
  };
  const MAJOR_KEYS = NOTES.slice();
  const MINOR_KEYS = NOTES.map(note => note + 'm');
  const TOKEN_PATTERN = /(^|[^A-Za-z0-9#b/])([A-Ga-g])([#b]?)((?:(?:maj|min|dim|aug|sus|add|m|M)|[0-9()+º°#b+\-])*)(\/([A-Ga-g])([#b]?))?(?=$|[^A-Za-z0-9#b/])/g;
  const MAJOR_QUALITIES = {
    0: ['major', 'suspended'],
    2: ['minor'],
    4: ['minor'],
    5: ['major', 'suspended'],
    7: ['major', 'suspended'],
    9: ['minor'],
    11: ['diminished']
  };
  const MINOR_QUALITIES = {
    0: ['minor'],
    2: ['diminished'],
    3: ['major'],
    5: ['minor', 'major', 'suspended'],
    7: ['major', 'minor', 'suspended'],
    8: ['major'],
    10: ['major'],
    11: ['diminished']
  };

  function noteIndex(note) {
    return NOTE_INDEX[String(note || '').trim().toUpperCase()];
  }

  function normalizeKey(key) {
    const value = String(key || '').trim();
    const match = value.match(/^([A-G])([#b]?)(m)?$/i);
    if (!match) return '';
    const index = noteIndex(match[1] + match[2]);
    return index === undefined ? '' : NOTES[index] + (match[3] ? 'm' : '');
  }

  function tonicOf(key) {
    const normalized = normalizeKey(key);
    return normalized.endsWith('m') ? normalized.slice(0, -1) : normalized;
  }

  function modeOf(key) {
    const normalized = normalizeKey(key);
    if (!normalized) return '';
    return normalized.endsWith('m') ? 'minor' : 'major';
  }

  function qualityOf(suffix) {
    const value = String(suffix || '').toLowerCase();
    if (value.includes('dim') || /[º°]/.test(value)) return 'diminished';
    if (value.includes('aug') || value === '+') return 'augmented';
    if (value.includes('sus')) return 'suspended';
    if (value.startsWith('min') || (value.startsWith('m') && !value.startsWith('maj'))) return 'minor';
    return 'major';
  }

  function chordFromMatch(match) {
    const index = noteIndex(match[2] + match[3]);
    if (index === undefined) return null;
    return {
      root: NOTES[index],
      pitch: index,
      quality: qualityOf(match[4]),
      suffix: match[4] || ''
    };
  }

  function chordsFromText(text) {
    const chords = [];
    const pattern = new RegExp(TOKEN_PATTERN.source, 'g');
    let match;
    while ((match = pattern.exec(String(text || ''))) !== null) {
      const chord = chordFromMatch(match);
      if (chord) chords.push(chord);
    }
    return chords;
  }

  function decodeChordText(value) {
    return String(value || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;|&#160;|\u00a0/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }

  function extractChords(html) {
    const source = String(html || '');
    const chords = [];
    const tagged = /<(b|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = tagged.exec(source)) !== null) {
      chords.push(...chordsFromText(decodeChordText(match[2])));
    }

    if (chords.length) return chords;

    const plain = source
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|pre|section)>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;|&#160;|\u00a0/gi, ' ');

    plain.split(/\r?\n/).forEach(line => {
      const cleaned = line.trim();
      if (!cleaned) return;
      const lineChords = chordsFromText(cleaned);
      const residue = cleaned
        .replace(TOKEN_PATTERN, '$1')
        .replace(/[\s|,.;:()[\]\-]+/g, '');
      if (lineChords.length && residue === '') chords.push(...lineChords);
    });

    return chords.length >= 2 ? chords : [];
  }

  function scoreCandidate(chords, tonic, mode) {
    const tonicPitch = noteIndex(tonic);
    const qualities = mode === 'minor' ? MINOR_QUALITIES : MAJOR_QUALITIES;
    const dominant = (tonicPitch + 7) % 12;
    const subdominant = (tonicPitch + 5) % 12;
    let score = 0;
    let tonicCount = 0;

    chords.forEach((chord, index) => {
      const degree = (chord.pitch - tonicPitch + 12) % 12;
      const expected = qualities[degree];
      if (expected) {
        score += 1.5;
        score += expected.includes(chord.quality) ? 2.25 : -1;
      } else {
        score -= 3.5;
      }

      if (chord.pitch === tonicPitch) {
        tonicCount += 1;
        const tonicMatches = mode === 'minor' ? chord.quality === 'minor' : chord.quality !== 'minor' && chord.quality !== 'diminished';
        score += tonicMatches ? 4.5 : -2.5;
        if (index === 0) score += 3.5;
        if (index === chords.length - 1) score += 5;
      }
      if (chord.pitch === dominant) score += 1.75;
      if (chord.pitch === subdominant) score += 0.75;
    });

    for (let index = 1; index < chords.length; index += 1) {
      const previous = chords[index - 1].pitch;
      const current = chords[index].pitch;
      if (previous === dominant && current === tonicPitch) score += 5;
      if (previous === subdominant && current === tonicPitch) score += 2.5;
      if (mode === 'minor' && previous === (tonicPitch + 10) % 12 && current === tonicPitch) score += 1.5;
    }

    if (!tonicCount) score -= 4;
    return score;
  }

  function identifyKey(html) {
    const chords = extractChords(html);
    if (!chords.length) return null;

    const candidates = [];
    NOTES.forEach(tonic => {
      candidates.push({ tonic, mode: 'major', score: scoreCandidate(chords, tonic, 'major') });
      candidates.push({ tonic, mode: 'minor', score: scoreCandidate(chords, tonic, 'minor') });
    });
    candidates.sort((a, b) => b.score - a.score);

    const best = candidates[0];
    const second = candidates[1];
    const margin = best.score - second.score;
    const confidence = Math.max(0.1, Math.min(0.99, 0.35 + margin / Math.max(Math.abs(best.score), 8) + Math.min(chords.length, 12) / 30));

    return {
      key: best.tonic + (best.mode === 'minor' ? 'm' : ''),
      tonic: best.tonic,
      mode: best.mode,
      confidence: Number(confidence.toFixed(2)),
      chordCount: chords.length
    };
  }

  function transposeNote(note, accidental, semitones) {
    const index = noteIndex(note + (accidental || ''));
    if (index === undefined) return note + (accidental || '');
    return NOTES[(index + Number(semitones) + 1200) % 12];
  }

  function transposeChordText(text, semitones) {
    return String(text || '').replace(TOKEN_PATTERN, function (match, prefix, note, accidental, suffix, bass, bassNote, bassAccidental) {
      const transposedBass = bass ? '/' + transposeNote(bassNote, bassAccidental, semitones) : '';
      return prefix + transposeNote(note, accidental, semitones) + (suffix || '') + transposedBass;
    });
  }

  function transposeHtml(html, semitones) {
    const source = String(html || '');
    const amount = Number(semitones) || 0;
    if (!amount) return source;

    if (/<(?:b|strong)\b/i.test(source)) {
      return source.replace(/<(b|strong)\b([^>]*)>([\s\S]*?)<\/\1>/gi, function (match, tag, attributes, content) {
        return '<' + tag + attributes + '>' + transposeChordText(content, amount) + '</' + tag + '>';
      });
    }

    return source.split(/(\r?\n|<br\s*\/?>)/i).map(part => {
      const chords = chordsFromText(part);
      const residue = part.replace(TOKEN_PATTERN, '$1').replace(/[\s|,.;:()[\]\-]+/g, '');
      return chords.length && residue === '' ? transposeChordText(part, amount) : part;
    }).join('');
  }

  function intervalBetweenKeys(fromKey, toKey) {
    const from = noteIndex(tonicOf(fromKey));
    const to = noteIndex(tonicOf(toKey));
    if (from === undefined || to === undefined) return null;
    return (to - from + 12) % 12;
  }

  function transposeToKey(html, fromKey, toKey) {
    const interval = intervalBetweenKeys(fromKey, toKey);
    return interval === null ? String(html || '') : transposeHtml(html, interval);
  }

  function keysForMode(mode) {
    return mode === 'minor' ? MINOR_KEYS.slice() : MAJOR_KEYS.slice();
  }

  // ---------------------------------------------------------------------
  // Deslocamento de instrumento: capotraste no violão, transpose no teclado.
  // O valor diz quanto o INSTRUMENTO sobe em relação às formas mostradas na
  // tela. O som que sai nunca muda — só a forma que o dedo faz.
  // ---------------------------------------------------------------------
  const INSTRUMENTOS = ['violao', 'teclado', 'outro'];
  const FAIXA_MANUAL = {
    violao: { min: 0, max: 12 },
    teclado: { min: -12, max: 12 },
    outro: { min: -12, max: 12 }
  };
  // A janela do automático é menor que a faixa manual de propósito: fora dela o
  // resultado só se repete (deslocamento 8 dá as mesmas formas que -4), então
  // buscar mais longe produziria posição apertada sem ganho nenhum. Chegar lá é
  // decisão de quem toca, pelo controle manual.
  const JANELA_AUTOMATICA = {
    violao: { min: 0, max: 7 },
    teclado: { min: -6, max: 6 },
    outro: { min: -6, max: 6 }
  };
  const ROTULO = { violao: 'Capotraste', teclado: 'Transpose', outro: 'Transposição' };
  // Formas abertas do violão. Pestana é o que o nível básico evita.
  const RAIZES_ABERTAS_MAIOR = ['C', 'A', 'G', 'E', 'D'];
  const RAIZES_ABERTAS_MENOR = ['A', 'E', 'D'];
  // Tons de menos teclas pretas, para quem toca teclado.
  const RAIZES_POUCAS_TECLAS_PRETAS = ['C', 'G', 'F', 'D'];
  const RAIZES_POUCAS_TECLAS_PRETAS_MENOR = ['A', 'E', 'D'];

  function instrumentoValido(instrumento) {
    return INSTRUMENTOS.indexOf(String(instrumento)) !== -1 ? String(instrumento) : 'outro';
  }

  function faixaManual(instrumento) {
    const faixa = FAIXA_MANUAL[instrumentoValido(instrumento)];
    return { min: faixa.min, max: faixa.max };
  }

  function janelaAutomatica(instrumento) {
    const faixa = JANELA_AUTOMATICA[instrumentoValido(instrumento)];
    return { min: faixa.min, max: faixa.max };
  }

  function rotuloDeslocamento(instrumento) {
    return ROTULO[instrumentoValido(instrumento)];
  }

  // Deslocamento positivo = instrumento sobe, então as formas descem.
  function aplicarDeslocamento(html, deslocamento) {
    const valor = Number(deslocamento) || 0;
    return valor === 0 ? String(html || '') : transposeHtml(html, -valor);
  }

  function tomDasFormas(tomSoante, deslocamento) {
    const normalizado = normalizeKey(tomSoante);
    if (!normalizado) return '';
    const indice = noteIndex(tonicOf(normalizado));
    if (indice === undefined) return '';
    const valor = Number(deslocamento) || 0;
    return NOTES[(indice - valor + 1200) % 12] + (normalizado.endsWith('m') ? 'm' : '');
  }

  // Um acorde "atrapalha" quando o critério do instrumento diz que ele é difícil
  // de tocar. Só a raiz conta: D/F# é trivial e seria punido injustamente pelo
  // sustenido do baixo.
  function atrapalha(chord, instrumento, nivel) {
    const raiz = NOTES[chord.pitch];

    if (nivel !== 'basico') return raiz.length > 1;

    if (chord.quality === 'diminished' || chord.quality === 'augmented') return true;

    if (instrumentoValido(instrumento) === 'violao') {
      const abertas = chord.quality === 'minor' ? RAIZES_ABERTAS_MENOR : RAIZES_ABERTAS_MAIOR;
      return abertas.indexOf(raiz) === -1;
    }

    const faceis = chord.quality === 'minor' ? RAIZES_POUCAS_TECLAS_PRETAS_MENOR : RAIZES_POUCAS_TECLAS_PRETAS;
    return faceis.indexOf(raiz) === -1;
  }

  function deslocarAcorde(chord, deslocamento) {
    return { pitch: (chord.pitch - deslocamento + 1200) % 12, quality: chord.quality };
  }

  function nivelValido(nivel) {
    return nivel === 'basico' ? 'basico' : 'simplificar';
  }

  function custoDeslocamento(html, deslocamento, opcoes) {
    const config = opcoes || {};
    const instrumento = instrumentoValido(config.instrumento);
    const nivel = nivelValido(config.nivel);
    const valor = Number(deslocamento) || 0;
    return extractChords(html).reduce(function (total, chord) {
      return total + (atrapalha(deslocarAcorde(chord, valor), instrumento, nivel) ? 1 : 0);
    }, 0);
  }

  function sugerirDeslocamento(html, opcoes) {
    const config = opcoes || {};
    const instrumento = instrumentoValido(config.instrumento);
    const nivel = nivelValido(config.nivel);
    const chords = extractChords(html);
    if (!chords.length) return 0;

    const janela = janelaAutomatica(instrumento);
    let melhor = 0;
    let melhorCusto = Infinity;

    for (let valor = janela.min; valor <= janela.max; valor += 1) {
      let custo = 0;
      chords.forEach(chord => {
        if (atrapalha(deslocarAcorde(chord, valor), instrumento, nivel)) custo += 1;
      });
      // Empate favorece o menor módulo, e o zero vence qualquer empate: assim o
      // sistema nunca propõe deslocamento sem ganho real.
      const venceNoEmpate = custo === melhorCusto && Math.abs(valor) < Math.abs(melhor);
      if (custo < melhorCusto || venceNoEmpate) {
        melhorCusto = custo;
        melhor = valor;
      }
    }

    return melhor;
  }

  root.CifroChords = {
    NOTES: NOTES.slice(),
    INSTRUMENTOS: INSTRUMENTOS.slice(),
    aplicarDeslocamento,
    custoDeslocamento,
    faixaManual,
    janelaAutomatica,
    rotuloDeslocamento,
    sugerirDeslocamento,
    tomDasFormas,
    MAJOR_KEYS: MAJOR_KEYS.slice(),
    MINOR_KEYS: MINOR_KEYS.slice(),
    extractChords,
    identifyKey,
    intervalBetweenKeys,
    keysForMode,
    modeOf,
    normalizeKey,
    tonicOf,
    transposeChordText,
    transposeHtml,
    transposeToKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
