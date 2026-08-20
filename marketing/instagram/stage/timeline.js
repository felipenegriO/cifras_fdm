(function () {
  const FPS = 30;
  const TOTAL_FRAMES = 1800; // 60,0s

  // Cada cena declara o layout, a legenda e o mock. `to` e exclusivo.
  //
  // Layouts:
  //   brand -> so o cartao de texto, sem celular (as viradas de discurso)
  //   mock  -> uma das telas de dor, em tela cheia
  //   solo  -> um celular ampliado
  //   duo   -> os dois celulares (host e banda)
  //   logo  -> cartao final
  const SCENES = [
    { id: 'abertura',   from:    0, to:  120, layout: 'brand', mock: null,    caption: 'Por que o <em>Cifrô</em>?' },
    { id: 'pdf',        from:  120, to:  180, layout: 'mock',  mock: 'pdf',   caption: 'Não precisa montar PDF' },
    { id: 'ordem',      from:  180, to:  300, layout: 'mock',  mock: 'paper', caption: 'E quando muda a ordem do repertório?' },
    { id: 'tom',        from:  300, to:  420, layout: 'mock',  mock: 'tom',   caption: 'E se precisar trocar de tom?' },
    { id: 'grupo',      from:  420, to:  480, layout: 'mock',  mock: 'chat',  caption: 'Até encontrar a playlist no grupo?' },
    { id: 'propaganda', from:  480, to:  660, layout: 'mock',  mock: 'adapp', caption: 'E quando precisa buscar uma cifra e tem propaganda?' },
    { id: 'virada',     from:  660, to:  780, layout: 'brand', mock: null,    caption: 'No <em>Cifrô</em>, não!' },
    { id: 'lista',      from:  780, to:  900, layout: 'solo',  mock: null,    caption: 'Todas as músicas em um só lugar!' },
    { id: 'playlist',   from:  900, to:  960, layout: 'solo',  mock: null,    caption: 'Playlist integrada!' },
    { id: 'live',       from:  960, to: 1140, layout: 'duo',   mock: null,    caption: 'o host troca. <em>todo mundo acompanha.</em>' },
    { id: 'scroll',     from: 1140, to: 1200, layout: 'solo',  mock: null,    caption: '' },
    { id: 'roteiro',    from: 1200, to: 1260, layout: 'solo',  mock: null,    caption: 'o roteiro pronto' },
    { id: 'ensaio',     from: 1260, to: 1380, layout: 'solo',  mock: null,    caption: 'ensaia o trecho difícil em loop' },
    { id: 'offline',    from: 1380, to: 1500, layout: 'solo',  mock: null,    caption: 'e funciona sem internet' },
    { id: 'logo',       from: 1500, to: 1800, layout: 'logo',  mock: null,    caption: '' },
  ];

  // Quadros em que record.mjs dispara uma acao real no app.
  //
  // `transpose` fica DENTRO da cena `live` de proposito: a cena `tom` faz a
  // pergunta "e se precisar trocar de tom?" e nenhuma legenda posterior a
  // responde, entao a resposta e visual — os acordes mudam na tela enquanto o
  // Modo Live esta no ar.
  const KEYFRAMES = {
    lista: 780,
    playlist: 900,
    liveBack: 960,  // host volta de index.php para music.php antes da cena Live
    liveFlip: 1020,
    transpose: 1095,
    scroll: 1140,
    roteiro: 1200,
    rehearsal: 1260,
    offline: 1380,
  };

  const FLASH_FRAMES = 9; // duracao do anel violeta apos a troca

  // A legenda sobe para o centro nas cenas `brand`, que nao tem celular nenhum
  // na tela, e volta para baixo nas demais.
  const CAPTION_TOP = { brand: 820, outros: 1240 };

  function sceneAt(frame) {
    return SCENES.find(scene => frame >= scene.from && frame < scene.to) || null;
  }

  // Saida suave: rapida no inicio, assenta no fim. Mesma curva do easing
  // cubic-bezier(.16,1,.3,1), mas calculada por quadro para ser deterministica.
  function easeOut(t) {
    const clamped = Math.min(Math.max(t, 0), 1);
    return 1 - Math.pow(1 - clamped, 3);
  }

  // Progresso 0..1 de uma entrada de `frames` quadros a partir do inicio da cena.
  function entry(frame, scene, frames) {
    return easeOut((frame - scene.from) / frames);
  }

  function render(frame) {
    const scene = sceneAt(frame);
    if (!scene) return;

    const stage    = document.getElementById('stage');
    const phones   = document.getElementById('phone-layer');
    const mockWrap = document.getElementById('mock-layer');
    const caption  = document.getElementById('caption');
    const logo     = document.getElementById('logo-card');
    const left     = document.getElementById('phone-left');
    const right    = document.getElementById('phone-right');

    stage.dataset.scene = scene.id;

    // --- celulares ---
    const showPhones = scene.layout === 'duo' || scene.layout === 'solo';
    phones.style.display = showPhones ? 'flex' : 'none';
    if (showPhones) {
      const p = entry(frame, scene, 12);
      const solo = scene.layout === 'solo';
      left.style.opacity  = String(p);
      left.style.transform = `translateY(${(1 - p) * 28}px) scale(${solo ? 1.18 : 1})`;
      right.style.opacity = solo ? '0' : String(p);
      right.style.transform = `translateY(${(1 - p) * 28}px)`;
      right.style.display = solo ? 'none' : 'block';
    }

    // --- anel violeta no instante da troca ---
    const flashing = frame >= KEYFRAMES.liveFlip && frame < KEYFRAMES.liveFlip + FLASH_FRAMES;
    right.classList.toggle('flash', flashing);

    // --- mocks ---
    mockWrap.style.display = scene.layout === 'mock' ? 'block' : 'none';
    document.querySelectorAll('.mock').forEach(node => {
      node.classList.toggle('active', scene.layout === 'mock' && node.dataset.mock === scene.mock);
    });

    // --- legenda ---
    const text = caption.querySelector('.caption-text');
    caption.classList.toggle('is-brand', scene.layout === 'brand');
    caption.style.top = `${scene.layout === 'brand' ? CAPTION_TOP.brand : CAPTION_TOP.outros}px`;
    if (!scene.caption) {
      caption.style.opacity = '0';
    } else {
      if (text.dataset.for !== scene.id) {
        text.innerHTML = scene.caption;
        text.dataset.for = scene.id;
      }
      const p = entry(frame, scene, 15);
      caption.style.opacity = String(p);
      caption.style.transform = `translateY(${(1 - p) * 22}px)`;
    }

    // --- cartao final ---
    logo.style.opacity = scene.layout === 'logo' ? String(entry(frame, scene, 18)) : '0';
  }

  window.STAGE = { FPS, TOTAL_FRAMES, SCENES, KEYFRAMES, sceneAt, render };
})();
