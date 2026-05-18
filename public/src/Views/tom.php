<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Detector (Nota + Tom) - Modal</title>

  <!-- Bootstrap 5 -->
  <script src="/src/js/fdm-theme.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="/src/css/theme.css" rel="stylesheet">
</head>
<body class="p-3">

  <button class="btn btn-success btn-sm" onclick="PitchModal.open()">
    Abrir detector
  </button>

  <!-- Bootstrap bundle -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

  <script>
  /**
   * PitchModal: Detector de Nota + Tom (key) + histórico (últimas 10)
   * Requisitos: Bootstrap 5 (bundle)
   * - Mais sensível
   * - Quando não reconhece: mostra "-"
   * - Só “assume” nota após alguns frames estáveis
   */
  (function () {
    const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

    // Perfis de Krumhansl (major/minor) para detecção de tom
    const KRUMHANSL_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
    const KRUMHANSL_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

    let audioCtx = null;
    let analyser = null;
    let stream = null;
    let rafId = null;

    let lastNoteStr = "";
    let stableKey = null; // {name, mode, score, conf}
    let keyHoldMs = 2200;
    let lastKeyChangeAt = 0;

    // Estabilidade da nota
    let lastAcceptedMidi = null;
    let stableFrames = 0;

    // memória de notas (histograma de pitch classes)
    const pcWeights = new Float32Array(12);
    const pcDecay = 0.985;

    // histórico das últimas 10 notas
    const noteHistory = [];

    // refs UI
    let modalEl, bsModal;
    let elCurNote, elCurHz, elCurCents, elKey, elKeyMode, elKeyConf, elHistory, elStatus;
    let started = false;

    function createModalIfNeeded() {
      if (document.getElementById("pitchKeyModal")) {
        modalEl = document.getElementById("pitchKeyModal");
        bindRefs();
        return;
      }

      const html = `
<div class="modal fade" id="pitchKeyModal" tabindex="-1" aria-hidden="true" aria-labelledby="pmTitle">
  <div class="modal-dialog modal-dialog-centered modal-sm modal-fullscreen-sm-down">
    <div class="modal-content shadow">
      <div class="modal-header py-2">
        <div class="d-flex flex-column w-100">
          <div class="d-flex align-items-center justify-content-between">
            <h6 class="modal-title mb-0" id="pmTitle">Detector de tom</h6>
            <button type="button" class="btn-close ms-2" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="text-body-secondary small mt-1" id="pmStatus">Toque em “Ativar” para começar.</div>
        </div>
      </div>

      <div class="modal-body pt-2 pb-2">
        <div class="d-flex align-items-center justify-content-between">
          <div>
            <div class="text-body-secondary small mb-1">Nota atual</div>
            <div class="fw-bold" style="font-size: 1.8rem; line-height: 1;">
              <span id="pmCurNote">-</span>
            </div>
          </div>

          <div class="text-end">
            <div class="text-body-secondary small mb-1">Tom</div>
            <div class="fw-semibold" style="font-size: 1.15rem; line-height: 1;">
              <span id="pmKey">-</span> <span class="text-body-secondary small" id="pmKeyMode"></span>
            </div>
            <div class="text-body-secondary small" id="pmKeyConf">-</div>
            <div class="progress mt-1" style="height:4px;width:90px;margin-left:auto;background:#444;display:none;" id="pmConfBar" aria-hidden="true">
              <div class="progress-bar bg-success" style="width:0%;transition:width .2s;"></div>
            </div>
          </div>
        </div>

        <div class="d-flex gap-2 mt-2">
          <span class="badge text-bg-light border fw-normal">
            <span class="text-body-secondary">Hz:</span> <span id="pmCurHz">-</span>
          </span>
          <span class="badge text-bg-light border fw-normal">
            <span class="text-body-secondary">Cents:</span> <span id="pmCurCents">-</span>
          </span>
        </div>

        <hr class="my-2">

        <div class="text-body-secondary small mb-1">Últimas 10 notas</div>
        <div class="d-flex flex-wrap gap-1" id="pmHistory">
          <span class="text-body-secondary small">-</span>
        </div>
      </div>

      <div class="modal-footer py-2 d-flex justify-content-between">
        <button type="button" class="btn btn-outline-secondary btn-sm" id="pmStopBtn" disabled>Parar</button>
        <button type="button" class="btn btn-primary btn-sm" id="pmStartBtn">Ativar</button>
      </div>
    </div>
  </div>
</div>
`;
      document.body.insertAdjacentHTML("beforeend", html);
      modalEl = document.getElementById("pitchKeyModal");
      bindRefs();

      bsModal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: true, focus: true });

      modalEl.addEventListener("hidden.bs.modal", () => {
        stop();
      });

      document.getElementById("pmStartBtn").addEventListener("click", () => start().catch(onStartError));
      document.getElementById("pmStopBtn").addEventListener("click", () => stop());
    }

    function bindRefs() {
      elCurNote = document.getElementById("pmCurNote");
      elCurHz = document.getElementById("pmCurHz");
      elCurCents = document.getElementById("pmCurCents");
      elKey = document.getElementById("pmKey");
      elKeyMode = document.getElementById("pmKeyMode");
      elKeyConf = document.getElementById("pmKeyConf");
      elHistory = document.getElementById("pmHistory");
      elStatus = document.getElementById("pmStatus");
    }

    function setStatus(msg) {
      if (elStatus) elStatus.textContent = msg;
    }

    function freqToNote(freq) {
      const midi = Math.round(69 + 12 * Math.log2(freq / 440));
      const name = NOTE_NAMES[(midi % 12 + 12) % 12];
      const octave = Math.floor(midi / 12) - 1;
      const exact = 440 * Math.pow(2, (midi - 69) / 12);
      const cents = Math.round(1200 * Math.log2(freq / exact));
      const pc = (midi % 12 + 12) % 12;
      return { midi, name, octave, cents, pc, exact };
    }

    // Autocorrelation mais sensível
    function autoCorrelate(buffer, sampleRate) {
      const SIZE = buffer.length;

      // RMS
      let rms = 0;
      for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
      rms = Math.sqrt(rms / SIZE);

      // gate mais sensível
      if (rms < 0.006) return { freq: -1, conf: rms };

      // remove DC offset
      let mean = 0;
      for (let i = 0; i < SIZE; i++) mean += buffer[i];
      mean /= SIZE;
      for (let i = 0; i < SIZE; i++) buffer[i] -= mean;

      const minFreq = 60;
      const maxFreq = 1200;
      const minOffset = Math.floor(sampleRate / maxFreq);
      const maxOffset = Math.floor(sampleRate / minFreq);

      let bestOffset = -1;
      let bestCorr = 0;

      for (let offset = minOffset; offset <= maxOffset; offset++) {
        let corr = 0;
        for (let i = 0; i < SIZE - offset; i++) corr += buffer[i] * buffer[i + offset];
        corr = corr / (SIZE - offset);
        if (corr > bestCorr) {
          bestCorr = corr;
          bestOffset = offset;
        }
      }

      // gate de correlação mais sensível
      if (bestOffset < 0 || bestCorr < 0.012) return { freq: -1, conf: bestCorr };

      // refinamento parabólico
      const x1 = bestOffset;
      const x0 = bestOffset - 1;
      const x2 = bestOffset + 1;

      function corrAt(off) {
        if (off < minOffset || off > maxOffset) return 0;
        let c = 0;
        for (let i = 0; i < SIZE - off; i++) c += buffer[i] * buffer[i + off];
        return c / (SIZE - off);
      }

      const c0 = corrAt(x0), c1 = corrAt(x1), c2 = corrAt(x2);
      const a = (c0 + c2 - 2 * c1) / 2;
      const b = (c2 - c0) / 2;

      let refined = bestOffset;
      if (a !== 0) refined = bestOffset - b / (2 * a);

      const freq = sampleRate / refined;
      return { freq, conf: bestCorr };
    }

    function rotateProfile(profile, shift) {
      const out = new Float32Array(12);
      for (let i = 0; i < 12; i++) out[i] = profile[(i - shift + 12) % 12];
      return out;
    }

    function dot(a, b) {
      let s = 0;
      for (let i = 0; i < 12; i++) s += a[i] * b[i];
      return s;
    }

    function norm(a) {
      let s = 0;
      for (let i = 0; i < 12; i++) s += a[i] * a[i];
      return Math.sqrt(s) || 1;
    }

    function estimateKey() {
      const v = new Float32Array(12);
      for (let i = 0; i < 12; i++) v[i] = pcWeights[i];

      const vNorm = norm(v);
      for (let i = 0; i < 12; i++) v[i] /= vNorm;

      const maj = new Float32Array(KRUMHANSL_MAJOR);
      const min = new Float32Array(KRUMHANSL_MINOR);
      const majN = norm(maj), minN = norm(min);
      for (let i = 0; i < 12; i++) { maj[i] /= majN; min[i] /= minN; }

      let best = { root: 0, mode: "maj", score: -999 };

      for (let r = 0; r < 12; r++) {
        const majR = rotateProfile(maj, r);
        const minR = rotateProfile(min, r);

        const sMaj = dot(v, majR);
        const sMin = dot(v, minR);

        if (sMaj > best.score) best = { root: r, mode: "maj", score: sMaj };
        if (sMin > best.score) best = { root: r, mode: "min", score: sMin };
      }

      const name = NOTE_NAMES[best.root];
      const conf = Math.max(0, Math.min(1, best.score));
      return { name, mode: best.mode, score: best.score, conf };
    }

    function updateHistory(noteStr) {
      if (!noteStr) return;
      noteHistory.unshift(noteStr);
      if (noteHistory.length > 10) noteHistory.pop();
      renderHistory();
    }

    function renderHistory() {
      if (!elHistory) return;
      if (noteHistory.length === 0) {
        elHistory.innerHTML = `<span class="text-body-secondary small">-</span>`;
        return;
      }
      elHistory.innerHTML = noteHistory
        .map(n => `<span class="badge text-bg-light border fw-normal">${n}</span>`)
        .join('');
    }

    function onStartError(err) {
      setStatus("Permita o microfone para usar o detector.");
      console.error(err);
    }

    async function start() {
      if (started) return;
      started = true;
      setStatus("Ouvindo...");

      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      document.getElementById("pmStartBtn").disabled = true;
      document.getElementById("pmStopBtn").disabled = false;

      tick();
    }

    function stop() {
      if (!started) return;
      started = false;
      setStatus("Parado.");

      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;

      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }

      if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
      }

      if (document.getElementById("pmStartBtn")) {
        document.getElementById("pmStartBtn").disabled = false;
      }
      if (document.getElementById("pmStopBtn")) {
        document.getElementById("pmStopBtn").disabled = true;
      }

      lastAcceptedMidi = null;
      stableFrames = 0;
      pcWeights.fill(0);
      noteHistory.length = 0;
      renderHistory();
      elCurNote.textContent = '-';
      elCurHz.textContent = '-';
      elCurCents.textContent = '-';
      elKey.textContent = '-';
      elKeyMode.textContent = '';
      elKeyConf.textContent = '-';
    }

    function tick() {
      if (!analyser) return;
      const buffer = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buffer);

      const { freq, conf } = autoCorrelate(buffer, audioCtx.sampleRate);

      if (freq > 0) {
        const n = freqToNote(freq);

        // estabilidade da nota
        if (lastAcceptedMidi === n.midi) {
          stableFrames++;
        } else {
          stableFrames = 0;
        }

        if (stableFrames >= 2) {
          lastAcceptedMidi = n.midi;

          const noteStr = `${n.name}${n.octave}`;
          if (noteStr !== lastNoteStr) {
            lastNoteStr = noteStr;
            updateHistory(noteStr);
          }

          elCurNote.textContent = noteStr;
          elCurHz.textContent = Math.round(n.exact);
          elCurCents.textContent = n.cents;

          // Atualiza histogramas de pitch class
          for (let i = 0; i < 12; i++) pcWeights[i] *= pcDecay;
          pcWeights[n.pc] += 1;

          // estima tom a cada frame (com hold)
          const now = Date.now();
          const newKey = estimateKey();
          if (!stableKey || now - lastKeyChangeAt > keyHoldMs) {
            stableKey = newKey;
            lastKeyChangeAt = now;
          }

          if (stableKey) {
            elKey.textContent = stableKey.name;
            elKeyMode.textContent = stableKey.mode === 'maj' ? 'Maior' : 'Menor';
            const conf = Math.round(stableKey.conf * 100);
            elKeyConf.textContent = `Confiança: ${conf}%`;
            const bar = document.getElementById('pmConfBar');
            if (bar) {
              bar.style.display = 'block';
              const inner = bar.firstElementChild;
              inner.style.width = conf + '%';
              inner.className = 'progress-bar ' + (conf >= 75 ? 'bg-success' : conf >= 45 ? 'bg-warning' : 'bg-danger');
            }
          }
        }
      } else {
        elCurNote.textContent = '-';
        elCurHz.textContent = '-';
        elCurCents.textContent = '-';
      }

      rafId = requestAnimationFrame(tick);
    }

    // API pública
    window.PitchModal = {
      open() {
        createModalIfNeeded();
        bsModal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: true, focus: true });
        bsModal.show();
      }
    };
  })();
  </script>
</body>
</html>
