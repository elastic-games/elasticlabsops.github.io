// Kept byte-identical to the landing site's logo-wave-motion.js. No browser
// globals are read until mount, so importing this module during SSR is safe.
export const STATIC_WAVES = [
	'M2 8C9 -2 23 18 30 8',
	'M2 14C9 4 23 24 30 14',
	'M2 20C9 10 23 30 30 20'
];

const poses = [[9, -10, 23, 10], [12, -10, 26, 0], [9, 10, 23, -10], [6, 0, 20, 10]];
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const round = (n) => Math.round(n * 1000) / 1000;

/** Anchored cubic control points; 4.8s flow and 0.3s row stagger. */
export function wavePaths(seconds, { x = 16, y = 14, strength = 0 } = {}) {
	return STATIC_WAVES.map((_, row) => {
		const phase = ((seconds + row * 0.3) % 4.8) / 1.2;
		const index = Math.floor(phase);
		const ease = (1 - Math.cos((phase - index) * Math.PI)) / 2;
		const a = poses[index];
		const b = poses[(index + 1) % 4];
		const points = a.map((n, i) => n + (b[i] - n) * ease);
		const baseline = 8 + row * 6;
		points[1] += baseline;
		points[3] += baseline;
		// Pull each handle toward the local pointer, never the endpoints or tile.
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
		rect: null, dirty: true, inView: true, previous: null, time: 0,
		x: 16, y: 14, strength: 0
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
				item.paths.forEach((path, i) => path.setAttribute('d', STATIC_WAVES[i]));
			}
			if (running(item)) active = true;
			else item.previous = null;
		});
		if (active && !frame) frame = requestAnimationFrame(tick);
		if (!active && frame) { cancelAnimationFrame(frame); frame = 0; }
	};
	function tick(now) {
		frame = 0;
		instances.forEach((item) => {
			if (!running(item)) { item.previous = null; return; }
			const dt = item.previous === null ? 0 : clamp(now - item.previous, 0, 64);
			item.previous = now;
			item.time = (item.time + dt / 1000) % 4.8;
			let strength = 0;
			if (pointer) {
				const r = item.rect;
				const dx = pointer.x - r.left - r.width / 2;
				const dy = pointer.y - r.top - r.height / 2;
				const proximity = clamp(1 - Math.hypot(dx, dy) / 110, 0, 1);
				const speed = pointer.speed * Math.exp(-(now - pointer.at) / 180);
				strength = proximity * proximity * (3 - 2 * proximity) * (0.72 + speed * 0.28);
				const ease = item.strength < 0.001 ? 1 : 1 - Math.exp(-dt / 90);
				const point = item.point(pointer.x, pointer.y);
				item.x += (clamp(point.x, -16, 48) - item.x) * ease;
				item.y += (clamp(point.y, -14, 42) - item.y) * ease;
			}
			item.strength += (strength - item.strength) * (1 - Math.exp(-dt / (strength ? 110 : 240)));
			wavePaths(item.time, item).forEach((d, i) => item.paths[i].setAttribute('d', d));
		});
		refresh();
	}
	listen(window, 'pointermove', (event) => {
		if ((event.pointerType !== 'mouse' && event.pointerType !== 'pen') || event.isPrimary === false) return;
		// Read geometry on input as well: a parent may move without resizing.
		instances.forEach((item) => { item.dirty = true; });
		if (![...instances].some(running)) return;
		const now = performance.now();
		const distance = pointer ? Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) : 0;
		const speed = pointer ? clamp(distance / Math.max(8, now - pointer.at) / 0.6, 0, 1) : 0;
		pointer = { x: event.clientX, y: event.clientY, at: now, speed };
	}, { passive: true });
	listen(window, 'pointerout', (event) => { if (!event.relatedTarget) pointer = null; }, { passive: true });
	listen(window, 'pointercancel', () => { pointer = null; }, { passive: true });
	listen(window, 'pointerdown', (event) => { if (event.pointerType === 'touch') pointer = null; }, { passive: true });
	listen(window, 'blur', () => { pointer = null; });
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
