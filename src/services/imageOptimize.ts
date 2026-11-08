/**
 * Максимальное сжатие фото перед загрузкой в общее хранилище (R2).
 *
 * - Снимок декодируется один раз (с поворотом по EXIF), из него режутся все размеры.
 * - Уменьшение ступенями по половине: так мелкие копии не «звенят» и сжимаются лучше.
 * - Формат WebP, если браузер умеет его кодировать (иначе JPEG). WebP на 25–35% легче.
 * - Качество подбирается под потолок веса: начинаем с хорошего и снижаем, пока файл
 *   не уложится в бюджет, но не ниже порога, после которого видны артефакты.
 * - Метаданные (EXIF, GPS) не переносятся: canvas их не сохраняет.
 */

export interface PhotoVariantSpec {
  /** Ограничение по большей стороне, px */
  maxSide: number
  /** Потолок веса файла, байт */
  budget: number
  /** Стартовое и минимальное качество */
  startQuality: number
  minQuality: number
  /** Жёсткий потолок (как в воркере): не влезло при минимальном качестве — уменьшаем размер */
  hardCap: number
}

export const PHOTO_VARIANTS = {
  full: { maxSide: 1600, budget: 200 * 1024, startQuality: 0.8, minQuality: 0.55, hardCap: 400 * 1024 },
  medium: { maxSide: 800, budget: 60 * 1024, startQuality: 0.76, minQuality: 0.5, hardCap: 150 * 1024 },
  thumb: { maxSide: 320, budget: 14 * 1024, startQuality: 0.7, minQuality: 0.45, hardCap: 40 * 1024 },
} as const satisfies Record<string, PhotoVariantSpec>

export type PhotoVariantName = keyof typeof PHOTO_VARIANTS

const QUALITY_STEP = 0.07

/**
 * Подбор качества: кодируем, пока не уложимся в бюджет или не дойдём до минимума.
 * Возвращает самый лёгкий из полученных вариантов, если бюджет так и не достигнут.
 */
export async function encodeWithinBudget(
  encode: (quality: number) => Promise<Blob>,
  spec: Pick<PhotoVariantSpec, 'budget' | 'startQuality' | 'minQuality'>,
): Promise<Blob> {
  let quality = spec.startQuality
  let best: Blob | null = null
  for (;;) {
    const blob = await encode(quality)
    if (!best || blob.size < best.size) best = blob
    if (blob.size <= spec.budget) return blob
    if (quality <= spec.minQuality + 1e-9) return best
    quality = Math.max(spec.minQuality, Math.round((quality - QUALITY_STEP) * 100) / 100)
  }
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas
type DrawSource = ImageBitmap | AnyCanvas

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function ctx2d(canvas: AnyCanvas) {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

function encodeCanvas(canvas: AnyCanvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('ENCODE_FAILED'))), type, quality))
}

/** Уменьшение ступенями по половине, последняя ступень — точно в нужный размер. */
function downscale(source: DrawSource, srcW: number, srcH: number, maxSide: number): AnyCanvas {
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH))
  const targetW = Math.max(1, Math.round(srcW * scale))
  const targetH = Math.max(1, Math.round(srcH * scale))
  let cur: DrawSource = source
  let w = srcW
  let h = srcH
  while (w / 2 >= targetW && h / 2 >= targetH) {
    const nw = Math.round(w / 2)
    const nh = Math.round(h / 2)
    const step = makeCanvas(nw, nh)
    ctx2d(step).drawImage(cur, 0, 0, nw, nh)
    cur = step
    w = nw
    h = nh
  }
  const out = makeCanvas(targetW, targetH)
  const ctx = ctx2d(out)
  // Белая подложка: у PNG с прозрачностью в JPEG иначе будет чёрный фон
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.drawImage(cur, 0, 0, targetW, targetH)
  return out
}

let webpSupport: Promise<boolean> | null = null

/** Умеет ли браузер кодировать WebP (Safari до 17 молча отдаёт PNG). */
export function canEncodeWebp(): Promise<boolean> {
  if (!webpSupport) {
    webpSupport = (async () => {
      try {
        const probe = makeCanvas(2, 2)
        ctx2d(probe).fillRect(0, 0, 2, 2) // без контекста OffscreenCanvas не кодируется
        const blob = await encodeCanvas(probe, 'image/webp', 0.8)
        return blob.type === 'image/webp'
      } catch {
        return false
      }
    })()
  }
  return webpSupport
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  } catch {
    // Старые браузеры: через <img>
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return await createImageBitmap(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export interface OptimizedPhoto {
  full: Blob
  medium: Blob
  thumb: Blob
  ext: 'webp' | 'jpg'
}

/** Готовит три размера фото с минимальным весом. */
export async function optimizePhoto(file: Blob): Promise<OptimizedPhoto> {
  const type = (await canEncodeWebp()) ? 'image/webp' : 'image/jpeg'
  const bitmap = await decode(file)
  try {
    const result = {} as Record<PhotoVariantName, Blob>
    // Каждый следующий размер режем из предыдущего: меньше работы и памяти
    let source: DrawSource = bitmap
    let w = bitmap.width
    let h = bitmap.height
    for (const name of ['full', 'medium', 'thumb'] as const) {
      const spec = PHOTO_VARIANTS[name]
      let canvas = downscale(source, w, h, spec.maxSide)
      let blob = await encodeWithinBudget(q => encodeCanvas(canvas, type, q), spec)
      // Очень сложный снимок: уменьшаем сторону на 20%, пока не влезет в потолок воркера
      for (let i = 0; i < 6 && blob.size > spec.hardCap; i++) {
        const side = Math.round(Math.max(canvas.width, canvas.height) * 0.8)
        const smaller = downscale(canvas, canvas.width, canvas.height, side)
        blob = await encodeWithinBudget(q => encodeCanvas(smaller, type, q), spec)
        canvas = smaller
      }
      result[name] = blob
      source = canvas
      w = canvas.width
      h = canvas.height
    }
    return { ...result, ext: type === 'image/webp' ? 'webp' : 'jpg' }
  } finally {
    bitmap.close()
  }
}
