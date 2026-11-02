# Elastic Labs public website

Static GitHub Pages website at https://elasticlabs.com. Production serves `main`
from the repository root. The Studio application at app.elasticlabs.com is a
separate OVH deployment.

## Preview

Run `python3 -m http.server 8767 --bind 127.0.0.1` from this directory and open
http://127.0.0.1:8767. No package installation or build step is required.

## Landing page background and provenance

`energy.js` adapts the actual public WebGL2 ribbon script captured from
https://shapefab.app on November 2, 2026, rather than approximating its appearance
with 2D waves. The captured evidence is `shapefab-ribbons.js` (6,999 bytes) and
`shapefab-style.css` in the operator's `elastic-landing-shapefab-20261102` output
folder. Captured script SHA-256:
`8715683cca9f1c2f3274ac709b8d439b087ad32b08880e91589a7d1de020e5f7`.
The shader comments credit XorDev's turbulence. No reusable library or
license grant was established from these captured files; this provenance note is
not a claim that ShapeFab's site source is open source or licensed for reuse.

The self-hosted renderer retains the reference shader's turbulence, five-strand
inverse-distance glow, glints, haze, vignette, dither and two distant ribbons.
It uses the same RGB vectors: orange `(1.0, 0.45, 0.12)`, violet
`(0.45, 0.22, 1.0)` and blue `(0.12, 0.5, 1.0)`. Time starts at 40 seconds;
near/far turbulence runs at `t * 0.12` / `t * 0.05`. Pointer smoothing is `0.3`,
speed intensity is capped at `hypot(delta) / 60`, attack/decay are `0.5` / `0.06`,
and the shader preserves the reference soft eddy and `0.03` depth parallax.
Canvas resolution is `min(devicePixelRatio, 2) * 0.5 * quality`; after more than
40 slow frames (over 24 ms, under 100 ms), quality drops by 0.25 to a floor of 0.5.
The canvas covers 100% of the hero at every viewport, with the reference mask
fading from 60% to 100% of its height. No runtime asset is loaded from ShapeFab.

Elastic-specific adaptations:

- The quiet zone follows Elastic's centered copy in both axes, instead of the
  reference's left-aligned desktop copy. It dims light to 0.35 inside the copy
  bounds, easing to full intensity outside them; geometry and colors are unchanged.
- The existing pause/resume control stops both the animation clock and pointer
  updates. Reduced motion starts with a still at `t = 40`; explicit resume enables
  motion. Resizing refreshes a still without advancing time or pointer state.
- Offscreen, hidden-tab and pagehide states stop animation. Returning resumes the
  retained clock. Context loss shows the original static SVG; restoration rebuilds
  GPU resources and respects the current pause state. No WebGL2 or JavaScript
  leaves the SVG and all content available. The fallback remains a different,
  approximate still, not the exact shader image.
- The obsolete local motion-study controls and URL parameters have been removed.
  `landing.css` is homepage-only; `styles.css` still styles the game detail page.
- Page copy, navigation, concept-art disclosure, private-demo status, project
  links and `inbox@elasticlabs.com` contact links are preserved.

Bump the landing stylesheet/script version tags in `index.html` when changing motion
or styling, so browsers request a matching pair of assets.

Before publishing, inspect desktop and mobile layouts, project/detail and contact
links, mobile-menu keyboard behavior, pointer response, pause/resume, reduced motion,
visibility/page lifecycle, and WebGL fallback/context restoration. Run
`node --check script.js`, `node --check energy.js` and `git diff --check`.
