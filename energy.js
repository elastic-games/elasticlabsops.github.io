/* WebGL2 ribbons adapted from the public ShapeFab reference captured 2026-11-02.
   Shader flow, palette and real pointer response retain the reference mathematics.
   See README.md for provenance, bounded simulated companions and lifecycle. */
(() => {
  const hero = document.querySelector('.hero');
  const toggle = document.querySelector('.motion-toggle');
  const fallback = document.querySelector('.energy-field');
  const copy = document.querySelector('.hero__content');
  if (!hero || !toggle || !fallback || !copy) return;

  const vertexSource = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
  const fragmentSource = `#version 300 es
precision highp float;
uniform vec2 res;    // canvas size, CSS px
uniform float scale; // device px per CSS px
uniform float t;     // seconds
uniform vec4 copyBounds; // centered copy bounds, normalized CSS coordinates
uniform vec3 mouse;  // the cursor, CSS px in the canvas (far away when there is none), and how much it is stirring, 0..1
uniform vec3 companions[3]; // simulated cursors, in the same CSS coordinates
uniform int companionCount;
out vec4 o;

const vec3 BG = vec3(0.051, 0.047, 0.043);
// the brand's orange, the agent smoke's violet and its blue
const vec3 ORANGE = vec3(1.0, 0.45, 0.12);
const vec3 VIOLET = vec3(0.45, 0.22, 1.0);
const vec3 BLUE = vec3(0.12, 0.5, 1.0);

// XorDev's turbulence: each wave runs along a turned axis and pushes across it, finer and weaker each time
// n waves: the near ribbons need the fine ones, the far soft ones only the broad
vec2 turbulence(vec2 p, float t, float n) {
  float freq = 1.6;
  mat2 rot = mat2(0.6, -0.8, 0.8, 0.6);
  for (float i = 0.0; i < n; i++) {
    float phase = freq * (p * rot).y + t + i;
    p += 0.5 * rot[0] * sin(phase) / freq;
    rot *= mat2(0.6, -0.8, 0.8, 0.6);
    freq *= 1.45;
  }
  return p;
}

// a ribbon's glow at distance d: 1/d, held finite at the core
float glow(float d, float core) { return core / (abs(d) + core); }

// a ribbon as a bundle of five fine strands, like silk: they gather and fan out along its length, so it catches
// the light in threads rather than as one tube. d: the distance from its middle; u: along it; seed: its own phase
float strands(float d, float u, float seed) {
  float spread = 0.006 + 0.014 * (0.5 + 0.5 * sin(u * 1.7 + t * 0.11 + seed));
  float s = 0.0;
  for (float k = -2.0; k <= 2.0; k++) {
    float off = k * spread * (1.0 + 0.35 * sin(u * 3.1 + k * 1.9 + seed));
    s += glow(d - off, 0.0022) * (1.0 - 0.18 * abs(k));
  }
  return s * 0.42;
}

// interleaved gradient noise: a dither under a 255th, so the dark gradients never band
float ign(vec2 f) { return fract(52.9829189 * fract(dot(f, vec2(0.06711056, 0.00583715)))); }

void main() {
  vec2 px = vec2(gl_FragCoord.x, res.y * scale - gl_FragCoord.y) / scale;
  // the hero in units of its height, from its left middle
  vec2 p0 = (px - vec2(0.0, res.y * 0.5)) / res.y;
  vec2 m = (mouse.xy - vec2(0.0, res.y * 0.5)) / res.y;
  // the cursor stirs the light: a soft eddy that follows it, turning harder while it moves, and settling when it stops
  vec2 dm = p0 - m;
  float near = exp(-dot(dm, dm) / 0.012);
  float turn = (0.5 + 2.2 * mouse.z) * near;
  vec2 p = m + mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * dm;
  // Pool teammates' local eddies before applying them, so overlapping cursors
  // cannot repeatedly rotate the whole field or wash out the silk strands.
  vec2 warp = vec2(0.0);
  vec2 depth = vec2(0.0);
  float companionGlow = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= companionCount) break;
    vec2 cm = (companions[i].xy - vec2(0.0, res.y * 0.5)) / res.y;
    vec2 cd = p0 - cm;
    float cn = exp(-dot(cd, cd) / 0.012);
    float ct = (0.5 + 2.2 * companions[i].z) * cn * 0.75;
    warp += (mat2(cos(ct), sin(ct), -sin(ct), cos(ct)) * cd - cd);
    companionGlow += (0.5 + 1.6 * companions[i].z) * cn * 0.65;
    depth += (cm - vec2(0.9, 0.0)) * exp(-dot(cd, cd) / 0.04) * 0.03;
  }
  p += warp * min(1.0, 0.10 / max(length(warp), 0.00001));
  vec2 q = turbulence(p * vec2(1.0, 1.3), t * 0.12, 7.0);
  // three ribbons crossing left to right at different heights, each swaying on its own
  float a = q.y + 0.18 + 0.10 * sin(q.x * 1.1 + t * 0.07);
  float b = q.y - 0.02 + 0.12 * sin(q.x * 0.8 - t * 0.05 + 2.0);
  float c = q.y - 0.24 + 0.09 * sin(q.x * 1.4 + t * 0.06 + 4.0);
  // each ribbon brighter in long slow stretches along its length
  float sa = 0.55 + 0.45 * sin(q.x * 0.9 - t * 0.21);
  float sb = 0.55 + 0.45 * sin(q.x * 0.7 - t * 0.17 + 1.3);
  float sc = 0.55 + 0.45 * sin(q.x * 1.1 - t * 0.19 + 2.6);
  vec3 light = ORANGE * strands(a, q.x, 0.0) * sa + VIOLET * strands(b, q.x, 2.1) * sb * 1.35 + BLUE * strands(c, q.x, 4.2) * sc * 1.3;
  // glints that run along each ribbon, as light catching silk
  light *= 1.0 + 0.9 * (pow(0.5 + 0.5 * sin(q.x * 5.0 - t * 0.9), 12.0) + pow(0.5 + 0.5 * sin(q.x * 4.0 + t * 0.7 + 2.0), 12.0));
  // and lights them where it passes
  light *= 1.0 + (0.5 + 1.6 * mouse.z) * near + min(companionGlow, 1.2);
  // the haze they leave: the same falloff, much wider, each in its own colour
  light += (ORANGE * glow(a, 0.10) * sa + VIOLET * glow(b, 0.14) * sb + BLUE * glow(c, 0.10) * sc) * 0.28;
  // far behind: two wide soft ribbons, slower, drifting a little against the cursor, for depth
  vec2 pf = p0 * 0.7 - (mouse.x > -1e3 ? m - vec2(0.9, 0.0) : vec2(0.0)) * 0.03;
  pf -= depth * min(1.0, 0.03 / max(length(depth), 0.00001));
  vec2 r = turbulence(pf * vec2(1.0, 1.4) + vec2(3.7, 1.3), t * 0.05, 4.0);
  float fa = r.y + 0.10 + 0.14 * sin(r.x * 0.6 + t * 0.03);
  float fb = r.y - 0.22 + 0.12 * sin(r.x * 0.9 - t * 0.04 + 1.0);
  light += (VIOLET * glow(fa, 0.035) + ORANGE * glow(fb, 0.03)) * 0.16;
  // quiet behind the text
  // Elastic's copy is centered rather than left aligned. Only the quiet zone changes.
  vec2 fromCopy = max(copyBounds.xy - px / res, px / res - copyBounds.zw);
  float dim = mix(0.35, 1.0, smoothstep(-0.02, 0.12, max(fromCopy.x, fromCopy.y)));
  vec3 col = BG + tanh(light * 1.1 * dim);
  // a slight vignette at the top corners, and the dither
  col *= 1.0 - 0.18 * smoothstep(0.4, 1.2, length((px / res - vec2(0.5, 0.35)) * vec2(1.0, 1.4)));
  col += (ign(gl_FragCoord.xy + fract(t * 7.0) * 64.0) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

  const canvas = document.createElement('canvas');
  canvas.className = 'energy-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  fallback.after(canvas);
  let gl;
  try {
    gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, powerPreference: 'low-power'
    });
  } catch {
    canvas.remove();
    return;
  }
  if (!gl) { canvas.remove(); return; }

  // Only exact integers are accepted; clamp to the three available teammates.
  const requested = new URLSearchParams(window.location.search).get('companions');
  const companionCount = requested !== null && /^-?\d+$/.test(requested)
    ? Math.max(0, Math.min(3, Number(requested))) : 3;
  const companionData = new Float32Array(9);
  const overlay = companionCount ? document.createElement('div') : null;
  if (overlay) {
    overlay.className = 'energy-companions';
    overlay.setAttribute('aria-hidden', 'true');
    canvas.after(overlay);
  }
  // Closed, independently phased routes. Quintic easing gives soft arrivals and
  // departures; each leg has its own travel time, bend and short stationary dwell.
  const routes = [
    [[.09, .26], [.24, .64], [.49, .25], [.83, .48], [.91, .16], [.73, .81], [.38, .76]],
    [[.87, .34], [.68, .68], [.39, .83], [.12, .42], [.21, .18], [.52, .39], [.81, .75]],
    [[.47, .55], [.77, .21], [.90, .63], [.61, .84], [.31, .36], [.08, .65], [.27, .79]]
  ];
  const teammates = [];
  for (let i = 0; i < companionCount; i++) {
    const element = document.createElement('div');
    element.className = `energy-companion energy-companion--${i}`;
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 16 20');
    arrow.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0 0L1 16L5.5 12L9 19L12 17.5L8.5 10.5L15 10Z');
    arrow.append(path);
    const tag = document.createElement('span');
    tag.textContent = `P${i + 2}`;
    element.append(arrow, tag);
    overlay.append(element);
    let duration = 0;
    const route = routes[i].map((point, j) => {
      const travel = 3.4 + ((j * 7 + i * 11) % 9) * 0.39;
      const dwell = 0.3 + ((j * 3 + i * 2) % 5) * 0.19;
      duration += travel + dwell;
      return { x: point[0], y: point[1], travel, dwell, bend: Math.sin(j * 2.3 + i) * 0.055 };
    });
    teammates.push({ element, route, duration, phase: 1.8 - i * 0.5,
      position: new Float64Array(2), before: new Float64Array(2), x: -1, y: -1 });
  }

  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const label = toggle.querySelector('span');
  const icon = toggle.querySelector('path');
  let paused = preference.matches;
  let visible = true;
  let pageActive = true;
  let ready = false;
  let failed = false;
  let frame = 0;
  let previous = 0;
  let renderedAt = 0;
  let time = 40;
  let quality = 1;
  let slowFrames = 0;
  let width = 0;
  let height = 0;
  let scale = 1;
  let copyBounds = [0, 0, 1, 1];
  let pageLeft = 0;
  let pageTop = 0;
  let routeLeft = 0;
  let routeRight = 0;
  let routeFloor = 0;
  let routeBottom = 0;
  let targetX = -1e4;
  let targetY = -1e4;
  let mouseX = -1e4;
  let mouseY = -1e4;
  let intensity = 0;
  let program;
  let buffer;
  let uniforms;

  function running() {
    return ready && !paused && visible && pageActive && !document.hidden;
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    renderedAt = 0;
  }

  function start() {
    if (running() && !frame) frame = requestAnimationFrame(tick);
  }

  function showFallback(permanent = false) {
    ready = false;
    stop();
    hero.classList.remove('canvas-ready');
    toggle.hidden = true;
    if (permanent) {
      failed = true;
      if (overlay) overlay.remove();
      canvas.remove();
    }
  }

  function updateMotion() {
    hero.classList.toggle('is-paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    label.textContent = paused ? 'Resume motion' : 'Pause motion';
    icon.setAttribute('d', paused ? 'M3 1l8 5-8 5z' : 'M2 1h2v10H2zM8 1h2v10H8z');
    if (running()) start(); else stop();
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(error || 'Ribbon shader compilation failed');
    }
    return shader;
  }

  function initialize() {
    if (failed) return;
    const shaders = [];
    program = null;
    buffer = null;
    try {
      program = gl.createProgram();
      shaders.push(compile(gl.VERTEX_SHADER, vertexSource));
      shaders.push(compile(gl.FRAGMENT_SHADER, fragmentSource));
      shaders.forEach(shader => gl.attachShader(program, shader));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'Ribbon shader linking failed');
      }
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'p');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      uniforms = Object.fromEntries(['res', 'scale', 't', 'copyBounds', 'mouse', 'companions[0]', 'companionCount']
        .map(name => [name, gl.getUniformLocation(program, name)]));
      ready = true;
      resize();
      hero.classList.add('canvas-ready');
      toggle.hidden = false;
      updateMotion();
    } catch (error) {
      console.warn('Hero ribbons:', error);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      showFallback(true);
    } finally {
      shaders.forEach(shader => gl.deleteShader(shader));
    }
  }

  function resize() {
    if (!ready) return;
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    if (!width || !height) return;
    pageLeft = bounds.left + window.scrollX;
    pageTop = bounds.top + window.scrollY;
    scale = Math.min(devicePixelRatio || 1, 2) * 0.5 * quality;
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    const text = copy.getBoundingClientRect();
    copyBounds = [(text.left - bounds.left) / width, (text.top - bounds.top) / height,
      (text.right - bounds.left) / width, (text.bottom - bounds.top) / height];
    // Measure only on resize, never in the animation loop. Use the actual child
    // widths, since the centered content container itself spans almost the hero.
    routeLeft = width;
    routeRight = 0;
    for (const child of copy.children) {
      const box = child.getBoundingClientRect();
      routeLeft = Math.min(routeLeft, box.left - bounds.left);
      routeRight = Math.max(routeRight, box.right - bounds.left);
    }
    routeBottom = height * 0.81;
    routeFloor = Math.min(routeBottom - 18, text.bottom - bounds.top + 30);
    // A resize may refresh a still, but never advances its time or pointer state.
    draw(false);
  }

  function smoothstep(a, b, value) {
    const u = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return u * u * (3 - 2 * u);
  }

  function routePosition(teammate, elapsed, out) {
    let local = ((elapsed + teammate.phase) % teammate.duration + teammate.duration) % teammate.duration;
    const route = teammate.route;
    for (let j = 0; j < route.length; j++) {
      const from = route[j];
      if (local > from.travel + from.dwell) {
        local -= from.travel + from.dwell;
        continue;
      }
      const to = route[(j + 1) % route.length];
      const u = Math.min(1, local / from.travel);
      const ease = u * u * u * (u * (u * 6 - 15) + 10);
      const bend = Math.sin(Math.PI * ease) ** 2 * from.bend;
      const nx = from.x + (to.x - from.x) * ease - (to.y - from.y) * bend;
      const ny = from.y + (to.y - from.y) * ease + (to.x - from.x) * bend;
      const x = 24 + nx * Math.max(0, width - 80);
      // Routes dip below copy/buttons; at the outer sides they can rise into the
      // ribbons. Mobile's narrow side gutters naturally keep all three below copy.
      const underCopy = smoothstep(routeLeft - 70, routeLeft - 20, x)
        * (1 - smoothstep(routeRight + 20, routeRight + 70, x));
      const top = Math.min(routeFloor, height * 0.30) * (1 - underCopy) + routeFloor * underCopy;
      out[0] = x;
      out[1] = top + ny * (routeBottom - top);
      return;
    }
  }

  function updateCompanions() {
    for (let i = 0; i < teammates.length; i++) {
      const teammate = teammates[i];
      routePosition(teammate, time - 40, teammate.position);
      routePosition(teammate, time - 40 - 0.05, teammate.before);
      const x = teammate.position[0];
      const y = teammate.position[1];
      // Speed comes from the shared clock's path, including deceleration/dwells,
      // rather than wall time or frame count; a still/resize is deterministic.
      const speed = Math.hypot(x - teammate.before[0], y - teammate.before[1]) / 0.05;
      companionData[i * 3] = x;
      companionData[i * 3 + 1] = y;
      companionData[i * 3 + 2] = Math.min(0.65, speed / 180);
      if (x !== teammate.x || y !== teammate.y) {
        teammate.element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        teammate.x = x;
        teammate.y = y;
      }
    }
  }

  function draw(advancePointer) {
    if (!ready || !width || !height) return;
    if (advancePointer) {
      const dx = (targetX - mouseX) * 0.3;
      const dy = (targetY - mouseY) * 0.3;
      mouseX += dx;
      mouseY += dy;
      const speed = Math.min(1, Math.hypot(dx, dy) / 60);
      intensity += (speed - intensity) * (speed > intensity ? 0.5 : 0.06);
    }
    gl.uniform2f(uniforms.res, width, height);
    gl.uniform1f(uniforms.scale, scale);
    gl.uniform1f(uniforms.t, time);
    gl.uniform4fv(uniforms.copyBounds, copyBounds);
    gl.uniform3f(uniforms.mouse, mouseX, mouseY, intensity);
    updateCompanions();
    gl.uniform3fv(uniforms['companions[0]'], companionData);
    gl.uniform1i(uniforms.companionCount, companionCount);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(now) {
    frame = 0;
    if (!running()) { previous = 0; return; }
    const delta = previous ? now - previous : 0;
    previous = now;
    time += delta / 1000;
    if (delta > 0 && delta < 100) {
      slowFrames = delta > 24 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    }
    if (slowFrames > 40 && quality > 0.5) {
      quality -= 0.25;
      slowFrames = 0;
      resize();
    }
    if (now - renderedAt >= 1000 / 61) {
      renderedAt = now;
      draw(true);
    }
    frame = requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', event => {
    if (!running()) return;
    targetX = event.clientX + window.scrollX - pageLeft;
    targetY = event.clientY + window.scrollY - pageTop;
    if (mouseX < -1e3) { mouseX = targetX; mouseY = targetY; }
  }, { passive: true });
  toggle.addEventListener('click', () => { paused = !paused; updateMotion(); });
  preference.addEventListener('change', () => { paused = preference.matches; updateMotion(); });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    observer.observe(copy);
  } else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (running()) start(); else stop();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => {
    if (running()) start(); else stop();
  });
  window.addEventListener('pagehide', () => { pageActive = false; stop(); });
  window.addEventListener('pageshow', () => { pageActive = true; start(); });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showFallback();
  });
  canvas.addEventListener('webglcontextrestored', initialize);
  initialize();
})();
