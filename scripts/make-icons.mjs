// Rasterizes the Iris eye (almond outline + solid iris) to icons/*.png with no image dependencies.
// Dark (#0f0f0f, YouTube's light-theme text) for light toolbars; light (#f1f1f1) for dark ones.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../icons');
const SIZES = [16, 32, 48, 96];
const VARIANTS = { '': [0x0f, 0x0f, 0x0f], '-light': [0xf1, 0xf1, 0xf1] };
const SAMPLES = 4;

// Almond = intersection of two circles centred above and below the middle, sized so the lens
// spans HALF_W horizontally and HALF_H vertically (R - D = HALF_H, R² - D² = HALF_W²).
const HALF_W = 0.45;
const HALF_H = 0.29;
const R = (HALF_W ** 2 / HALF_H + HALF_H) / 2;
const D = R - HALF_H;
const STROKE = 0.085;
const IRIS = 0.17;

function inLens(x, y, r) {
  return Math.hypot(x, y - D) <= r && Math.hypot(x, y + D) <= r;
}

function covered(x, y) {
  const outline = inLens(x, y, R) && !inLens(x, y, R - STROKE);
  return outline || Math.hypot(x, y) <= IRIS;
}

function render(size, [r, g, b]) {
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size - 0.5;
          const y = (py + (sy + 0.5) / SAMPLES) / size - 0.5;
          if (covered(x, y)) hits++;
        }
      }
      row.set([r, g, b, Math.round((255 * hits) / SAMPLES ** 2)], 1 + px * 4);
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [suffix, color] of Object.entries(VARIANTS)) {
  for (const size of SIZES) {
    writeFileSync(resolve(out, `iris${suffix}-${size}.png`), render(size, color));
  }
}

// Same geometry as a currentColor SVG, for inline use in YouTube's guide and the Feed title.
const n = (v) => +(v * 24).toFixed(3);
const lens = (rad) => {
  const halfW = Math.sqrt(rad ** 2 - D ** 2);
  const arc = `A${n(rad)} ${n(rad)} 0 0 1`;
  return `M${n(0.5 - halfW)} 12${arc} ${n(0.5 + halfW)} 12${arc} ${n(0.5 - halfW)} 12Z`;
};
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="${lens(R)}${lens(R - STROKE)}"/><circle cx="12" cy="12" r="${n(IRIS)}"/></svg>\n`;
writeFileSync(resolve(out, 'iris.svg'), svg);
