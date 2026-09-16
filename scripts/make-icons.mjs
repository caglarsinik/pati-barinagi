// PWA ikonlarını kodla üretir (oyunun geri kalanı gibi dışarıdan görsel kullanılmaz).
// Kullanım: node scripts/make-icons.mjs  → public/icons/*.png
// 64×64 taban çizim: koyu zemin üstünde sarı pati izi; büyütme nearest-neighbour (piksel sanatı korunur).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'icons');

const BG = [0x1b, 0x1a, 0x2a, 255]; // --bg-solid tonu (manifest theme_color ile aynı)
const PAW = [0xf6, 0xd5, 0x5c, 255]; // --accent
const PAW_DARK = [0xd9, 0xb8, 0x45, 255];
const OUTLINE = [0x24, 0x20, 0x3a, 255]; // P.outline

class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c[3];
  }
  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }
}

/**
 * Taban ikon. `size` kare kenarı, `pad` pati çiziminin kenarlardan payı (maskable için %20),
 * `rounded` köşeleri saydam bırakır (normal ikon), maskable'da zemin tam dolu kalır.
 */
function drawBase(size, pad, rounded) {
  const img = new Img(size, size);
  const r = Math.round(size * 0.19);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = true;
      if (rounded) {
        const cx = x < r ? r : x >= size - r ? size - r - 1 : x;
        const cy = y < r ? r : y >= size - r ? size - r - 1 : y;
        const dx = x - cx;
        const dy = y - cy;
        inside = dx * dx + dy * dy <= r * r;
      }
      if (inside) img.set(x, y, BG);
    }
  }
  // Pati izi: 64 birimlik tasarım alanı, pad kadar içeri alınır.
  const inner = size - 2 * pad;
  const u = inner / 64;
  const px = (v) => pad + v * u;
  const shapes = [
    { cx: 32, cy: 41, rx: 14, ry: 10.5 }, // büyük yastık
    { cx: 15, cy: 26, rx: 6, ry: 7 },
    { cx: 26, cy: 16, rx: 6, ry: 7 },
    { cx: 38, cy: 16, rx: 6, ry: 7 },
    { cx: 49, cy: 26, rx: 6, ry: 7 },
  ];
  for (const s of shapes) img.ellipse(px(s.cx), px(s.cy), s.rx * u + 1.6 * u, s.ry * u + 1.6 * u, OUTLINE);
  for (const s of shapes) img.ellipse(px(s.cx), px(s.cy), s.rx * u, s.ry * u, PAW);
  // Büyük yastığın alt yarısına hafif gölge.
  const pad0 = shapes[0];
  img.ellipse(px(pad0.cx), px(pad0.cy + 4), (pad0.rx - 3) * u, (pad0.ry - 5) * u, PAW_DARK);
  return img;
}

/** Nearest-neighbour yeniden örnekleme. */
function resample(src, size) {
  const out = new Img(size, size);
  for (let y = 0; y < size; y++) {
    const sy = Math.min(src.h - 1, Math.floor((y * src.h) / size));
    for (let x = 0; x < size; x++) {
      const sx = Math.min(src.w - 1, Math.floor((x * src.w) / size));
      out.set(x, y, src.get(sx, sy));
    }
  }
  return out;
}

// --- Mini PNG kodlayıcı (RGBA, 8 bit, filtresiz) ---
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0; // filtre: yok
    Buffer.from(img.data.buffer, y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
const normal = drawBase(64, 4, true);
const maskable = drawBase(80, 16, false); // %20 güvenli pay, zemin kenara kadar dolu
const files = [
  ['icon-512.png', resample(normal, 512)],
  ['icon-192.png', resample(normal, 192)],
  ['icon-maskable-512.png', resample(maskable, 512)],
  ['apple-touch-icon-180.png', resample(drawBase(64, 4, false), 180)], // iOS köşeleri kendi yuvarlar
  ['favicon-32.png', resample(normal, 32)],
];
for (const [name, img] of files) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, encodePng(img));
  console.log(`yazıldı ${path.relative(ROOT, file)} (${img.w}×${img.h})`);
}
