(() => {
  'use strict';

  const splash = document.getElementById('cifroPwaSplash');
  if (!splash) return;

  const marker = 'cifroPwaSplashShown';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let alreadyShown = false;
  try { alreadyShown = sessionStorage.getItem(marker) === '1'; } catch (_) {}

  const finishWithoutAnimation = () => {
    document.documentElement.classList.remove('cifro-pwa-splash-pending');
    splash.remove();
  };

  if (!standalone || reducedMotion || alreadyShown) {
    finishWithoutAnimation();
    return;
  }

  try { sessionStorage.setItem(marker, '1'); } catch (_) {}
  splash.hidden = false;
  document.documentElement.classList.add('cifro-pwa-splash-pending');
  document.dispatchEvent(new CustomEvent('cifro:pwa-splash', { detail: { state: 'started' } }));

  const logoCanvas = splash.querySelector('.cifro-pwa-splash__logo-canvas');
  const particleCanvas = splash.querySelector('.cifro-pwa-splash__particles');
  const ctx = logoCanvas?.getContext('2d', { willReadFrequently: true });
  const pctx = particleCanvas?.getContext('2d');
  if (!ctx || !pctx) {
    finishWithoutAnimation();
    return;
  }

  const width = logoCanvas.width;
  const height = logoCanvas.height;
  const config = {
    background: [15, 15, 15],
    seedX: 495,
    seedY: 200,
    introDelay: 150,
    dissolveDuration: 1350,
    blackHold: 170,
    appFade: 360,
    noiseStrength: 2.28,
    frontSoftness: .015,
    maxParticles: 260,
    spawnPerFrame: 7,
  };

  const image = new Image();
  image.decoding = 'async';
  let basePixels;
  let frameData;
  let purplePixels = [];
  let buckets = [];
  let particles = [];
  let animationStart = 0;
  let opened = false;

  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smooth = value => {
    const normalized = clamp(value);
    return normalized * normalized * (3 - 2 * normalized);
  };
  const ease = value => value < .5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

  function hash(x, y) {
    let value = (x * 374761393 + y * 668265263) >>> 0;
    value = (value ^ (value >> 13)) * 1274126177;
    return ((value ^ (value >> 16)) >>> 0) / 4294967295;
  }

  function valueNoise(x, y, scale) {
    const scaledX = x / scale;
    const scaledY = y / scale;
    const x0 = Math.floor(scaledX);
    const y0 = Math.floor(scaledY);
    const tx = scaledX - x0;
    const ty = scaledY - y0;
    const ux = tx * tx * (3 - 2 * tx);
    const uy = ty * ty * (3 - 2 * ty);
    const top = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * ux;
    const bottom = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * ux;
    return top + (bottom - top) * uy;
  }

  function fbm(x, y) {
    return valueNoise(x, y, 78) * .5
      + valueNoise(x + 71, y - 29, 38) * .28
      + valueNoise(x - 17, y + 91, 19) * .14
      + valueNoise(x + 143, y + 47, 9) * .08;
  }

  function isPurple(red, green, blue, alpha) {
    return alpha > 20 && blue > 115 && red > 45 && blue > green * 1.65 && blue > red * 1.25 && red - green > 10;
  }

  function prepare() {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const base = ctx.getImageData(0, 0, width, height);
    basePixels = base.data;
    frameData = new ImageData(new Uint8ClampedArray(basePixels), width, height);
    let minOrder = Infinity;
    let maxOrder = -Infinity;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const red = basePixels[index];
        const green = basePixels[index + 1];
        const blue = basePixels[index + 2];
        const alpha = basePixels[index + 3];
        if (!isPurple(red, green, blue, alpha)) continue;
        const dx = x - config.seedX;
        const dy = y - config.seedY;
        const distance = Math.sqrt(Math.pow(dx * .86, 2) + Math.pow(dy * 1.03, 2));
        const noise = fbm(x, y);
        const wave = Math.sin(x * .031 + y * .019 + noise * 5.3) * .035;
        const order = distance + (noise - .5) * 165 * config.noiseStrength + wave * 110
          + Math.max(0, dy) * .055 + Math.max(0, -dx) * .018;
        minOrder = Math.min(minOrder, order);
        maxOrder = Math.max(maxOrder, order);
        purplePixels.push({ index, x, y, order, noise, edgeNoise: hash(x + 991, y + 337) });
      }
    }

    const span = Math.max(1, maxOrder - minOrder);
    buckets = Array.from({ length: 180 }, () => []);
    for (const pixel of purplePixels) {
      pixel.time = clamp((pixel.order - minOrder) / span);
      const bucketIndex = Math.min(179, Math.floor(pixel.time * 179));
      if (buckets[bucketIndex].length < 220 && hash(pixel.x + bucketIndex, pixel.y - bucketIndex) > .86) {
        buckets[bucketIndex].push([pixel.x, pixel.y]);
      }
    }
    ctx.putImageData(base, 0, 0);
  }

  function renderLogo(progress) {
    const output = frameData.data;
    output.set(basePixels);
    const normalized = clamp(progress);
    for (const pixel of purplePixels) {
      let dissolve = (normalized - pixel.time) / config.frontSoftness;
      dissolve += (pixel.edgeNoise - .5) * .7;
      dissolve += (pixel.noise - .5) * .35;
      let erase = smooth(dissolve);
      if (normalized > pixel.time - config.frontSoftness * .45 && pixel.edgeNoise > .91) erase = Math.max(erase, .62);
      if (erase <= 0) continue;
      const index = pixel.index;
      output[index] = Math.round(basePixels[index] + (config.background[0] - basePixels[index]) * erase);
      output[index + 1] = Math.round(basePixels[index + 1] + (config.background[1] - basePixels[index + 1]) * erase);
      output[index + 2] = Math.round(basePixels[index + 2] + (config.background[2] - basePixels[index + 2]) * erase);
    }
    ctx.putImageData(frameData, 0, 0);
  }

  function spawnParticles(progress) {
    const center = Math.floor(clamp(progress) * 179);
    for (let count = 0; count < config.spawnPerFrame; count++) {
      const bucketIndex = Math.max(0, Math.min(179, center + Math.floor((Math.random() - .5) * 8)));
      const bucket = buckets[bucketIndex];
      if (!bucket?.length) continue;
      const [x, y] = bucket[Math.floor(Math.random() * bucket.length)];
      let offsetX = x - 320;
      let offsetY = y - 300;
      const length = Math.max(1, Math.hypot(offsetX, offsetY));
      offsetX /= length;
      offsetY /= length;
      const smoke = Math.random() < .38;
      particles.push({
        x,
        y,
        vx: offsetX * (.18 + Math.random() * .42) + (Math.random() - .5) * .34,
        vy: offsetY * (.1 + Math.random() * .25) - (.18 + Math.random() * .34),
        life: 1,
        decay: smoke ? .01 + Math.random() * .008 : .02 + Math.random() * .018,
        size: smoke ? 7 + Math.random() * 13 : .8 + Math.random() * 2.2,
        smoke,
        purple: Math.random() > .22,
        spin: (Math.random() - .5) * .08,
      });
    }
    if (particles.length > config.maxParticles) particles.splice(0, particles.length - config.maxParticles);
  }

  function updateParticles() {
    pctx.clearRect(0, 0, width, height);
    const remaining = [];
    for (const particle of particles) {
      particle.life -= particle.decay;
      if (particle.life <= 0) continue;
      const wind = valueNoise(particle.x + performance.now() * .02, particle.y, 34) - .5;
      particle.vx += wind * .018;
      particle.vy -= .004;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.size *= particle.smoke ? 1.01 : .996;
      pctx.save();
      pctx.globalCompositeOperation = 'screen';
      if (particle.smoke) {
        pctx.globalAlpha = Math.max(0, particle.life) * .16;
        const gradient = pctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size);
        gradient.addColorStop(0, particle.purple ? 'rgba(124,58,237,.22)' : 'rgba(130,120,145,.10)');
        gradient.addColorStop(.45, particle.purple ? 'rgba(95,55,160,.10)' : 'rgba(90,86,98,.07)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        pctx.fillStyle = gradient;
        pctx.beginPath();
        pctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        pctx.fill();
      } else {
        pctx.globalAlpha = Math.max(0, particle.life) * .72;
        pctx.shadowBlur = 8;
        pctx.shadowColor = 'rgba(124,58,237,.55)';
        pctx.fillStyle = particle.purple ? 'rgba(151,96,255,.80)' : 'rgba(180,175,190,.28)';
        pctx.translate(particle.x, particle.y);
        pctx.rotate(particle.spin * 20);
        pctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * .72);
      }
      pctx.restore();
      remaining.push(particle);
    }
    particles = remaining;
  }

  function revealApp() {
    if (opened) return;
    opened = true;
    document.documentElement.classList.remove('cifro-pwa-splash-pending');
    splash.classList.add('is-opening');
    document.dispatchEvent(new CustomEvent('cifro:pwa-splash', { detail: { state: 'finished' } }));
    setTimeout(() => {
      splash.remove();
      document.documentElement.classList.add('cifro-pwa-splash-complete');
    }, config.appFade + 40);
  }

  function animate(now) {
    if (!animationStart) animationStart = now;
    const raw = clamp((now - animationStart) / config.dissolveDuration);
    const progress = ease(raw);
    renderLogo(progress);
    spawnParticles(progress);
    updateParticles();
    if (raw < 1) {
      requestAnimationFrame(animate);
      return;
    }
    ctx.clearRect(0, 0, width, height);
    setTimeout(() => {
      particles = [];
      pctx.clearRect(0, 0, width, height);
      setTimeout(revealApp, config.blackHold);
    }, 115);
  }

  window.CifroPwaSplash = {
    reveal: revealApp,
    get state() { return { running: !opened, opened }; },
  };

  const safetyTimer = setTimeout(revealApp, 4000);
  image.addEventListener('load', () => {
    try {
      prepare();
      setTimeout(() => {
        animationStart = 0;
        requestAnimationFrame(animate);
      }, config.introDelay);
    } catch (_) {
      clearTimeout(safetyTimer);
      revealApp();
    }
  });
  image.addEventListener('error', () => {
    clearTimeout(safetyTimer);
    revealApp();
  });
  image.src = splash.dataset.logo || '';
})();
