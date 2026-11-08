import type { ImgbbPhoto } from './imgbbService'
import { uploadToImgbb, deleteFromImgbb } from './imgbbService'
import { supabase } from '@/lib/supabase'
import { uploadToCloudinary } from './cloudinaryService'
import { uploadToFreeimage } from './freeimageService'
import type { PhotoStorageConfig } from './photoStorageConfig'
import { optimizePhoto } from './imageOptimize'

/** Ошибка «провайдер не настроен» — UI показывает подсказку, куда идти. */
export class PhotoProviderNotConfigured extends Error {
  constructor(public provider: string, message: string) {
    super(message)
    this.name = 'PhotoProviderNotConfigured'
  }
}

/** Превышен лимит общего хранилища по тарифу — UI предлагает обновить тариф. */
export class PhotoQuotaExceeded extends Error {
  constructor() {
    super('PHOTO_QUOTA_EXCEEDED')
    this.name = 'PhotoQuotaExceeded'
  }
}

/** Общее хранилище недоступно (бакет не подключён / сбой сервера). */
export class PhotoStorageUnavailable extends Error {
  constructor(message = 'STORAGE_UNAVAILABLE') {
    super(message)
    this.name = 'PhotoStorageUnavailable'
  }
}

/** Сессия истекла (воркер ответил 401) — UI просит войти заново. */
export class PhotoSessionExpired extends Error {
  constructor() {
    super('UNAUTHORIZED')
    this.name = 'PhotoSessionExpired'
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Загрузка в общее хранилище razborka.net (R2) через воркер: 3 размера за один запрос. */
async function uploadToShared(file: File): Promise<ImgbbPhoto> {
  const { full, medium, thumb, ext } = await optimizePhoto(file)
  const form = new FormData()
  form.append('full', full, `full.${ext}`)
  form.append('medium', medium, `medium.${ext}`)
  form.append('thumb', thumb, `thumb.${ext}`)
  let res: Response
  try {
    res = await fetch('/api/photos/upload', { method: 'POST', headers: await authHeader(), body: form })
  } catch {
    throw new PhotoStorageUnavailable('NETWORK')
  }
  if (res.ok) {
    const j = await res.json()
    return { url: j.url, medium_url: j.medium_url, thumb_url: j.thumb_url, delete_url: j.delete_url || '' }
  }
  if (res.status === 401) throw new PhotoSessionExpired()
  const body = await res.json().catch(() => ({}))
  if (body.code === 'PHOTO_QUOTA_EXCEEDED') throw new PhotoQuotaExceeded()
  throw new PhotoStorageUnavailable(body.code || String(res.status))
}

const MAX_DELETE = 20 // как в worker/photoStorage.js
const SHARED_PATH = '/photos/'
const SHARED_HOSTS = new Set(['razborka.net', 'www.razborka.net'])
/** Фото нашего общего хранилища (R2) — по пути на нашем домене. */
export function isSharedPhotoUrl(url: string | undefined | null): boolean {
  if (!url) return false
  try {
    const u = new URL(url, window.location.origin)
    return SHARED_HOSTS.has(u.hostname) && u.pathname.startsWith(SHARED_PATH)
  } catch { return false }
}

const NOT_CONFIGURED = 'Хранилище фото не настроено — выберите сервис и добавьте ключ в Настройках → «Хранилище фото»'

/**
 * Загрузка одного фото через хранилище КОМПАНИИ (imgbb | cloudinary | freeimage).
 * Строго per-company: используется ТОЛЬКО ключ самой разборки. Никаких локальных
 * (per-device) фолбэков — чтобы компания без ключа НЕ грузила в чужой аккаунт.
 */
export async function uploadPhoto(file: File, cfg: PhotoStorageConfig | null): Promise<ImgbbPhoto> {
  // Конфиг не загружен — НЕ грузим молча в чужое/общее хранилище
  if (!cfg) throw new PhotoStorageUnavailable('CONFIG_NOT_LOADED')
  // Общее хранилище razborka.net — только при явном provider='shared'
  if (cfg.provider === 'shared') {
    return uploadToShared(file)
  }

  if (cfg.provider === 'cloudinary') {
    if (!cfg.cloudinary?.cloudName || !cfg.cloudinary?.preset) {
      throw new PhotoProviderNotConfigured('cloudinary', 'Cloudinary не настроен — укажите cloud name и upload preset в Настройках → «Хранилище фото»')
    }
    return uploadToCloudinary(file, cfg.cloudinary.cloudName, cfg.cloudinary.preset)
  }

  if (cfg.provider === 'freeimage') {
    if (!cfg.freeimage?.key) {
      throw new PhotoProviderNotConfigured('freeimage', 'freeimage.host не настроен — укажите API ключ в Настройках → «Хранилище фото»')
    }
    return uploadToFreeimage(file, cfg.freeimage.key)
  }

  if (!cfg.imgbb?.key) {
    throw new PhotoProviderNotConfigured('imgbb', NOT_CONFIGURED)
  }
  return uploadToImgbb(file, cfg.imgbb.key)
}

/**
 * Удаление набора фото: наши (/photos/…) — через воркер (освобождает квоту),
 * остальные — как раньше через imgbb delete_url. Best-effort: ошибки не бросаем.
 */
export async function deletePhotos(photos: ImgbbPhoto[]): Promise<void> {
  const shared = photos.filter((p) => isSharedPhotoUrl(p.url))
  const rest = photos.filter((p) => !isSharedPhotoUrl(p.url))
  const tasks: Promise<unknown>[] = rest.filter((p) => p.delete_url).map((p) => deleteFromImgbb(p.delete_url).catch((e) => console.error('photo delete failed', e)))
  // у фото 3 URL (оригинал/средний/миниатюра); воркер принимает до MAX_DELETE урлов за запрос
  const urls = shared.flatMap((p) => [p.url, p.medium_url, p.thumb_url].filter((u): u is string => !!u && isSharedPhotoUrl(u)))
  for (let i = 0; i < urls.length; i += MAX_DELETE) {
    const chunk = urls.slice(i, i + MAX_DELETE)
    tasks.push((async () => {
      try {
        const res = await fetch('/api/photos/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
          body: JSON.stringify({ urls: chunk }),
        })
        if (!res.ok) console.error('photo delete failed', res.status)
      } catch (e) { console.error('photo delete failed', e) }
    })())
  }
  await Promise.all(tasks)
}

/**
 * Удаление фото. Для imgbb — через delete_url; для остальных провайдеров
 * unsigned-загрузка не позволяет удалять с клиента (delete_url пустой) → no-op.
 */
export async function deletePhoto(photo: ImgbbPhoto): Promise<void> {
  await deletePhotos([photo])
}

/**
 * Безопасное удаление: стираем только те фото, ни один URL которых не используется
 * (товары компании, снимки корзины). RPC photo_urls_in_use; при любом сбое проверки
 * ничего не удаляем (fail closed). Best-effort: не бросает.
 */
export async function deletePhotosIfUnused(photos: ImgbbPhoto[]): Promise<void> {
  const list = photos.filter((p) => p && p.url)
  if (!list.length) return
  const photoUrls = (p: ImgbbPhoto) => [p.url, p.medium_url, p.thumb_url].filter((u): u is string => !!u)
  const all = [...new Set(list.flatMap(photoUrls))]
  const used = new Set<string>()
  try {
    for (let i = 0; i < all.length; i += 300) {
      const { data, error } = await supabase.rpc('photo_urls_in_use', { p_urls: all.slice(i, i + 300) })
      if (error || !Array.isArray(data)) throw error ?? new Error('bad photo_urls_in_use response')
      for (const u of data as string[]) used.add(u)
    }
  } catch (e) {
    console.error('photo usage check failed, files kept', e)
    return
  }
  const free = list.filter((p) => !photoUrls(p).some((u) => used.has(u)))
  if (free.length) await deletePhotos(free)
}
