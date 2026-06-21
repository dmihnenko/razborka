import type { ImgbbPhoto } from './imgbbService'
import { uploadToImgbb, deleteFromImgbb } from './imgbbService'
import { uploadToCloudinary } from './cloudinaryService'
import { getPhotoProvider, getCloudinaryConfig } from '@/utils/photoProvider'
import { getImgbbKey } from '@/utils/imgbbKey'

/** Ошибка «провайдер не настроен» — UI показывает подсказку, куда идти. */
export class PhotoProviderNotConfigured extends Error {
  constructor(public provider: string, message: string) {
    super(message)
    this.name = 'PhotoProviderNotConfigured'
  }
}

/**
 * Загрузка одного фото через выбранный провайдер (imgbb | cloudinary | r2).
 * Единая точка входа — компоненты не знают, какой бэкенд активен.
 */
export async function uploadPhoto(file: File): Promise<ImgbbPhoto> {
  const provider = getPhotoProvider()

  if (provider === 'cloudinary') {
    const { cloudName, preset } = getCloudinaryConfig()
    if (!cloudName || !preset) {
      throw new PhotoProviderNotConfigured('cloudinary', 'Cloudinary не настроен — укажите cloud name и upload preset в Настройках')
    }
    return uploadToCloudinary(file, cloudName, preset)
  }

  // r2 — добавим, когда включат R2 (загрузка через worker). Пока — фолбэк на imgbb.

  const key = getImgbbKey()
  if (!key) {
    throw new PhotoProviderNotConfigured('imgbb', 'Укажите API ключ ImgBB в Настройках')
  }
  return uploadToImgbb(file, key)
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
