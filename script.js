document.documentElement.classList.add('has-js');
const navToggle = document.querySelector('.nav__toggle');
const navMenu = document.querySelector('.nav__menu');
const yearElement = document.getElementById('year');

if (yearElement) yearElement.textContent = new Date().getFullYear();

if (navToggle && navMenu) {
  const mobile = window.matchMedia('(max-width: 768px)');
  const setMenu = (expanded, restoreFocus = false) => {
    navToggle.setAttribute('aria-expanded', String(expanded));
    const hidden = mobile.matches && !expanded;
    navMenu.setAttribute('aria-hidden', String(hidden));
    navMenu.inert = hidden;
    if (restoreFocus) navToggle.focus();
  };
  navToggle.addEventListener('click', () => setMenu(navToggle.getAttribute('aria-expanded') !== 'true'));
  navMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') setMenu(false, true);
  });
  document.addEventListener('click', event => {
    if (mobile.matches && !event.target.closest('.nav')) setMenu(false);
  });
  mobile.addEventListener('change', () => setMenu(false));
  setMenu(false);
}
