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
- `energy.js` draws changing ribbon geometry and traveling highlights on a transparent
  canvas. Drawing is capped at 60 fps on desktop and 30 fps on smaller canvases,
  with a 2.2-million-pixel budget. Pausing, leaving the hero or hiding the tab stops
  the animation clock. The original SVG remains the still no-script fallback.
- The local preview includes Silk, Current and Resonance treatments plus a pace
  slider. Resonance at 1.0× is the selected default. Choices are reflected in
  `?motion=resonance&pace=1.0` for comparison and
  survive reloads. These controls are never created on the public hostname.
- Reduced-motion visitors get a still composition, with an explicit resume option.
- Navigation and content remain usable without JavaScript. The shared menu script
  supports keyboard dismissal and keeps closed mobile links out of the focus order.
- Keep the concept-art disclosure, private-demo status and actual contact email.
  The .site mailbox name is intentional and is separate from the public .com domain.

Before publishing, inspect desktop and mobile layouts, the project/detail links,
contact links, the mobile menu, pause/resume and reduced motion. `node --check
script.js` and `node --check energy.js` check the small JavaScript files.
