import type { ImgbbPhoto } from './imgbbService'
import { compressImage } from './imgbbService'

// Загрузка фото в Cloudinary через unsigned upload preset (без секретов на клиенте,
// как у ImgBB). Cloudinary сам отдаёт оптимизацию/ресайз на лету через URL-трансформации
// (q_auto = качество авто, f_auto = WebP/AVIF по поддержке браузера).
//
// Удаление с клиента для unsigned-загрузки недоступно (нужен API-secret/подпись),
// поэтому delete_url пустой — фото остаётся в облаке при удалении из карточки.
export async function uploadToCloudinary(file: File, cloudName: string, preset: string): Promise<ImgbbPhoto> {
  if (!cloudName || !preset) throw new Error('Cloudinary не настроен')

  const compressed = await compressImage(file)
  const ext = compressed.type === 'image/webp' ? '.webp' : '.jpg'
  const form = new FormData()
  form.append('file', compressed, file.name.replace(/\.[^.]+$/, ext))
  form.append('upload_preset', preset)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cloudinary: ${res.status} — ${text}`)
  }
  const json = await res.json()
  const url: string = json.secure_url || json.url
  if (!url) throw new Error('Cloudinary: пустой ответ')

  // Трансформации на лету: вставляем параметры после /upload/
  const tx = (t: string) => url.replace('/upload/', `/upload/${t}/`)

  return {
    url,
    medium_url: tx('w_800,c_limit,q_auto,f_auto'),
    thumb_url: tx('w_240,h_240,c_fill,q_auto,f_auto'),
    delete_url: '',
  }
}
