/* Continuous ribbon geometry, with a static SVG fallback and local motion studies. */
(() => {
  const hero = document.querySelector('.hero');
  const toggle = document.querySelector('.motion-toggle');
  const fallback = document.querySelector('.energy-field');
  if (!hero || !toggle || !fallback) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'energy-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  fallback.after(canvas);

  const studies = {
    silk: { name: 'Silk', speed: .42, amplitude: 66, detail: 3, width: 33, pulse: .12 },
    current: { name: 'Current', speed: .78, amplitude: 93, detail: 7, width: 40, pulse: .24 },
    resonance: { name: 'Resonance', speed: 1.05, amplitude: 81, detail: 17, width: 47, pulse: .20 }
  };
  const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const parameters = new URLSearchParams(location.search);
  const requestedStudy = localPreview ? parameters.get('motion') : null;
  let studyKey = Object.hasOwn(studies, requestedStudy) ? requestedStudy : 'resonance';
  let study = studies[studyKey];
  const requestedPace = localPreview ? Number(parameters.get('pace') || 1) : 1;
  let pace = Number.isFinite(requestedPace) ? Math.min(1.8, Math.max(.6, requestedPace)) : 1;
  let time = 0;
  let frame = 0;
  let previous = 0;
  let renderedAt = 0;
  let visible = true;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let scale = 1;
  let amber;
  let violet;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = preference.matches;
  const label = toggle.querySelector('span');
  const icon = toggle.querySelector('path');
  const bands = [
    { phase: .5, direction: -1, offset: 0, color: '#e7bd89' },
    { phase: 2.9, direction: 1, offset: 30, color: '#b7a0eb' }
  ];
  const lineCount = 38;
  const step = 22;
  const samples = [];
  for (let x = -200; x <= 1800; x += step) samples.push(x);

  function running() { return !paused && visible && !document.hidden; }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    renderedAt = 0;
  }

  function start() {
    if (running() && !frame) frame = requestAnimationFrame(tick);
  }

  function yAt(x, strand, band) {
    const travel = time * study.speed * band.direction;
    const phase = x * .0036 + travel + band.phase;
    const center = 590 + band.offset + Math.sin(phase) * study.amplitude
      + Math.sin(x * .0064 - travel * .47 + band.phase) * 22;
    // A moving twist changes the ribbon's width; the finer wave propagates
    // through individual strands instead of shifting a finished picture.
    const spread = study.width * (.68 + .32 * Math.sin(x * .0048 - travel * .7 + band.phase));
    const ripple = Math.sin(x * .0115 + travel * 1.5 + strand * 1.8)
      * study.detail * strand;
    return center + strand * spread + ripple;
  }

  function trace(strand, band, from = -200, to = 1800) {
    ctx.beginPath();
    let first = true;
    for (const x of samples) {
      if (x < from || x > to) continue;
      const y = yAt(x, strand, band);
      if (first) { ctx.moveTo(x, y); first = false; }
      else ctx.lineTo(x, y);
    }
  }

  function draw() {
    if (!width || !height) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale * ratio, 0, 0, scale * ratio,
      (width - 1600 * scale) * ratio / 2, (height - 960 * scale) * ratio / 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'screen';
    bands.forEach((band, bandIndex) => {
      ctx.strokeStyle = bandIndex === 0 ? amber : violet;
      // Broad, faint layers give light a soft edge without full-frame blur.
      for (const [thickness, opacity] of [[70, .018], [36, .027], [16, .034]]) {
        ctx.lineWidth = thickness;
        ctx.globalAlpha = opacity;
        trace(0, band);
        ctx.stroke();
      }
      ctx.lineWidth = .8;
      for (let i = 0; i < lineCount; i++) {
        const strand = i / (lineCount - 1) * 2 - 1;
        ctx.globalAlpha = .10 + .38 * Math.pow(1 - Math.abs(strand), .9);
        trace(strand, band);
        ctx.stroke();
      }
      // Highlight packets travel across the strands, giving a clear direction
      // of flow even at moments when the broad waveform changes slowly.
      const head = ((time * study.speed * 330 * -band.direction + bandIndex * 700) % 2400 + 2400) % 2400 - 400;
      const pulse = ctx.createLinearGradient(head - 260, 0, head + 260, 0);
      pulse.addColorStop(0, 'transparent');
      pulse.addColorStop(.5, band.color);
      pulse.addColorStop(1, 'transparent');
      ctx.strokeStyle = pulse;
      ctx.lineWidth = 1.1;
      for (let i = 3; i < lineCount - 3; i += 3) {
        ctx.globalAlpha = study.pulse;
        trace(i / (lineCount - 1) * 2 - 1, band, head - 260, head + 260);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function tick(now) {
    frame = 0;
    if (!running()) { previous = 0; return; }
    if (previous) time += Math.min((now - previous) / 1000, .05) * pace;
    previous = now;
    const interval = width < 800 ? 1000 / 30 : 1000 / 60;
    if (now - renderedAt >= interval - 1) {
      draw();
      renderedAt = now;
    }
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    // Keep the decorative layer modest on Retina screens and phones.
    ratio = Math.min(window.devicePixelRatio || 1, 1.5,
      Math.sqrt(2200000 / Math.max(width * height, 1)));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    scale = Math.max(width / 1600, height / 960);
    ctx.setTransform(scale * ratio, 0, 0, scale * ratio,
      (width - 1600 * scale) * ratio / 2, (height - 960 * scale) * ratio / 2);
    amber = ctx.createLinearGradient(-200, 0, 1800, 0);
    amber.addColorStop(0, 'transparent');
    amber.addColorStop(.22, '#b87d4b');
    amber.addColorStop(.5, '#edc798');
    amber.addColorStop(.8, '#bd8b60');
    amber.addColorStop(1, 'transparent');
    violet = ctx.createLinearGradient(-200, 0, 1800, 0);
    violet.addColorStop(0, 'transparent');
    violet.addColorStop(.2, '#8a9bdd');
    violet.addColorStop(.5, '#b39be4');
    violet.addColorStop(.8, '#9671bd');
    violet.addColorStop(1, 'transparent');
    draw();
  }

  function updateMotion() {
    hero.classList.toggle('is-paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    label.textContent = paused ? 'Resume motion' : 'Pause motion';
    icon.setAttribute('d', paused ? 'M3 1l8 5-8 5z' : 'M2 1h2v10H2zM8 1h2v10H8z');
    const labPause = document.querySelector('.motion-lab__pause');
    if (labPause) { labPause.textContent = paused ? 'Resume' : 'Pause'; labPause.setAttribute('aria-pressed', String(paused)); }
    if (paused) stop(); else start();
  }

  resize();
  hero.classList.add('canvas-ready');
  toggle.hidden = false;
  updateMotion();
  toggle.addEventListener('click', () => { paused = !paused; updateMotion(); });
  preference.addEventListener('change', () => { paused = preference.matches; updateMotion(); });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (running()) start(); else stop();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => { if (running()) start(); else stop(); });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', start);

  // The experiment controls exist only in the local preview, never on the
  // public landing page. Each choice uses the same renderer and palette.
  if (localPreview) {
    const lab = document.createElement('aside');
    lab.className = 'motion-lab';
    lab.setAttribute('aria-label', 'Wave motion experiment');
    lab.innerHTML = `<div class="motion-lab__heading"><strong>Wave study</strong><button class="motion-lab__pause" type="button" aria-pressed="false">Pause</button></div>
      <div class="motion-lab__options" role="group" aria-label="Motion style">
        <button type="button" data-study="silk" aria-pressed="false">Silk</button>
        <button type="button" data-study="current" aria-pressed="false">Current</button>
        <button type="button" data-study="resonance" aria-pressed="true">Resonance</button>
      </div>
      <label class="motion-lab__pace">Pace <input type="range" min="0.6" max="1.8" step="0.1" value="1" aria-label="Wave pace" /><output>1.0×</output></label>
      <p class="motion-lab__description" aria-live="polite">Traveling crests with light flowing along the ribbons.</p>`;
    const descriptions = {
      silk: 'Long, soft waves. A calmer, continuous flow.',
      current: 'Traveling crests with light flowing along the ribbons.',
      resonance: 'Faster ripples and a more elastic, lively surface.'
    };
    lab.querySelectorAll('[data-study]').forEach(button => {
      button.addEventListener('click', () => {
        studyKey = button.dataset.study;
        study = studies[studyKey];
        lab.querySelectorAll('[data-study]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
        lab.querySelector('.motion-lab__description').textContent = descriptions[button.dataset.study];
        saveStudy();
        // Preserve phase when comparing treatments; don't restart at a posed frame.
        draw();
      });
    });
    lab.querySelector('input').addEventListener('input', event => {
      pace = Number(event.target.value);
      lab.querySelector('output').textContent = `${pace.toFixed(1)}×`;
      saveStudy();
    });
    function saveStudy() {
      const url = new URL(location.href);
      url.searchParams.set('motion', studyKey);
      url.searchParams.set('pace', pace.toFixed(1));
      history.replaceState(null, '', url);
    }
    lab.querySelectorAll('[data-study]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.study === studyKey)));
    lab.querySelector('.motion-lab__description').textContent = descriptions[studyKey];
    lab.querySelector('input').value = pace.toFixed(1);
    lab.querySelector('output').textContent = `${pace.toFixed(1)}×`;
    lab.querySelector('.motion-lab__pause').addEventListener('click', () => { paused = !paused; updateMotion(); });
    document.body.append(lab);
    updateMotion();
  }
})();
