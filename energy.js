/* Decorative light has no effect on navigation or page content. */
(() => {
  const hero = document.querySelector('.hero');
  const toggle = document.querySelector('.motion-toggle');
  if (!hero || !toggle) return;

  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = preference.matches;
  let manualChoice = false;
  let pointerFrame = 0;
  const label = toggle.querySelector('span');
  const icon = toggle.querySelector('path');

  function updateMotion() {
    hero.classList.toggle('is-paused', paused);
    hero.classList.toggle('motion-enabled', manualChoice && !paused);
    toggle.setAttribute('aria-pressed', String(paused));
    label.textContent = paused ? 'Resume motion' : 'Pause motion';
    icon.setAttribute('d', paused ? 'M3 1l8 5-8 5z' : 'M2 1h2v10H2zM8 1h2v10H8z');
    if (paused) {
      cancelAnimationFrame(pointerFrame);
      hero.style.removeProperty('--energy-x');
      hero.style.removeProperty('--energy-y');
    }
  }
  hero.classList.add('motion-ready');
  toggle.hidden = false;
  updateMotion();
  toggle.addEventListener('click', () => {
    manualChoice = true;
    paused = !paused;
    updateMotion();
  });
  preference.addEventListener('change', () => {
    manualChoice = false;
    paused = preference.matches;
    updateMotion();
  });

  // Small elastic displacement; no continuous JavaScript animation loop.
  hero.addEventListener('pointermove', (event) => {
    if (paused || preference.matches || event.pointerType !== 'mouse') return;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      if (paused || preference.matches) return;
      const bounds = hero.getBoundingClientRect();
      hero.style.setProperty('--energy-x', `${((event.clientX - bounds.left) / bounds.width - .5) * 14}px`);
      hero.style.setProperty('--energy-y', `${((event.clientY - bounds.top) / bounds.height - .5) * 10}px`);
    });
  });
  hero.addEventListener('pointerleave', () => {
    cancelAnimationFrame(pointerFrame);
    hero.style.removeProperty('--energy-x');
    hero.style.removeProperty('--energy-y');
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      hero.classList.toggle('is-offscreen', !entry.isIntersecting);
    });
    observer.observe(hero);
  }
  document.addEventListener('visibilitychange', () => {
    hero.classList.toggle('is-offscreen', document.hidden || hero.getBoundingClientRect().bottom < 0);
  });
})();
