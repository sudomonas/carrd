// Generates src/assets/paper-texture.png: a tileable, neutral-grey paper grain.
// Values centre on 128 so the soft-light blend leaves the palette colour intact.
// Run once with `node scripts/make-texture.mjs`; the output is committed.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const N = 256;
let seed = 1337;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const px = new Float32Array(N * N);
for (let i = 0; i < px.length; i++) px[i] = (rand() - 0.5) * 34;
// Soft fibres: short random walks, wrapping at the edges so the tile repeats.
for (let f = 0; f < 900; f++) {
  let x = rand() * N, y = rand() * N;
  const a = rand() * Math.PI * 2, len = 6 + rand() * 22, tone = (rand() - 0.5) * 26;
  for (let s = 0; s < len; s++) {
    const xi = ((Math.floor(x) % N) + N) % N, yi = ((Math.floor(y) % N) + N) % N;
    px[yi * N + xi] += tone;
    x += Math.cos(a); y += Math.sin(a);
  }
}
// One box-blur pass (wrapping) to soften the grain.
const out = new Uint8Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  let s = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += px[((y + dy + N) % N) * N + ((x + dx + N) % N)];
  out[y * N + x] = Math.max(0, Math.min(255, Math.round(128 + s / 6)));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 0; // 8-bit greyscale
const raw = Buffer.alloc(N * (N + 1));
for (let y = 0; y < N; y++) { raw[y * (N + 1)] = 0; Buffer.from(out.subarray(y * N, y * N + N)).copy(raw, y * (N + 1) + 1); }
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(new URL('../src/assets/paper-texture.png', import.meta.url), png);
console.log(`wrote paper-texture.png (${png.length} bytes)`);
