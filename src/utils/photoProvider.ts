// Выбор провайдера хранения фотографий + его конфиг.
// Хранится в localStorage (как и ключ ImgBB). По умолчанию — imgbb, чтобы
// поведение не менялось, пока пользователь явно не переключит провайдера.
//
// TODO: со временем перенести выбор/конфиг на запись компании (parts_companies),
// чтобы он был общим для владельца и работников на всех устройствах, а не
// per-device.

export type PhotoProvider = 'imgbb' | 'cloudinary' | 'r2'

const PROVIDER_KEY = 'parts_photo_provider'
const CLOUDINARY_KEY = 'parts_cloudinary_cfg' // JSON { cloudName, preset }

export function getPhotoProvider(): PhotoProvider {
  const v = (typeof localStorage !== 'undefined' && localStorage.getItem(PROVIDER_KEY)) as PhotoProvider | null
  return v === 'cloudinary' || v === 'r2' ? v : 'imgbb'
}

export function setPhotoProvider(p: PhotoProvider): void {
  try { localStorage.setItem(PROVIDER_KEY, p) } catch { /* ignore */ }
}

export interface CloudinaryConfig {
  cloudName: string
  preset: string
}

export function getCloudinaryConfig(): CloudinaryConfig {
  try {
    const raw = localStorage.getItem(CLOUDINARY_KEY)
    if (raw) {
      const o = JSON.parse(raw)
      return { cloudName: o.cloudName || '', preset: o.preset || '' }
    }
  } catch { /* ignore */ }
  return { cloudName: '', preset: '' }
}

export function setCloudinaryConfig(cfg: CloudinaryConfig): void {
  try {
    if (cfg.cloudName.trim() || cfg.preset.trim()) {
      localStorage.setItem(CLOUDINARY_KEY, JSON.stringify({ cloudName: cfg.cloudName.trim(), preset: cfg.preset.trim() }))
    } else {
      localStorage.removeItem(CLOUDINARY_KEY)
    }
  } catch { /* ignore */ }
}
