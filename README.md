# Elastic Labs public website

Static GitHub Pages website at https://elasticlabs.com. Production serves `main`
from the repository root. The Studio application at app.elasticlabs.com is a
separate OVH deployment.

## Preview

Run `python3 -m http.server 8767 --bind 127.0.0.1` from this directory and open
http://127.0.0.1:8767. No package installation or build step is required.

## Landing page visual direction

The landing page uses warm charcoal, cream text, amber and violet light ribbons,
subtle grain, and translucent controls. ShapeFab (https://shapefab.app) was the
user-supplied mood reference; all ribbon geometry, styles and motion here are
original code. No ShapeFab assets or source were copied.

- `landing.css` is loaded only by the homepage; `styles.css` continues to style
  the Giant & Ghosts detail page.
- `energy.js` handles the pause control, small pointer displacement, reduced
  motion and offscreen suspension. There is no continuous JavaScript render loop.
- Reduced-motion visitors get a still composition, with an explicit resume option.
- Navigation and content remain usable without JavaScript. The shared menu script
  supports keyboard dismissal and keeps closed mobile links out of the focus order.
- Keep the concept-art disclosure, private-demo status and actual contact email.
  The .site mailbox name is intentional and is separate from the public .com domain.

Before publishing, inspect desktop and mobile layouts, the project/detail links,
contact links, the mobile menu, pause/resume and reduced motion. `node --check
script.js` and `node --check energy.js` check the small JavaScript files.
