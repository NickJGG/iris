// Rasterizes the Iris logo (outlined speech bubble + solid play) to icons/*.png with no image dependencies.
// Dark (#0f0f0f, YouTube's light-theme text) for light toolbars; light (#f1f1f1) for dark ones.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../icons');
const SIZES = [16, 32, 48, 96, 128];
const VARIANTS = { '': [0x0f, 0x0f, 0x0f], '-light': [0xf1, 0xf1, 0xf1] };
const SAMPLES = 4;

// Geometry on a 24-unit grid, matching YouTube's icons.
const C = [12, 11.5];
const OUTER = 9.5;
const INNER = 7.5;
const polar = (deg, r) => [C[0] + r * Math.cos((deg * Math.PI) / 180), C[1] + r * Math.sin((deg * Math.PI) / 180)];

// Rounded convex polygons: sharp corners in screen-clockwise order, rounded by `r`. The tail's base
// sits inside the ring band so it never spills into the hole.
const TAIL = { corners: [polar(158, 9), polar(112, 9), polar(135, 13.8)], r: 0.6 };
const PLAY = { corners: [[9.85, 7.9], [16.25, 11.5], [9.85, 15.1]], r: 0.6 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const unit = (v) => [v[0] / Math.hypot(...v), v[1] / Math.hypot(...v)];
const outward = (a, b) => { const [dx, dy] = unit(sub(b, a)); return [dy, -dx]; };

// Inset each edge by r and intersect neighbours; the shape is then this core grown by r.
function core({ corners, r }) {
  const lines = corners.map((a, i) => {
    const b = corners[(i + 1) % corners.length];
    const n = outward(a, b);
    return [[a[0] - n[0] * r, a[1] - n[1] * r], sub(b, a)];
  });
  return lines.map(([p, d], i) => {
    const [q, e] = lines[(i + lines.length - 1) % lines.length];
    const t = cross(sub(p, q), d) / cross(e, d);
    return [q[0] + e[0] * t, q[1] + e[1] * t];
  });
}

const segDist = (p, a, b) => {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2)));
  return Math.hypot(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t);
};

function inRounded(shape, k, p) {
  const inside = k.every((a, i) => cross(sub(k[(i + 1) % k.length], a), sub(p, a)) >= 0);
  return inside || k.some((a, i) => segDist(p, a, k[(i + 1) % k.length]) <= shape.r);
}

const tailCore = core(TAIL);
const playCore = core(PLAY);

function covered(x, y) {
  const d = Math.hypot(x - C[0], y - C[1]);
  return (d <= OUTER && d >= INNER) || inRounded(TAIL, tailCore, [x, y]) || inRounded(PLAY, playCore, [x, y]);
}

function render(size, [r, g, b]) {
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = ((px + (sx + 0.5) / SAMPLES) / size) * 24;
          const y = ((py + (sy + 0.5) / SAMPLES) / size) * 24;
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

// Same geometry as a currentColor SVG, for inline use inside YouTube. Every subpath runs clockwise
// except the hole, so the default nonzero fill unions the tail with the ring.
const n = (v) => +v.toFixed(2);
const pt = ([x, y]) => `${n(x)} ${n(y)}`;
const circle = (r, sweep) => {
  const [x, y] = C;
  return `M${pt([x, y - r])}A${r} ${r} 0 1 ${sweep} ${pt([x, y + r])}A${r} ${r} 0 1 ${sweep} ${pt([x, y - r])}Z`;
};
const rounded = (shape, k) =>
  k.map((a, i) => {
    const b = k[(i + 1) % k.length];
    const c = k[(i + 2) % k.length];
    const [nx, ny] = outward(a, b);
    const [mx, my] = outward(b, c);
    const r = shape.r;
    const start = i ? '' : `M${pt([a[0] + nx * r, a[1] + ny * r])}`;
    return `${start}L${pt([b[0] + nx * r, b[1] + ny * r])}A${r} ${r} 0 0 1 ${pt([b[0] + mx * r, b[1] + my * r])}`;
  }).join('') + 'Z';
const path = circle(OUTER, 1) + circle(INNER, 0) + rounded(TAIL, tailCore) + rounded(PLAY, playCore);
writeFileSync(resolve(out, 'iris.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="${path}"/></svg>\n`);
