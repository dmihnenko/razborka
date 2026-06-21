import type { ImgbbPhoto } from './imgbbService'
import { uploadToImgbb, deleteFromImgbb } from './imgbbService'
import { uploadToCloudinary } from './cloudinaryService'
import { uploadToFreeimage } from './freeimageService'
import type { PhotoStorageConfig } from './photoStorageConfig'
// Легаси-фолбэк (per-device), пока у компании не настроено своё хранилище
import { getPhotoProvider, getCloudinaryConfig } from '@/utils/photoProvider'
import { getImgbbKey } from '@/utils/imgbbKey'

/** Ошибка «провайдер не настроен» — UI показывает подсказку, куда идти. */
export class PhotoProviderNotConfigured extends Error {
  constructor(public provider: string, message: string) {
    super(message)
    this.name = 'PhotoProviderNotConfigured'
  }
}

/** Конфиг компании отсутствует (миграция не применена / не настроено) → берём
 *  локальный (per-device) конфиг, чтобы поведение не ломалось. */
function legacyConfig(): PhotoStorageConfig {
  const provider = getPhotoProvider()
  if (provider === 'cloudinary') {
    const c = getCloudinaryConfig()
    return { provider: 'cloudinary', cloudinary: { cloudName: c.cloudName, preset: c.preset } }
  }
  return { provider: 'imgbb', imgbb: { key: getImgbbKey() } }
}

/**
 * Загрузка одного фото через хранилище КОМПАНИИ (imgbb | cloudinary | freeimage).
 * cfg — конфиг компании; если null, откатываемся на локальный (легаси) конфиг.
 */
export async function uploadPhoto(file: File, cfg: PhotoStorageConfig | null): Promise<ImgbbPhoto> {
  const c = cfg ?? legacyConfig()

  if (c.provider === 'cloudinary') {
    if (!c.cloudinary?.cloudName || !c.cloudinary?.preset) {
      throw new PhotoProviderNotConfigured('cloudinary', 'Cloudinary не настроен — укажите cloud name и upload preset в Настройках → Хранилище фото')
    }
    return uploadToCloudinary(file, c.cloudinary.cloudName, c.cloudinary.preset)
  }

  if (c.provider === 'freeimage') {
    if (!c.freeimage?.key) {
      throw new PhotoProviderNotConfigured('freeimage', 'freeimage.host не настроен — укажите API ключ в Настройках → Хранилище фото')
    }
    return uploadToFreeimage(file, c.freeimage.key)
  }

  if (!c.imgbb?.key) {
    throw new PhotoProviderNotConfigured('imgbb', 'Хранилище фото не настроено — выберите сервис и добавьте ключ в Настройках → Хранилище фото')
  }
  return uploadToImgbb(file, c.imgbb.key)
}

/**
 * Удаление фото. Для imgbb — через delete_url; для остальных провайдеров
 * unsigned-загрузка не позволяет удалять с клиента (delete_url пустой) → no-op.
 */
export async function deletePhoto(photo: ImgbbPhoto): Promise<void> {
  if (photo.delete_url) {
    await deleteFromImgbb(photo.delete_url)
  }
}
