// Generates the bundled background textures in src/assets/textures/.
// Run once with `node scripts/make-textures.mjs` (npm run textures); the
// output is committed, so the app never generates textures at runtime.
//
// Every tile is a tileable, deterministic (seeded PRNG) alpha mask that the
// renderer tints with a palette role, so texture always matches the palette
// and stays visible on light, dark and saturated canvases alike.
//  - grain tiles (paper, linen, grain): a noise field; alpha = |deviation| × gain;
//  - pattern tiles (dots, grid, lines): anti-aliased geometry.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const outDir = new URL('../src/assets/textures/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const prng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

// ---- PNG encoding (greyscale, or greyscale + alpha) ------------------------
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

/** channels: 1 = grey, 2 = grey + alpha. `pixels` holds `channels` bytes per pixel. */
function writePng(name, w, h, channels, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 1 ? 0 : 4;
  const stride = w * channels;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) Buffer.from(pixels.subarray(y * stride, (y + 1) * stride)).copy(raw, y * (stride + 1) + 1);
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(new URL(name, outDir), png);
  console.log(`wrote ${name} (${png.length} bytes)`);
}

function blurWrap(src, N, passes = 1) {
  let a = src;
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += a[((y + dy + N) % N) * N + ((x + dx + N) % N)];
        b[y * N + x] = s / 9;
      }
    }
    a = b;
  }
  return a;
}

// ---- grain tiles --------------------------------------------------------------

/** Writes a noise field (deviations around 0) as an alpha mask. */
function writeGrainMask(name, N, field, gain) {
  const out = new Uint8Array(N * N * 2);
  for (let i = 0; i < N * N; i++) {
    out[i * 2] = 255;
    out[i * 2 + 1] = clamp(Math.abs(field[i]) * gain);
  }
  writePng(name, N, N, 2, out);
}

/** Paper: soft noise plus short fibres (unchanged from the first release). */
function paper() {
  const N = 256;
  const rand = prng(1337);
  const px = new Float32Array(N * N);
  for (let i = 0; i < px.length; i++) px[i] = (rand() - 0.5) * 34;
  for (let f = 0; f < 900; f++) {
    let x = rand() * N;
    let y = rand() * N;
    const a = rand() * Math.PI * 2;
    const len = 6 + rand() * 22;
    const tone = (rand() - 0.5) * 26;
    for (let s = 0; s < len; s++) {
      const xi = ((Math.floor(x) % N) + N) % N;
      const yi = ((Math.floor(y) % N) + N) % N;
      px[yi * N + xi] += tone;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  const field = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += px[((y + dy + N) % N) * N + ((x + dx + N) % N)];
      field[y * N + x] = s / 6;
    }
  }
  writeGrainMask('paper.png', N, field, 5);
}

/** Linen: per-row and per-column thread tones, like a loose weave. */
function linen() {
  const N = 256;
  const rand = prng(2024);
  const rows = Array.from({ length: N }, () => (rand() - 0.5) * 30);
  const cols = Array.from({ length: N }, () => (rand() - 0.5) * 30);
  // Thicker threads: smooth the tone sequences a little (wrapping).
  const smooth = (arr) => arr.map((_, i) => (arr[(i - 1 + N) % N] + arr[i] * 2 + arr[(i + 1) % N]) / 4);
  const r = smooth(rows);
  const c = smooth(cols);
  const px = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // Alternate which thread is on top, as in a plain weave.
      const over = ((x >> 1) + (y >> 1)) % 2 === 0;
      px[y * N + x] = (over ? r[y] * 0.9 + c[x] * 0.5 : c[x] * 0.9 + r[y] * 0.5) + (rand() - 0.5) * 10;
    }
  }
  writeGrainMask('linen.png', N, blurWrap(px, N, 1), 7);
}

/** Film grain: fine, high-frequency noise. */
function grain() {
  const N = 192;
  const rand = prng(77);
  const field = new Float32Array(N * N);
  for (let i = 0; i < field.length; i++) {
    // Sum of uniforms approximates a gaussian; occasional stronger specks.
    field[i] = (rand() + rand() + rand() - 1.5) * 44 + (rand() < 0.004 ? 40 : 0);
  }
  writeGrainMask('grain.png', N, field, 3.2);
}

// ---- pattern tiles (grey + alpha masks) --------------------------------------------

/** Anti-aliased coverage of a pixel by a shape given a signed-distance function. */
function maskTile(N, sdf, name) {
  const out = new Uint8Array(N * N * 2);
  const SS = 4; // supersampling per axis
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) if (sdf(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS) <= 0) hit++;
      out[(y * N + x) * 2] = 255;
      out[(y * N + x) * 2 + 1] = clamp((hit / (SS * SS)) * 255);
    }
  }
  writePng(name, N, N, 2, out);
}

/** Dot grid: one dot per 40px cell. */
function dots() {
  const N = 40;
  maskTile(N, (x, y) => Math.hypot(x - N / 2, y - N / 2) - 2.6, 'dots.png');
}

/** Graph paper: 1.25px lines every 48px. */
function grid() {
  const N = 48;
  maskTile(N, (x, y) => Math.min(Math.abs(x - 0.75), Math.abs(y - 0.75)) - 0.65, 'grid.png');
}

/** Pinstripes: 45° hairlines every 22px (tileable because the period divides the tile). */
function lines() {
  const N = 22;
  maskTile(
    N,
    (x, y) => {
      const d = ((x + y) % N + N) % N;
      return Math.min(d, N - d) / Math.SQRT2 - 0.7;
    },
    'lines.png',
  );
}

paper();
linen();
grain();
dots();
grid();
lines();
