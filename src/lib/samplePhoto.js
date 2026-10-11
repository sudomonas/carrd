// A procedural "photograph" (harbour at dawn) used by the landing page so its
// sample cards need no external image. Deterministic: same pixels every time.
import { lumaGrid } from '../render/images.js';

export function createSamplePhoto(width = 1200, height = 900) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');

  const sky = g.createLinearGradient(0, 0, 0, height * 0.62);
  sky.addColorStop(0, '#2B3A55');
  sky.addColorStop(0.55, '#C9826B');
  sky.addColorStop(1, '#F2C892');
  g.fillStyle = sky;
  g.fillRect(0, 0, width, height);

  const sun = g.createRadialGradient(width * 0.62, height * 0.56, 0, width * 0.62, height * 0.56, height * 0.42);
  sun.addColorStop(0, 'rgba(255, 236, 196, 0.95)');
  sun.addColorStop(0.18, 'rgba(255, 214, 160, 0.55)');
  sun.addColorStop(1, 'rgba(255, 214, 160, 0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, width, height);

  // Distant hills.
  const hill = (y, amp, color, seed) => {
    g.beginPath();
    g.moveTo(0, height);
    for (let x = 0; x <= width; x += 8) {
      g.lineTo(x, y + Math.sin(x / (140 + seed * 30) + seed) * amp + Math.sin(x / 53 + seed * 2) * amp * 0.3);
    }
    g.lineTo(width, height);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  };
  hill(height * 0.55, 18, '#6E5A66', 1);
  hill(height * 0.6, 12, '#4A4256', 2);

  // Water with reflections.
  const water = g.createLinearGradient(0, height * 0.62, 0, height);
  water.addColorStop(0, '#5D5A6E');
  water.addColorStop(1, '#1D2333');
  g.fillStyle = water;
  g.fillRect(0, height * 0.62, width, height * 0.38);
  for (let i = 0; i < 70; i++) {
    const y = height * 0.63 + (i / 70) ** 1.6 * height * 0.36;
    const w = (1 - i / 70) * width * 0.22 + 10;
    g.fillStyle = `rgba(255, 220, 170, ${0.5 * (1 - i / 70)})`;
    g.fillRect(width * 0.62 - w / 2 + Math.sin(i * 1.7) * 14, y, w, 2 + i / 30);
  }
  return { element: c, stats: { width, height, luma: lumaGrid(c) } };
}
