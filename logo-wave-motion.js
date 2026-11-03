// Kept byte-identical to the landing site's logo-wave-motion.js. No browser
// globals are read until mount, so importing this module during SSR is safe.
export const STATIC_WAVES = [
	'M2 8C9 -2 23 18 30 8',
	'M2 14C9 4 23 24 30 14',
	'M2 20C9 10 23 30 30 20'
];

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const round = (n) => Math.round(n * 1000) / 1000;

/** Still at rest; only pointer input pulls the two handles of each anchored row. */
export function wavePaths({ x = 16, y = 14, strength = 0 } = {}) {
	if (strength <= 0) return [...STATIC_WAVES];
	return STATIC_WAVES.map((_, row) => {
		const baseline = 8 + row * 6;
		const points = [9, baseline - 10, 23, baseline + 10];
		for (let i = 0; i < 4; i += 2) {
			points[i] += clamp((x - points[i]) / 16, -1, 1) * 4 * strength;
			points[i + 1] += clamp((y - points[i + 1]) / 14, -1, 1) * 6 * strength;
		}
		return `M2 ${baseline}C${points.map(round).join(' ')} 30 ${baseline}`;
	});
}

// SVG paint bounds change with d; the fixed viewBox viewport must own input.
function viewBox(svg) {
	const values = (svg.getAttribute('viewBox') || '').trim().split(/[ ,]+/).map(Number);
	return values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0
		? values : [0, 0, 32, 28];
}

function viewportGeometry(mark, root) {
	const [x, y, width, height] = viewBox(mark);
	let matrix;
	try { matrix = mark.getScreenCTM?.(); } catch { /* Fall back when SVG matrix APIs are unavailable. */ }
	if (matrix && [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite)) {
		const { a, b, c, d, e, f } = matrix;
		const determinant = a * d - b * c;
		if (Math.abs(determinant) > 1e-10) {
			const corners = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]];
			const xs = corners.map(([px, py]) => a * px + c * py + e);
			const ys = corners.map(([px, py]) => b * px + d * py + f);
			const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
			return { rect: { left, right, top, bottom, width: right - left, height: bottom - top },
				point: (px, py) => ({
					x: (((d * (px - e) - c * (py - f)) / determinant - x) / width) * 32,
					y: (((a * (py - f) - b * (px - e)) / determinant - y) / height) * 28
				}) };
		}
	}
	// Node doubles and browsers without matrix APIs still use a stable outer box.
	const bounds = root.getBoundingClientRect();
	let rect = bounds;
	if (mark !== root) {
		const [rx, ry, rw, rh] = viewBox(root);
		const scale = Math.min(bounds.width / rw, bounds.height / rh);
		const left = bounds.left + (bounds.width - rw * scale) / 2 + (Number(mark.getAttribute('x')) - rx) * scale;
		const top = bounds.top + (bounds.height - rh * scale) / 2 + (Number(mark.getAttribute('y')) - ry) * scale;
		const w = (Number(mark.getAttribute('width')) || width) * scale;
		const h = (Number(mark.getAttribute('height')) || height) * scale;
		rect = { left, top, width: w, height: h, right: left + w, bottom: top + h };
	}
	return { rect, point: (px, py) => ({ x: (px - rect.left) * 32 / rect.width, y: (py - rect.top) * 28 / rect.height }) };
}

const instances = new Set();
let disconnect = null;
let refreshAll = null;

/**
 * One page-level pointer subscription and RAF for all logos. Only three small
 * path attributes change per visible mark; no React renders or layout writes.
 * @param {SVGSVGElement} mark SVG with a 32x28 viewBox and three paths
 * @param {{ pauseRoot?: HTMLElement }} options Optional shared landing Pause hook
 */
export function mountLogoWaves(mark, { pauseRoot } = {}) {
	let viewport = mark;
	while (viewport.ownerSVGElement) viewport = viewport.ownerSVGElement;
	const item = {
		mark, viewport, pauseRoot, paths: Array.from(mark.querySelectorAll('path')),
		rect: null, dirty: true, inView: true, previous: null, remaining: 0, input: 0,
		x: 16, y: 14, targetX: 16, targetY: 14, strength: 0
	};
	instances.add(item);
	if (!disconnect) disconnect = connect();
	// A resize can occur without a window resize (folded navigation, for example).
	const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
		item.dirty = true;
		refreshAll();
	});
	const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
		item.inView = entry.isIntersecting;
		item.dirty = true;
		refreshAll();
	});
	const pause = pauseRoot ? new MutationObserver(() => refreshAll(true)) : null;
	resize?.observe(viewport);
	intersection?.observe(viewport);
	pause?.observe(pauseRoot, { attributes: true, attributeFilter: ['data-motion-paused'] });
	refreshAll();
	return () => {
		resize?.disconnect();
		intersection?.disconnect();
		pause?.disconnect();
		instances.delete(item);
		item.paths.forEach((path, i) => path.setAttribute('d', STATIC_WAVES[i]));
		if (!instances.size) { disconnect(); disconnect = null; }
		else refreshAll();
	};
}

