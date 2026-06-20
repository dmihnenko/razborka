/* Генерация иконок бренда из мастер-SVG (R + тил-точка на чернильной плитке).
   Запуск: node scripts/gen-icons.cjs  (нужны sharp + ImageMagick `convert`). */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

// Однокартиночный ICO с PNG внутри (читают все совр. браузеры)
function pngToIco(png, size) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size >= 256 ? 0 : size, 0)
  entry.writeUInt8(size >= 256 ? 0 : size, 1)
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(22, 12)
  return Buffer.concat([header, entry, png])
}

const pub = path.join(__dirname, '..', 'public')
const rounded = fs.readFileSync(path.join(pub, 'favicon.svg'))

// Маскируемая (full-bleed фон + контент в safe-zone ~80%)
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#16181D"/>
  <g transform="translate(256 256) scale(0.78) translate(-256 -256)">
    <g fill="none" stroke="#FFFFFF" stroke-width="46" stroke-linecap="round" stroke-linejoin="round">
      <path d="M190 150V362"/>
      <path d="M190 150h62a54 54 0 0 1 0 108h-62"/>
      <path d="M206 252 306 362"/>
    </g>
    <circle cx="372" cy="372" r="30" fill="#0D9488"/>
  </g>
</svg>`)

async function main() {
  // «any»-иконки — скруглённый мастер
  await sharp(rounded).resize(64, 64).png().toFile(path.join(pub, 'pwa-64x64.png'))
  await sharp(rounded).resize(192, 192).png().toFile(path.join(pub, 'pwa-192x192.png'))
  await sharp(rounded).resize(512, 512).png().toFile(path.join(pub, 'pwa-512x512.png'))
  // apple-touch и maskable — full-bleed (iOS/Android сами скругляют)
  await sharp(maskable).resize(180, 180).png().toFile(path.join(pub, 'apple-touch-icon.png'))
  await sharp(maskable).resize(512, 512).png().toFile(path.join(pub, 'maskable-icon-512x512.png'))
  // favicon.ico (48×48 PNG внутри ICO)
  const fav = await sharp(rounded).resize(48, 48).png().toBuffer()
  fs.writeFileSync(path.join(pub, 'favicon.ico'), pngToIco(fav, 48))
  console.log('icons: ok')
}
main().catch(e => { console.error(e); process.exit(1) })
