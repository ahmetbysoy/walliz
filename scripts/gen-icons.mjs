// PWA ikon üretici: bağımlılıksız, saf Node (zlib) ile PNG yazar.
// Kullanım: npm run icons  →  public/icons/{icon-192,icon-512,icon-maskable}.png
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(new URL(import.meta.url))), '..')

// ---- CRC32 (PNG) ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x / (size - 1), y / (size - 1))
      const o = rowStart + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- LANKA işareti: koyu zemin, mint mum + coral mum + violet duvar çizgisi ----
const BG = [11, 15, 20]
const MINT = [46, 230, 168]
const CORAL = [255, 107, 107]
const VIOLET = [167, 139, 250]

const inRect = (cx, cy, w, h, x, y) =>
  x >= cx - w / 2 && x <= cx + w / 2 && y >= cy - h / 2 && y <= cy + h / 2

function draw(x, y, s) {
  // s: 1 → tam alan (512), <1 → maskable güvenli bölge (merkeze sıkıştır)
  const nx = (x - 0.5) * s + 0.5
  const ny = (y - 0.5) * s + 0.5
  if (nx < 0.02 || nx > 0.98 || ny < 0.02 || ny > 0.98) return [...BG, 255]
  // mint mum (sol)
  if (inRect(0.34, 0.44, 0.16, 0.34, nx, ny) || inRect(0.34, 0.46, 0.035, 0.54, nx, ny))
    return [...MINT, 255]
  // coral mum (sağ)
  if (inRect(0.62, 0.56, 0.16, 0.26, nx, ny) || inRect(0.62, 0.56, 0.035, 0.44, nx, ny))
    return [...CORAL, 255]
  // violet duvar çizgisi (alt)
  if (inRect(0.5, 0.84, 0.62, 0.05, nx, ny)) return [...VIOLET, 255]
  return [...BG, 255]
}

mkdirSync(join(root, 'public/icons'), { recursive: true })
mkdirSync(join(root, 'public'), { recursive: true })

writeFileSync(
  join(root, 'public/icons/icon-192.png'),
  encodePng(192, (x, y) => draw(x, y, 1)),
)
writeFileSync(
  join(root, 'public/icons/icon-512.png'),
  encodePng(512, (x, y) => draw(x, y, 1)),
)
writeFileSync(
  join(root, 'public/icons/icon-maskable.png'),
  encodePng(512, (x, y) => draw(x, y, 0.78)),
)

// favicon (48px, SVG değil — PNG ile uyumlu)
writeFileSync(
  join(root, 'public/favicon.png'),
  encodePng(48, (x, y) => draw(x, y, 1)),
)
console.log('✅ ikonlar üretildi: public/icons/')