function connect() {
	const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
	let frame = 0;
	let pointer = null;
	let pageActive = true;
	const removers = [];
	const listen = (target, type, handler, options) => {
		target.addEventListener(type, handler, options);
		removers.push(() => target.removeEventListener(type, handler, options));
	};
	const measure = (item) => {
		if (!item.dirty) return;
		const geometry = viewportGeometry(item.mark, item.viewport);
		item.rect = geometry.rect;
		item.point = geometry.point;
		item.dirty = false;
	};
	const running = (item) => {
		measure(item);
		const r = item.rect;
		return !preference.matches && pageActive && !document.hidden && item.inView &&
			r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
			r.top < window.innerHeight && r.left < window.innerWidth &&
			(!item.pauseRoot || item.pauseRoot.dataset.motionPaused === 'false');
	};
	const refresh = (clearPointer = false) => {
		if (clearPointer) pointer = null;
		let active = false;
		instances.forEach((item) => {
			if (preference.matches) {
				item.strength = 0;
				item.remaining = 0;
				item.paths.forEach((path, i) => path.setAttribute('d', STATIC_WAVES[i]));
			}
			if (running(item) && (item.remaining > 0 || item.strength > 0)) active = true;
			else item.previous = null;
		});
		if (active && !frame) frame = requestAnimationFrame(tick);
		if (!active && frame) { cancelAnimationFrame(frame); frame = 0; }
	};
	function tick(now) {
		frame = 0;
		instances.forEach((item) => {
			if (!running(item) || (!item.remaining && !item.strength)) { item.previous = null; return; }
			const dt = item.previous === null ? 0 : Math.max(0, now - item.previous);
			item.previous = now;
			// A finite 260ms input memory: a stationary pointer never sustains a bend.
			item.remaining = Math.max(0, item.remaining - dt);
			const target = item.input * item.remaining / 260;
			item.strength += (target - item.strength) * (1 - Math.exp(-dt / (target > item.strength ? 45 : 120)));
			const ease = 1 - Math.exp(-dt / 70);
			item.x += (item.targetX - item.x) * ease;
			item.y += (item.targetY - item.y) * ease;
			if (!item.remaining && item.strength < 0.0015) {
				item.strength = 0;
				item.previous = null;
			}
			wavePaths(item).forEach((d, i) => item.paths[i].setAttribute('d', d));
		});
		refresh();
	}
	listen(window, 'pointermove', (event) => {
		if ((event.pointerType !== 'mouse' && event.pointerType !== 'pen') || event.isPrimary === false) return;
		// Read fixed viewport geometry on input: a parent can move without resizing.
		instances.forEach((item) => { item.dirty = true; });
		if (![...instances].some(running)) { pointer = null; return; }
		const now = performance.now();
		const distance = pointer ? Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) : 0;
		if (pointer && distance < 0.05) return;
		const speed = pointer ? clamp(distance / Math.max(8, now - pointer.at) / 0.6, 0, 1) : 0.5;
		pointer = { x: event.clientX, y: event.clientY, at: now };
		instances.forEach((item) => {
			if (!running(item)) return;
			const r = item.rect;
			const proximity = clamp(1 - Math.hypot(pointer.x - r.left - r.width / 2, pointer.y - r.top - r.height / 2) / 110, 0, 1);
			if (!proximity) { item.remaining = 0; return; }
			const point = item.point(pointer.x, pointer.y);
			item.targetX = clamp(point.x, -16, 48);
			item.targetY = clamp(point.y, -14, 42);
			if (!item.strength) { item.x = item.targetX; item.y = item.targetY; }
			item.input = proximity * proximity * (3 - 2 * proximity) * (0.65 + speed * 0.35);
			item.remaining = 260;
			if (item.previous === null) item.previous = now;
		});
		refresh();
	}, { passive: true });
	const leave = () => {
		pointer = null;
		instances.forEach((item) => { if (running(item)) item.remaining = 0; });
		refresh();
	};
	listen(window, 'pointerout', (event) => { if (!event.relatedTarget) leave(); }, { passive: true });
	listen(window, 'pointercancel', leave, { passive: true });
	listen(window, 'pointerdown', (event) => { if (event.pointerType === 'touch') leave(); }, { passive: true });
	listen(window, 'blur', leave);
	const geometry = () => {
		instances.forEach((item) => { item.dirty = true; });
		refresh(true);
	};
	listen(window, 'resize', geometry, { passive: true });
	listen(window, 'scroll', geometry, { passive: true, capture: true });
	listen(document, 'visibilitychange', () => refresh(true));
	listen(window, 'pagehide', () => { pageActive = false; refresh(true); });
	listen(window, 'pageshow', () => { pageActive = true; geometry(); });
	listen(preference, 'change', () => refresh(true));
	refreshAll = refresh;
	refresh();
	return () => {
		cancelAnimationFrame(frame);
		removers.forEach((remove) => remove());
	};
}
