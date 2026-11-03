import { mountLogoWaves } from './logo-wave-motion.js?v=brand-pointer-1';

const mark = document.querySelector('.brand-wave');
if (mark) mountLogoWaves(mark, { pauseRoot: document.documentElement });
