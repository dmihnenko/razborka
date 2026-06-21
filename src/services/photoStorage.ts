import type { ImgbbPhoto } from './imgbbService'
import { uploadToImgbb, deleteFromImgbb } from './imgbbService'
import { uploadToCloudinary } from './cloudinaryService'
import { uploadToFreeimage } from './freeimageService'
import type { PhotoStorageConfig } from './photoStorageConfig'

/** Ошибка «провайдер не настроен» — UI показывает подсказку, куда идти. */
export class PhotoProviderNotConfigured extends Error {
  constructor(public provider: string, message: string) {
    super(message)
    this.name = 'PhotoProviderNotConfigured'
  }
}

const NOT_CONFIGURED = 'Хранилище фото не настроено — выберите сервис и добавьте ключ в Настройках → «Хранилище фото»'

/**
 * Загрузка одного фото через хранилище КОМПАНИИ (imgbb | cloudinary | freeimage).
 * Строго per-company: используется ТОЛЬКО ключ самой разборки. Никаких локальных
 * (per-device) фолбэков — чтобы компания без ключа НЕ грузила в чужой аккаунт.
 */
export async function uploadPhoto(file: File, cfg: PhotoStorageConfig | null): Promise<ImgbbPhoto> {
  if (!cfg) {
    throw new PhotoProviderNotConfigured('none', NOT_CONFIGURED)
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
 * Удаление фото. Для imgbb — через delete_url; для остальных провайдеров
 * unsigned-загрузка не позволяет удалять с клиента (delete_url пустой) → no-op.
 */
export async function deletePhoto(photo: ImgbbPhoto): Promise<void> {
  if (photo.delete_url) {
    await deleteFromImgbb(photo.delete_url)
  }
}
